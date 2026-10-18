/**
 * Party control gate — ONLY the DJ may drive the shared TrackPlayer.
 *
 * The redux store, the socket and RNTP are mocked so these tests exercise the
 * pure gating logic in utils/partyPlayback.utils without booting any native
 * module or opening a network connection.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-track-player', () => {
  const TrackPlayer = {
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    seekTo: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(undefined),
    getPosition: jest.fn().mockResolvedValue(42),
    getState: jest.fn().mockResolvedValue(2),
    updateOptions: jest.fn().mockResolvedValue(undefined),
  };
  return {
    __esModule: true,
    default: TrackPlayer,
    State: { None: 0, Ready: 1, Paused: 2, Playing: 3, Stopped: 4, Buffering: 6, Ended: 8 },
    Capability: { Play: 0, Pause: 1, SeekTo: 2, SkipToNext: 3, SkipToPrevious: 4 },
    AppKilledPlaybackBehavior: { StopPlaybackAndRemoveNotification: 2 },
  };
});

jest.mock('@/configs/socket', () => ({
  __esModule: true,
  socket: { emit: jest.fn() },
  emitWithAck: jest.fn(),
}));

jest.mock('@/state/store', () => {
  const state = {
    party: {
      roomId: null,
      role: 'listener',
      status: 'idle',
      currentIndex: -1,
      queue: [],
      anchorPosMs: 0,
    },
    audio: { isInitialized: true, currentTrack: null },
  };
  return {
    __esModule: true,
    default: { getState: () => state, dispatch: jest.fn() },
    __state: state,
  };
});

import TrackPlayer from 'react-native-track-player';
import { socket, emitWithAck } from '@/configs/socket';
import { __state as state } from '@/state/store';
import {
  roomOwnsAudio,
  selectIsListenerLocked,
  partyTogglePlayback,
  partyStep,
  partySeek,
  handleVoiceRoomSongTap,
} from '../partyPlayback.utils';

const QUEUE = [
  { queueId: 'q1', videoId: 'v1', title: 'One', artists: 'A' },
  { queueId: 'q2', videoId: 'v2', title: 'Two', artists: 'B' },
];

function reset() {
  state.party = {
    roomId: null,
    role: 'listener',
    status: 'idle',
    currentIndex: -1,
    queue: [],
    anchorPosMs: 0,
  };
  state.audio = { isInitialized: true, currentTrack: null };
  jest.clearAllMocks();
}

/** Put the device in a room; `ownsAudio` mirrors the room track into the player. */
function joinRoom({ role = 'listener', status = 'playing', ownsAudio = true } = {}) {
  state.party = {
    roomId: 'room1',
    role,
    status,
    currentIndex: 0,
    queue: QUEUE,
    anchorPosMs: 12000,
  };
  state.audio.currentTrack = ownsAudio
    ? { videoId: 'v1', title: 'One', isPartyTrack: true }
    : { videoId: 'mine', title: 'Personal' };
}

beforeEach(reset);

describe('roomOwnsAudio', () => {
  it('is false outside a room, so personal playback stays untouched', () => {
    expect(roomOwnsAudio()).toBe(false);
  });

  it('is false when only a personal track is loaded', () => {
    joinRoom({ ownsAudio: false });
    expect(roomOwnsAudio()).toBe(false);
  });

  it('stays true for every room status, including when the DJ pauses', () => {
    for (const status of ['idle', 'loading', 'playing', 'paused']) {
      joinRoom({ status });
      expect(roomOwnsAudio()).toBe(true);
    }
  });
});

describe('selectIsListenerLocked', () => {
  it('locks listeners only, never the DJ', () => {
    joinRoom({ role: 'listener' });
    expect(selectIsListenerLocked(state)).toBe(true);
    joinRoom({ role: 'dj' });
    expect(selectIsListenerLocked(state)).toBe(false);
    joinRoom({ role: 'listener', ownsAudio: false });
    expect(selectIsListenerLocked(state)).toBe(false);
  });
});

describe('partyTogglePlayback', () => {
  it('returns false outside a room (caller drives TrackPlayer itself)', async () => {
    await expect(partyTogglePlayback()).resolves.toBe(false);
    expect(socket.emit).not.toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(TrackPlayer.pause).not.toHaveBeenCalled();
  });

  it('swallows listener taps while the DJ is PAUSED (the reported bug)', async () => {
    joinRoom({ role: 'listener', status: 'paused' });
    await expect(partyTogglePlayback()).resolves.toBe(true);
    expect(socket.emit).not.toHaveBeenCalled();
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    expect(TrackPlayer.pause).not.toHaveBeenCalled();
  });

  it('swallows listener taps while the room is playing', async () => {
    joinRoom({ role: 'listener', status: 'playing' });
    await expect(partyTogglePlayback()).resolves.toBe(true);
    expect(socket.emit).not.toHaveBeenCalled();
    expect(TrackPlayer.pause).not.toHaveBeenCalled();
  });

  it("routes the DJ's pause through the room, using RNTP's live position", async () => {
    joinRoom({ role: 'dj', status: 'playing' });
    await expect(partyTogglePlayback()).resolves.toBe(true);
    expect(socket.emit).toHaveBeenCalledWith('dj:pause-at', {
      roomId: 'room1',
      positionMs: 42000,
    });
    expect(TrackPlayer.pause).not.toHaveBeenCalled();
  });

  it("routes the DJ's resume through the room", async () => {
    joinRoom({ role: 'dj', status: 'paused' });
    await expect(partyTogglePlayback()).resolves.toBe(true);
    expect(socket.emit).toHaveBeenCalledWith(
      'dj:play-at',
      expect.objectContaining({ roomId: 'room1', queueId: 'q1', positionMs: 12000 })
    );
    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });
});

describe('partyStep', () => {
  it('swallows listener next/prev', async () => {
    joinRoom({ role: 'listener' });
    await expect(partyStep(1)).resolves.toBe(true);
    await expect(partyStep(-1)).resolves.toBe(true);
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("routes the DJ's next/prev through the room", async () => {
    joinRoom({ role: 'dj' });
    await expect(partyStep(1)).resolves.toBe(true);
    expect(socket.emit).toHaveBeenCalledWith('dj:next', { roomId: 'room1' });
    await expect(partyStep(-1)).resolves.toBe(true);
    expect(socket.emit).toHaveBeenCalledWith('dj:prev', { roomId: 'room1' });
  });

  it('falls through to personal playback outside a room', async () => {
    await expect(partyStep(1)).resolves.toBe(false);
    expect(socket.emit).not.toHaveBeenCalled();
  });
});

describe('partySeek', () => {
  it('swallows listener seeks — never touches TrackPlayer', async () => {
    joinRoom({ role: 'listener' });
    await expect(partySeek(30)).resolves.toBe(true);
    expect(socket.emit).not.toHaveBeenCalled();
    expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
  });

  it('broadcasts the DJ seek in milliseconds so every device follows', async () => {
    joinRoom({ role: 'dj' });
    await expect(partySeek(30.5)).resolves.toBe(true);
    expect(socket.emit).toHaveBeenCalledWith('dj:seek-at', {
      roomId: 'room1',
      positionMs: 30500,
    });
    expect(TrackPlayer.seekTo).not.toHaveBeenCalled();
  });

  it('falls through to a local seek outside a room', async () => {
    await expect(partySeek(30)).resolves.toBe(false);
    expect(socket.emit).not.toHaveBeenCalled();
  });
});

describe('after leaving the room', () => {
  it('releases every gate so personal playback works again', async () => {
    joinRoom({ role: 'listener', status: 'playing' });
    expect(await partyTogglePlayback()).toBe(true);

    state.party = {
      roomId: null,
      role: 'listener',
      status: 'idle',
      currentIndex: -1,
      queue: [],
      anchorPosMs: 0,
    };
    state.audio.currentTrack = { videoId: 'mine', title: 'Personal' };

    expect(roomOwnsAudio()).toBe(false);
    expect(selectIsListenerLocked(state)).toBe(false);
    expect(await partyTogglePlayback()).toBe(false);
    expect(await partyStep(1)).toBe(false);
    expect(await partySeek(10)).toBe(false);
  });
});

describe('handleVoiceRoomSongTap', () => {
  beforeEach(() => {
    reset();
    emitWithAck.mockReset();
  });

  it('returns false when outside a voice room so personal playback proceeds', async () => {
    const res = await handleVoiceRoomSongTap({ videoId: 'song1', title: 'Test' }, false);
    expect(res).toBe(false);
    expect(emitWithAck).not.toHaveBeenCalled();
  });

  it('sends dj:request-add when tapped by a listener in a voice room', async () => {
    joinRoom({ role: 'listener' });
    emitWithAck.mockResolvedValueOnce({ success: true });

    const res = await handleVoiceRoomSongTap(
      { videoId: 'song1', title: 'Test Song', artists: 'Test Artist' },
      false
    );
    expect(res).toBe(true);
    expect(emitWithAck).toHaveBeenCalledWith(
      'dj:request-add',
      expect.objectContaining({
        roomId: 'room1',
        videoId: 'song1',
        title: 'Test Song',
      })
    );
  });
});

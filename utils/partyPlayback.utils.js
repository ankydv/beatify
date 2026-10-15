import TrackPlayer, {
  State,
  Capability,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';
import store from '@/state/store';
import { socket } from '@/configs/socket';

let scheduledTimer = null;
let playerReadyPromise = null;

export function clearScheduled() {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }
}

export function scheduleAt(delayMs, fn) {
  clearScheduled();
  scheduledTimer = setTimeout(fn, Math.max(0, delayMs));
}

/**
 * Ensure the native TrackPlayer is set up before any party load.
 * Bug-2 root: joining a room with no personal playback ever run means
 * `audio.isInitialized` is false and setupPlayer() never ran — every
 * loadPartyBundle() silently threw and no track played. This lazily
 * initialises once and is safe to call from every party entry point.
 */
export function ensurePlayerReady() {
  try {
    const st = store.getState();
    if (st?.audio?.isInitialized) return Promise.resolve(true);
  } catch (e) {}
  if (!playerReadyPromise) {
    playerReadyPromise = (async () => {
      try {
        const { initializePlayer, setIsInitialized } = await import(
          '@/state/slices/audio.slice'
        );
        await store.dispatch(initializePlayer()).unwrap();
        try {
          store.dispatch(setIsInitialized(true));
        } catch (e) {}
        // initializePlayer() always writes the DEFAULT (full) capability set.
        // Re-apply the room lock afterwards — if a LISTENER is the one booting
        // the player, the Android notification / media session must not expose
        // any control to them. (Default ensureReady:false => no recursion.)
        await applyRoomControlLock();
        return true;
      } catch (e) {
        playerReadyPromise = null;
        throw e;
      }
    })();
  }
  return playerReadyPromise;
}

/**
 * Leave-room teardown: stop room audio and hand the queue back to personal.
 * Bug-2 root (part 2): leaving kept the RNTP queue loaded with the room
 * track so it kept playing. Also snapshots nothing — personal queue was
 * never touched (only currentTrack/metadata were mirrored), so restoring
 * = reset player + re-add the personal queue head WITHOUT autoplay.
 * Returns true when a personal track was restored (caller may auto-play
 * or leave paused — we leave paused to avoid surprise audio).
 */
export async function teardownPartyPlayer(dispatch) {
  clearScheduled();
  try {
    await TrackPlayer.reset();
  } catch (e) {}
  try {
    if (dispatch) {
      const { restorePersonalTrack } = await import('@/services/party.service');
      restorePersonalTrack(dispatch);
      // Re-seed the RNTP queue with the personal track so Play resumes it.
      // Personal snapshot holds { currentTrack, metadata }; reload its stream
      // URL the same way loadAndPlayTrack does but stop before play().
      const a = store.getState()?.audio;
      const track = a?.currentTrack;
      if (track && !track.isPartyTrack && track.videoId) {
        try {
          await ensurePlayerReady();
          const getMetadata = (await import('@/services/metadata.service')).default;
          const Metadata = (await import('@/utils/metadata.utils')).default;
          const metadata = await getMetadata(track.videoId);
          const md = new Metadata(metadata);
          const details = md.getPlayableFormatDetails();
          const url = details?.url || md.getStreamingUrl();
          if (url) {
            const headers = details?.headers || metadata?._streamHeaders || undefined;
            await TrackPlayer.add([{
              id: track.videoId,
              url,
              title: track.title || md.getTitle(),
              artist:
                typeof track.artists === 'string'
                  ? track.artists
                  : md.getArtists?.() || '',
              artwork: track.thumbnail?.[0]?.url || undefined,
              headers,
              contentType: details?.mimeType
                ? details.mimeType.split(';')[0].trim()
                : 'audio/mp4',
              userAgent: headers?.['User-Agent'] || undefined,
            }]);
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}

export function isPartyActive() {
  try {
    const s = store.getState()?.party;
    return !!(s?.roomId && s?.queue?.length && s?.currentIndex >= 0 && (s?.status === 'playing' || s?.status === 'loading'));
  } catch (e) {
    return false;
  }
}

export function isPartyDj() {
  try {
    return store.getState()?.party?.role === 'dj';
  } catch (e) {
    return false;
  }
}

/**
 * AUTHORITATIVE ownership test for the shared TrackPlayer instance.
 *
 * While a voice room is active the room's now-playing bundle is mirrored into
 * `audio.currentTrack` with `isPartyTrack: true` (see mirrorPartyTrack). From
 * that moment the room — not the local device — owns the player, for EVERY
 * status (idle/loading/playing/paused), until leave-room restores the personal
 * snapshot and resets the party slice.
 *
 * Why not `isPartyActive()`: that only returns true for `playing|loading`, so
 * the instant the DJ paused, every local control surface (Android notification,
 * lock screen, quick-settings media tile, mini-player, player screen) stopped
 * being gated and a listener could resume/pause the room track locally.
 */
export function roomOwnsAudio() {
  try {
    const s = store.getState();
    return !!(s?.party?.roomId && s?.audio?.currentTrack?.isPartyTrack);
  } catch (e) {
    return false;
  }
}

/** Pure selector form (usable with `useSelector`). */
export function selectIsListenerLocked(s) {
  return !!(s?.party?.roomId && s?.audio?.currentTrack?.isPartyTrack && s?.party?.role !== 'dj');
}

/** True when the local device is a LISTENER whose player is owned by a room. */
export function isListenerLocked() {
  try {
    return selectIsListenerLocked(store.getState());
  } catch (e) {
    return false;
  }
}

const FULL_CAPABILITIES = [
  Capability.Play,
  Capability.Pause,
  Capability.SkipToNext,
  Capability.SkipToPrevious,
  Capability.SeekTo,
];

let appliedControlMode = null; // 'full' | 'locked' | null

function buildPlayerOptions(capabilities, compactCapabilities) {
  // NOTE: progressUpdateEventInterval MUST be re-sent on every updateOptions —
  // RNTP drops the progress job when it is absent, which would freeze the
  // player screen slider and the party drift corrector.
  return {
    capabilities,
    compactCapabilities,
    android: {
      alwaysPauseOnInterruption: true,
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
    },
    progressUpdateEventInterval: 0.2,
    forwardJumpInterval: 5,
  };
}

/**
 * Native-level lock (defence in depth on top of the JS gates).
 *
 * While a LISTENER's device is playing room audio, strip every capability from
 * RNTP so the Android media session / persistent notification / lock screen /
 * quick-settings tile / Bluetooth AVRCP / Android Auto expose NO play, pause,
 * skip or seek action at all — the OS has nothing to hand to the listener.
 * The DJ keeps the full control set, and so does anyone outside a room.
 *
 * @param {boolean} opts.ensureReady  Boot the player first if needed (only safe
 *   to pass from OUTSIDE ensurePlayerReady — it would deadlock otherwise).
 * @param {boolean} opts.force        Re-apply even if the mode is unchanged.
 * @param {'full'|'locked'} opts.mode Override the derived mode (used on teardown).
 */
export async function applyRoomControlLock({ ensureReady = false, force = false, mode = null } = {}) {
  const target = mode || (isListenerLocked() ? 'locked' : 'full');
  if (!force && appliedControlMode === target) return target;
  try {
    if (target === 'locked' && ensureReady) await ensurePlayerReady();
    const st = store.getState();
    if (!st?.audio?.isInitialized) {
      // Nothing to configure yet. initializePlayer() runs `applyRoomControlLock()`
      // right after it writes the default options, so a 'full' mode is already
      // correct; a pending 'locked' will be applied by that hook.
      if (target === 'full') appliedControlMode = 'full';
      return target;
    }
    await TrackPlayer.updateOptions(
      target === 'locked'
        ? buildPlayerOptions([], [])
        : buildPlayerOptions(FULL_CAPABILITIES, [Capability.Play, Capability.Pause])
    );
    appliedControlMode = target;
  } catch (e) {
    // Never let a capability refresh break playback — the JS gates still hold.
    appliedControlMode = null;
  }
  return target;
}

/** Recompute + apply the lock from the current redux state. */
export function syncRoomControlLock(opts) {
  return applyRoomControlLock(opts);
}

function currentPartyTrack() {
  try {
    const p = store.getState()?.party;
    if (p.currentIndex < 0 || p.currentIndex >= p.queue.length) return null;
    return p.queue[p.currentIndex];
  } catch (e) {
    return null;
  }
}

/**
 * Party-aware playback toggle for notification / mini-player / player-screen
 * buttons. Returns true when party mode consumed the tap (caller must NOT
 * also drive TrackPlayer). While a room owns audio:
 *  - DJ taps route to the room (socket commands keep everyone in sync).
 *  - Listener taps are ignored (local play/pause would desync them).
 */
export async function partyTogglePlayback() {
  if (!roomOwnsAudio()) return false;
  const p = store.getState()?.party;
  const cur = currentPartyTrack();
  try {
    if (p.role !== 'dj') return true; // swallow: listeners can't control room audio
    if (p.status === 'playing') {
      let pos = p.anchorPosMs || 0;
      try {
        pos = Math.round((await TrackPlayer.getPosition()) * 1000);
      } catch (e) {}
      socket.emit('dj:pause-at', { roomId: p.roomId, positionMs: pos });
    } else if (cur) {
      if (p.status === 'paused') {
        socket.emit('dj:play-at', {
          roomId: p.roomId,
          queueId: cur.queueId,
          positionMs: p.anchorPosMs || 0,
          playAtServerMs: Date.now() + 1500,
        });
      } else {
        socket.emit('dj:load', {
          roomId: p.roomId,
          queueId: cur.queueId,
          positionMs: 0,
          playAtServerMs: Date.now() + 2500,
        });
      }
    }
  } catch (e) {}
  return true;
}

/** Same routing for notification next/prev. Returns true when consumed. */
export async function partyStep(dir) {
  if (!roomOwnsAudio()) return false;
  try {
    const p = store.getState()?.party;
    if (p.role !== 'dj') return true; // swallow listener taps
    socket.emit(dir > 0 ? 'dj:next' : 'dj:prev', { roomId: p.roomId });
  } catch (e) {}
  return true;
}

/**
 * Party-aware seek for the player-screen slider, the Android notification /
 * lock-screen scrub bar and Bluetooth/AVRCP seek. Returns true when a room owns
 * audio (caller must NOT touch TrackPlayer):
 *  - Listener: swallowed — only the DJ may move the room's playhead.
 *  - DJ: broadcast through `dj:seek-at` so every device (including this one)
 *    seeks from the same server-stamped anchor instead of desyncing.
 */
export async function partySeek(positionSec) {
  if (!roomOwnsAudio()) return false;
  try {
    const p = store.getState()?.party;
    if (p.role !== 'dj') return true; // swallow listener seeks
    socket.emit('dj:seek-at', {
      roomId: p.roomId,
      positionMs: Math.round(Math.max(0, Number(positionSec) || 0) * 1000),
    });
  } catch (e) {}
  return true;
}

export async function loadPartyBundle(bundle, positionSec = 0) {
  if (!bundle?.url) throw new Error('No stream URL for this track');
  await ensurePlayerReady();
  await TrackPlayer.reset();
  await TrackPlayer.add([{
    id: bundle.queueId || bundle.videoId,
    url: bundle.url,
    title: bundle.title || 'Party track',
    artist: bundle.artists || '',
    artwork: bundle.thumb || undefined,
    duration: bundle.durationSec || undefined,
    headers: bundle.headers || undefined,
    contentType: bundle.contentType || 'audio/mp4',
    userAgent: bundle.userAgent || undefined,
  }]);
  if (positionSec > 0.5) {
    try {
      await TrackPlayer.seekTo(positionSec);
    } catch (e) {}
  }
}

export async function ensurePlaying() {
  try {
    const st = await TrackPlayer.getState();
    if (st !== State.Playing) await TrackPlayer.play();
  } catch (e) {}
}

export async function pauseParty() {
  try {
    await TrackPlayer.pause();
  } catch (e) {}
}

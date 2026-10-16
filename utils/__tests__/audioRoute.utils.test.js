import { NativeModules } from 'react-native';

NativeModules.AudioRouteModule = {
  setRoute: jest.fn().mockImplementation((r) => Promise.resolve(r)),
  resetRoute: jest.fn().mockResolvedValue('speaker'),
  getAvailableRoutes: jest.fn().mockResolvedValue({
    speaker: true,
    bluetooth: true,
    headphones: false,
    currentRoute: 'speaker',
  }),
};

import {
  applyAudioOutput,
  setAudioOutputMode,
  toggleAudioOutput,
  getAudioOutputMode,
  setMuteIncomingSound,
  isIncomingAudioMuted,
  getAvailableAudioRoutes,
  resetAudioOutput,
} from '../audioRoute.utils';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    setVolume: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('audioRoute.utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('defaults to speaker mode and unmuted', () => {
    expect(getAudioOutputMode()).toBe('speaker');
    expect(isIncomingAudioMuted()).toBe(false);
  });

  test('applyAudioOutput applies speaker mode to AudioRouteModule', async () => {
    await applyAudioOutput('speaker');
    expect(NativeModules.AudioRouteModule.setRoute).toHaveBeenCalledWith('speaker');
    expect(getAudioOutputMode()).toBe('speaker');
  });

  test('setAudioOutputMode changes to bluetooth mode', async () => {
    const dispatch = jest.fn();
    await setAudioOutputMode('bluetooth', dispatch);
    expect(NativeModules.AudioRouteModule.setRoute).toHaveBeenCalledWith('bluetooth');
    expect(dispatch).toHaveBeenCalled();
    expect(getAudioOutputMode()).toBe('bluetooth');
  });

  test('toggleAudioOutput cycles routes between speaker and bluetooth', async () => {
    const dispatch = jest.fn();
    // Start at speaker -> next is bluetooth
    await setAudioOutputMode('speaker', dispatch);
    const next1 = await toggleAudioOutput(dispatch);
    expect(next1).toBe('bluetooth');

    // bluetooth -> speaker
    const next2 = await toggleAudioOutput(dispatch);
    expect(next2).toBe('speaker');
  });

  test('resetAudioOutput calls native resetRoute and restores speaker', async () => {
    await resetAudioOutput();
    expect(NativeModules.AudioRouteModule.resetRoute).toHaveBeenCalled();
    expect(getAudioOutputMode()).toBe('speaker');
  });

  test('setMuteIncomingSound toggles mute and sets TrackPlayer volume', async () => {
    const dispatch = jest.fn();
    const TrackPlayer = require('react-native-track-player').default;

    await setMuteIncomingSound(true, dispatch);
    expect(isIncomingAudioMuted()).toBe(true);
    expect(TrackPlayer.setVolume).toHaveBeenCalledWith(0);
    expect(dispatch).toHaveBeenCalled();

    await setMuteIncomingSound(false, dispatch);
    expect(isIncomingAudioMuted()).toBe(false);
    expect(TrackPlayer.setVolume).toHaveBeenCalledWith(0.5);
  });

  test('getAvailableAudioRoutes returns available routes object', async () => {
    const routes = await getAvailableAudioRoutes();
    expect(routes).toHaveProperty('speaker');
    expect(routes).toHaveProperty('bluetooth');
    expect(routes).not.toHaveProperty('earpiece');
  });
});

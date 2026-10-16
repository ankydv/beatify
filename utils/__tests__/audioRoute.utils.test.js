import { NativeModules } from 'react-native';

NativeModules.AudioRouteModule = {
  setRoute: jest.fn().mockImplementation((r) => Promise.resolve(r)),
  resetRoute: jest.fn().mockResolvedValue('speaker'),
  getAvailableRoutes: jest.fn().mockResolvedValue({
    speaker: true,
    earpiece: true,
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

  test('setAudioOutputMode changes to earpiece mode', async () => {
    const dispatch = jest.fn();
    await setAudioOutputMode('earpiece', dispatch);
    expect(NativeModules.AudioRouteModule.setRoute).toHaveBeenCalledWith('earpiece');
    expect(dispatch).toHaveBeenCalled();
    expect(getAudioOutputMode()).toBe('earpiece');
  });

  test('setAudioOutputMode changes to bluetooth_hq mode', async () => {
    const dispatch = jest.fn();
    await setAudioOutputMode('bluetooth_hq', dispatch);
    expect(NativeModules.AudioRouteModule.setRoute).toHaveBeenCalledWith('bluetooth_hq');
    expect(dispatch).toHaveBeenCalled();
    expect(getAudioOutputMode()).toBe('bluetooth_hq');
  });

  test('setAudioOutputMode changes to bluetooth mode', async () => {
    const dispatch = jest.fn();
    await setAudioOutputMode('bluetooth', dispatch);
    expect(NativeModules.AudioRouteModule.setRoute).toHaveBeenCalledWith('bluetooth');
    expect(dispatch).toHaveBeenCalled();
    expect(getAudioOutputMode()).toBe('bluetooth');
  });

  test('toggleAudioOutput cycles routes', async () => {
    const dispatch = jest.fn();
    // bluetooth -> speaker
    await setAudioOutputMode('bluetooth', dispatch);
    const next1 = await toggleAudioOutput(dispatch);
    expect(next1).toBe('speaker');

    // speaker -> earpiece
    const next2 = await toggleAudioOutput(dispatch);
    expect(next2).toBe('earpiece');

    // earpiece -> bluetooth_hq
    const next3 = await toggleAudioOutput(dispatch);
    expect(next3).toBe('bluetooth_hq');

    // bluetooth_hq -> bluetooth
    const next4 = await toggleAudioOutput(dispatch);
    expect(next4).toBe('bluetooth');
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
    expect(routes).toHaveProperty('earpiece');
    expect(routes).toHaveProperty('bluetooth');
  });
});

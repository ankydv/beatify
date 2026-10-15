import { applyAudioOutput, setAudioOutputMode, toggleAudioOutput, getAudioOutputMode } from '../audioRoute.utils';
import { Audio } from 'expo-av';

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('audioRoute.utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('defaults to speaker mode', () => {
    expect(getAudioOutputMode()).toBe('speaker');
  });

  test('applyAudioOutput applies speaker mode to expo-av', async () => {
    await applyAudioOutput('speaker');
    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        playThroughEarpieceAndroid: false,
      })
    );
    expect(getAudioOutputMode()).toBe('speaker');
  });

  test('setAudioOutputMode changes to earpiece mode', async () => {
    const dispatch = jest.fn();
    await setAudioOutputMode('earpiece', dispatch);
    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        playThroughEarpieceAndroid: true,
      })
    );
    expect(dispatch).toHaveBeenCalled();
    expect(getAudioOutputMode()).toBe('earpiece');
  });

  test('toggleAudioOutput toggles from earpiece back to speaker', async () => {
    const dispatch = jest.fn();
    const nextMode = await toggleAudioOutput(dispatch);
    expect(nextMode).toBe('speaker');
    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        playThroughEarpieceAndroid: false,
      })
    );
  });
});

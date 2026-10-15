import { Audio } from 'expo-av';
import { AppState, Platform } from 'react-native';

let currentAudioOutput = 'speaker'; // 'speaker' | 'earpiece'

/**
 * Apply the current or specified audio routing output.
 * Ensures the device uses the loudspeaker (MODE_NORMAL + setSpeakerphoneOn(true))
 * or the in-call earpiece (MODE_IN_COMMUNICATION + setSpeakerphoneOn(false)).
 */
export async function applyAudioOutput(targetMode) {
  if (targetMode === 'speaker' || targetMode === 'earpiece') {
    currentAudioOutput = targetMode;
  }
  const isEarpiece = currentAudioOutput === 'earpiece';

  try {
    if (Audio?.setAudioModeAsync) {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: isEarpiece,
      });
    }
  } catch (err) {
    console.warn('[audioRoute] setAudioModeAsync error:', err?.message || err);
  }

  try {
    const { NativeModules } = require('react-native');
    if (NativeModules?.WebRTCModule?.setSpeakerphoneOn) {
      NativeModules.WebRTCModule.setSpeakerphoneOn(!isEarpiece);
    }
  } catch (err) {}

  return currentAudioOutput;
}

/**
 * Explicitly set the audio output mode and optionally sync with Redux.
 */
export async function setAudioOutputMode(mode, dispatch) {
  const normalized = mode === 'earpiece' ? 'earpiece' : 'speaker';
  currentAudioOutput = normalized;
  if (dispatch) {
    try {
      const { setAudioOutput } = require('@/state/slices/party.slice');
      dispatch(setAudioOutput(normalized));
    } catch (e) {
      try {
        const { setAudioOutput } = await import('@/state/slices/party.slice');
        dispatch(setAudioOutput(normalized));
      } catch (err) {}
    }
  }
  return applyAudioOutput(normalized);
}

/**
 * Toggle between Speaker and Earpiece.
 */
export async function toggleAudioOutput(dispatch) {
  const nextMode = currentAudioOutput === 'speaker' ? 'earpiece' : 'speaker';
  return setAudioOutputMode(nextMode, dispatch);
}

/**
 * Get current cached audio output mode.
 */
export function getAudioOutputMode() {
  return currentAudioOutput;
}

// Re-assert audio routing whenever the app resumes from lock screen / background.
// Android's AudioManager often reverts to earpiece on lock/unlock when communication mode is active.
if (Platform.OS === 'android') {
  AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      applyAudioOutput().catch(() => {});
    }
  });
}

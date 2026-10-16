import { AppState, Platform, NativeModules, NativeEventEmitter } from 'react-native';

/**
 * Global audio routing & playback sink state for Beatify.
 * Supported modes:
 *  - 'speaker': phone's loudspeaker (both WebRTC voice & TrackPlayer music)
 *  - 'earpiece': phone's top in-call receiver
 *  - 'bluetooth_hq': high-fidelity Bluetooth A2DP stereo audio (uses phone mic)
 *  - 'bluetooth': wireless headset / earbuds hands-free (earbuds mic & audio)
 */
let currentAudioOutput = 'speaker'; // 'speaker' | 'earpiece' | 'bluetooth_hq' | 'bluetooth'
let incomingMuted = false;

const routeEmitter =
  NativeModules.AudioRouteModule?.addListener && Platform.OS === 'android'
    ? new NativeEventEmitter(NativeModules.AudioRouteModule)
    : null;

/**
 * Apply the requested audio route to both native AudioManager (communication/voice)
 * and ExoPlayer (TrackPlayer music stream).
 *
 * @param {'speaker'|'earpiece'|'bluetooth_hq'|'bluetooth'} targetMode
 */
export async function applyAudioOutput(targetMode) {
  const mode = String(targetMode || currentAudioOutput).toLowerCase();
  if (mode === 'speaker' || mode === 'earpiece' || mode === 'bluetooth' || mode === 'bluetooth_hq') {
    currentAudioOutput = mode;
  }

  // 1. Native AudioRouteModule controls both Android AudioManager (WebRTC communication)
  // and ExoPlayer AudioTrack (TrackPlayer media stream).
  try {
    if (NativeModules?.AudioRouteModule?.setRoute) {
      await NativeModules.AudioRouteModule.setRoute(currentAudioOutput);
    }
  } catch (err) {
    console.warn('[audioRoute] Native AudioRouteModule.setRoute failed:', err?.message || err);
  }

  return currentAudioOutput;
}

/**
 * Hold a partial wake lock and high-perf wifi lock while in a room so
 * background playback / lock screen doesn't drop the connection.
 */
export async function acquirePartyLocks() {
  try {
    if (NativeModules?.AudioRouteModule?.acquirePartyLocks) {
      return await NativeModules.AudioRouteModule.acquirePartyLocks();
    }
  } catch (e) {
    console.warn('[audioRoute] acquirePartyLocks failed:', e?.message || e);
  }
  return false;
}

/**
 * Release wake and wifi locks when leaving the party room.
 */
export async function releasePartyLocks() {
  try {
    if (NativeModules?.AudioRouteModule?.releasePartyLocks) {
      return await NativeModules.AudioRouteModule.releasePartyLocks();
    }
  } catch (e) {
    console.warn('[audioRoute] releasePartyLocks failed:', e?.message || e);
  }
  return false;
}

/**
 * Reset audio routing back to normal system behavior when leaving room or destroying player.
 */
export async function resetAudioOutput() {
  currentAudioOutput = 'speaker';
  try {
    await releasePartyLocks();
  } catch (e) {}
  try {
    if (NativeModules?.AudioRouteModule?.resetRoute) {
      await NativeModules.AudioRouteModule.resetRoute();
    }
  } catch (e) {
    console.warn('[audioRoute] resetRoute failed:', e?.message || e);
  }
  return currentAudioOutput;
}

/**
 * Query available audio hardware routes (speaker, earpiece, bluetooth, headphones).
 * Returns true for bluetooth when a wireless headset or speaker is physically connected.
 */
export async function getAvailableAudioRoutes() {
  try {
    if (NativeModules?.AudioRouteModule?.getAvailableRoutes) {
      const routes = await NativeModules.AudioRouteModule.getAvailableRoutes();
      return routes;
    }
  } catch (e) {
    console.warn('[audioRoute] getAvailableRoutes failed:', e?.message || e);
  }

  // Fallback defaults if native module is not ready
  return {
    speaker: true,
    earpiece: true,
    bluetooth: false,
    headphones: false,
    currentRoute: currentAudioOutput,
  };
}

/**
 * Explicitly set the audio output mode and synchronize with Redux.
 */
export async function setAudioOutputMode(mode, dispatch) {
  const raw = String(mode || '').toLowerCase();
  const normalized =
    raw === 'earpiece' || raw === 'bluetooth' || raw === 'bluetooth_hq' ? raw : 'speaker';
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
 * Cycle through available audio output modes.
 */
export async function toggleAudioOutput(dispatch) {
  let nextMode = 'speaker';
  if (currentAudioOutput === 'speaker') {
    nextMode = 'earpiece';
  } else if (currentAudioOutput === 'earpiece') {
    nextMode = 'bluetooth_hq';
  } else if (currentAudioOutput === 'bluetooth_hq') {
    nextMode = 'bluetooth';
  } else {
    nextMode = 'speaker';
  }
  return setAudioOutputMode(nextMode, dispatch);
}

/**
 * Mute or unmute all incoming room audio (both background TrackPlayer music
 * and incoming participants' WebRTC voices).
 *
 * @param {boolean} muted
 * @param {Function} [dispatch]
 */
export async function setMuteIncomingSound(muted, dispatch) {
  incomingMuted = !!muted;

  if (dispatch) {
    try {
      const { setMuteIncoming } = require('@/state/slices/party.slice');
      dispatch(setMuteIncoming(incomingMuted));
    } catch (e) {
      try {
        const { setMuteIncoming } = await import('@/state/slices/party.slice');
        dispatch(setMuteIncoming(incomingMuted));
      } catch (err) {}
    }
  }

  // Adjust TrackPlayer volume (0 when muted, 0.5 normal)
  try {
    const TrackPlayer = require('react-native-track-player').default;
    await TrackPlayer.setVolume(incomingMuted ? 0 : 0.5);
  } catch (e) {}

  return incomingMuted;
}

/**
 * Get current cached audio output mode ('speaker' | 'earpiece' | 'bluetooth').
 */
export function getAudioOutputMode() {
  return currentAudioOutput;
}

/**
 * Check if incoming audio is muted.
 */
export function isIncomingAudioMuted() {
  return incomingMuted;
}

/**
 * Subscribe to hardware audio route changes (e.g. bluetooth connects / disconnects).
 */
export function subscribeAudioRoutesChanged(callback) {
  if (!routeEmitter) return () => {};
  const sub = routeEmitter.addListener('onAudioRoutesChanged', callback);
  return () => {
    try {
      sub.remove();
    } catch (e) {}
  };
}

// Re-assert audio routing whenever the app resumes from lock screen / background.
// Android's AudioManager often reverts communication routing on lock/unlock.
if (Platform.OS === 'android') {
  AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      applyAudioOutput().catch(() => {});
    }
  });

  // Re-assert audio routing whenever a new track loads or starts in TrackPlayer
  try {
    const TrackPlayer = require('react-native-track-player').default;
    const { Event } = require('react-native-track-player');
    if (TrackPlayer?.addEventListener && Event) {
      if (Event.PlaybackTrackChanged) {
        TrackPlayer.addEventListener(Event.PlaybackTrackChanged, () => {
          applyAudioOutput().catch(() => {});
        });
      }
      if (Event.PlaybackState) {
        TrackPlayer.addEventListener(Event.PlaybackState, () => {
          applyAudioOutput().catch(() => {});
        });
      }
    }
  } catch (e) {}
}

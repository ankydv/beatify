import { AppState, Platform, NativeModules, NativeEventEmitter } from 'react-native';

/**
 * Global audio routing & playback sink state for Beatify.
 * Supported modes:
 *  - 'speaker': phone's loudspeaker (both WebRTC voice & TrackPlayer music in stereo)
 *  - 'bluetooth': high-fidelity Bluetooth A2DP stereo playback (uses phone mic)
 */
let currentAudioOutput = 'speaker'; // 'speaker' | 'bluetooth'
let incomingMuted = false;
let isPartyAudioActive = false;

const routeEmitter =
  NativeModules.AudioRouteModule?.addListener && Platform.OS === 'android'
    ? new NativeEventEmitter(NativeModules.AudioRouteModule)
    : null;

/**
 * Mark whether a party voice room is currently active.
 */
export function setPartyAudioActive(active) {
  isPartyAudioActive = Boolean(active);
  if (!active) {
    resetAudioOutput().catch(() => {});
  }
}

export function isPartyAudioSession() {
  return isPartyAudioActive;
}

/**
 * Apply the requested audio route to both native AudioManager and ExoPlayer (TrackPlayer).
 *
 * @param {'speaker'|'bluetooth'} targetMode
 */
export async function applyAudioOutput(targetMode) {
  const mode = String(targetMode || currentAudioOutput).toLowerCase();
  currentAudioOutput = mode === 'bluetooth' || mode === 'bluetooth_hq' ? 'bluetooth' : 'speaker';
  isPartyAudioActive = true;

  // 1. Native AudioRouteModule controls both Android AudioManager (WebRTC communication)
  // and ExoPlayer AudioTrack (TrackPlayer media stream) during party voice rooms.
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
 * Passes the roomId through so the foreground notification can deep-link
 * straight back into the party screen.
 */
export async function acquirePartyLocks(roomId = null) {
  try {
    if (roomId && NativeModules?.AudioRouteModule?.startPartyVoiceServiceWithRoom) {
      await NativeModules.AudioRouteModule.startPartyVoiceServiceWithRoom(String(roomId));
    }
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
  isPartyAudioActive = false;
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
 * Query available audio hardware routes (speaker, bluetooth, headphones).
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
  const normalized = raw === 'bluetooth' || raw === 'bluetooth_hq' ? 'bluetooth' : 'speaker';
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
 * Cycle through available audio output modes (speaker <-> bluetooth).
 */
export async function toggleAudioOutput(dispatch) {
  const routes = await getAvailableAudioRoutes();
  let nextMode = 'speaker';
  if (currentAudioOutput === 'speaker' && routes?.bluetooth) {
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

// Re-assert audio routing ONLY when a party voice room is currently active.
// Android's AudioManager often reverts communication routing on lock/unlock during calls.
if (Platform.OS === 'android') {
  AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active' && isPartyAudioActive) {
      applyAudioOutput().catch(() => {});
    }
  });

  // NOTE: Standard media playback outside party rooms is left untouched to allow
  // Android system auto-routing (Bluetooth A2DP, wired headphones, speaker).
}

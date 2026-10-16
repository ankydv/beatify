import { Platform, PermissionsAndroid } from "react-native";
import {
  mediaDevices,
  RTCPeerConnection,
} from "react-native-webrtc";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// Create a new peer connection (one per remote peer in mesh mode)
export const createPeerConnection = () => {
  return new RTCPeerConnection(ICE_SERVERS);
};

// Android needs an explicit runtime RECORD_AUDIO grant before
// getUserMedia resolves — Expo dev-client does not auto-prompt for it.
export const ensureMicPermission = async () => {
  if (Platform.OS !== "android") return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: "Microphone access",
        message: "Beatify needs mic access for voice chat in party rooms.",
        buttonPositive: "Allow",
        buttonNegative: "Deny",
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (e) {
    console.warn("[voice] mic permission request failed:", e?.message ?? e);
    return false;
  }
};

// Get user media (audio only)
export const getLocalStream = async () => {
  try {
    return await mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  } catch (error) {
    console.error("[voice] Error accessing microphone:", error);
    throw error;
  }
};

// Toggle local mic tracks (real mute - stops sending audio)
export const setLocalMicEnabled = (localStream, enabled) => {
  if (!localStream) return;
  localStream.getAudioTracks().forEach((track) => {
    track.enabled = enabled;
  });
};

// Route remote audio to the loudspeaker (Android defaults to the
// earpiece once a mic stream is open, so voice sounds "dead").
// Integrates expo-av setAudioModeAsync and WebRTC native module.
export const setSpeakerphoneOn = (on = true) => {
  try {
    const { applyAudioOutput } = require("@/utils/audioRoute.utils");
    applyAudioOutput(on ? 'speaker' : 'bluetooth').catch(() => {});
  } catch (e) {
    try {
      const { NativeModules } = require("react-native");
      NativeModules?.WebRTCModule?.setSpeakerphoneOn?.(on);
    } catch (err) {}
  }
};

// Stop all local tracks (mic release on leave/unmount)
export const stopLocalStream = (localStream) => {
  if (!localStream) return;
  try {
    localStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (e) {}
    });
  } catch (e) {}
};

// Close every peer connection in a Map<peerId, pc>
export const closeAllPeerConnections = (peerConnectionsRef) => {
  const map = peerConnectionsRef?.current;
  if (!map) return;
  map.forEach((pc) => {
    try {
      pc.close();
    } catch (e) {}
  });
  map.clear();
};

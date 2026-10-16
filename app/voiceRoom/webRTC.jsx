import { socket } from "@/configs/socket";
import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  createPeerConnection,
  getLocalStream,
  ensureMicPermission,
  setLocalMicEnabled,
  stopLocalStream,
  closeAllPeerConnections,
} from "@/utils/webrtc.utils";
import { applyAudioOutput, resetAudioOutput } from "@/utils/audioRoute.utils";
import {
  RTCSessionDescription,
  RTCIceCandidate,
  RTCView,
  mediaDevices,
} from "react-native-webrtc";

// Socket.io ids are ~20-char random strings; Clerk user ids look like
// "user_xxx". Signaling targets (`to`/`from`) are ALWAYS socket ids.
const isSocketId = (id) =>
  typeof id === "string" && !id.startsWith("user_") && id.length >= 8;

// A participant entry may carry several id-ish fields after the server
// fix ({ id: socketId, userId: clerkId }); accept socket ids only.
const peerSocketId = (p) => {
  if (!p) return null;
  const cands = [p.id, p.socketId, p.sid];
  for (const c of cands) if (isSocketId(c)) return c;
  return null;
};

// Mesh voice room: one RTCPeerConnection per remote peer.
const WebRTCClient = ({
  roomId,
  participantsList = [],
  muted = false,
  muteIncoming = false,
  audioOutput = 'speaker',
}) => {
  const pcsRef = useRef(new Map());
  const queuesRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const mountedRef = useRef(true);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [voiceError, setVoiceError] = useState(null);

  const remoteCount = Object.keys(remoteStreams).length;

  const addRemoteStream = (peerId, stream) => {
    if (!mountedRef.current) return;
    setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
  };

  const removePeer = (peerId) => {
    const pc = pcsRef.current.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch (e) {}
      pcsRef.current.delete(peerId);
    }
    queuesRef.current.delete(peerId);
    if (mountedRef.current) {
      setRemoteStreams((prev) => {
        if (!(peerId in prev)) return prev;
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
    }
  };

  const flushQueue = async (peerId, pc) => {
    const q = queuesRef.current.get(peerId);
    if (!q || q.length === 0) return;
    queuesRef.current.set(peerId, []);
    for (const candidate of q) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("[voice] queued ICE failed for", peerId);
      }
    }
  };

  // Shared mic promise: signaling can arrive before getUserMedia
  // resolves — callers await this instead of answering track-less.
  const micPromiseRef = useRef(null);
  const pendingOffersRef = useRef([]); // [{ from, sdp }] answered after mic-ready
  const ensureMic = () => {
    if (localStreamRef.current) return Promise.resolve(localStreamRef.current);
    if (!micPromiseRef.current) {
      micPromiseRef.current = (async () => {
        const ok = await ensureMicPermission();
        if (!ok) throw new Error("Mic permission denied");
        const stream = await getLocalStream();
        if (!mountedRef.current) {
          stopLocalStream(stream);
          throw new Error("unmounted");
        }
        localStreamRef.current = stream;
        return stream;
      })().catch((e) => {
        // Allow a retry on next call
        micPromiseRef.current = null;
        throw e;
      });
    }
    return micPromiseRef.current;
  };

  // Attach mic tracks to a PC that was created before the mic was ready.
  const attachMicIfNeeded = async (peerId, pc) => {
    try {
      const stream = await ensureMic();
      if (!mountedRef.current) return;
      const hasAudioSender = pc.getSenders?.().some((s) => s.track?.kind === "audio");
      if (!hasAudioSender) {
        stream.getAudioTracks().forEach((track) => {
          try {
            pc.addTrack(track, stream);
          } catch (e) {}
        });
        // Renegotiate so the new m-line actually reaches the peer
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false,
          });
          await pc.setLocalDescription(offer);
          socket.emit("offer", {
            sdp: { type: offer.type, sdp: offer.sdp },
            roomId,
            to: peerId,
          });
        } catch (e) {}
      }
    } catch (e) {}
  };

  const getOrCreatePC = (peerId) => {
    let pc = pcsRef.current.get(peerId);
    if (pc) return pc;
    pc = createPeerConnection();
    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, localStream);
        } catch (e) {}
      });
    }
    pc.onicecandidate = (event) => {
      if (event.candidate && socket.connected) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          roomId,
          to: peerId,
        });
      }
    };
    pc.oniceconnectionstatechange = () => {
      console.log("[voice] ICE " + peerId + ":", pc.iceConnectionState);
    };
    pc.ontrack = (event) => {
      // Fallback: some RN-WebRTC builds deliver onaddstream / empty
      // event.streams — build a MediaStream from the track if needed.
      let stream = event.streams && event.streams[0];
      if (!stream && event.track) {
        try {
          const { MediaStream } = require("react-native-webrtc");
          stream = new MediaStream([event.track]);
        } catch (e) {}
      }
      if (stream) {
        const tracks = stream.getAudioTracks?.() ?? [];
        if (muteIncoming) {
          tracks.forEach((t) => {
            t.enabled = false;
          });
        }
        console.log(
          "[voice] remote audio from",
          peerId,
          "tracks:",
          tracks.length,
          "live:",
          tracks.map((t) => t.readyState + "/" + (t.enabled ? "on" : "off")).join(",")
        );
        addRemoteStream(peerId, stream);
      } else {
        console.warn("[voice] ontrack with no stream/track from", peerId);
      }
    };
    pcsRef.current.set(peerId, pc);
    return pc;
  };

  const offerToPeer = async (peerId) => {
    if (!isSocketId(peerId)) {
      console.log("[voice] skip offer to non-socket id:", peerId);
      return;
    }
    if (peerId === socket.id) return;
    try {
      // Mic MUST be ready before offer — otherwise the SDP has no
      // audio m-line and the peer will never get ontrack.
      await ensureMic();
      if (!mountedRef.current) return;
      const pc = getOrCreatePC(peerId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);
      socket.emit("offer", {
        sdp: { type: offer.type, sdp: offer.sdp },
        roomId,
        to: peerId,
      });
      console.log("[voice] offer sent to", peerId);
    } catch (e) {
      console.warn("[voice] offer failed:", e?.message ?? e);
    }
  };

  const maybeOfferToPeer = (peerId) => {
    if (!isSocketId(peerId)) return;
    if (!socket.id || peerId === socket.id) return;
    if (socket.id < peerId) offerToPeer(peerId);
  };
  // --- signaling -----------------------------------------------------
  useEffect(() => {
    mountedRef.current = true;

    const startVoice = async () => {
      try {
        await applyAudioOutput(audioOutput).catch(() => {});
        const stream = await ensureMic();
        if (!mountedRef.current) {
          stopLocalStream(stream);
          return;
        }
        setLocalMicEnabled(stream, !muted);
        console.log("[voice] mic ready for room", roomId);
        try {
          const senders = stream.getAudioTracks?.() ?? [];
          console.log(
            "[voice] local tracks:",
            senders.map((t) => t.kind + "/" + t.readyState + "/" + (t.enabled ? "on" : "off")).join(",")
          );
        } catch (e) {}
        // Answer any offers that arrived before the mic was ready
        const pending = pendingOffersRef.current.splice(0);
        pending.forEach(({ from, sdp }) => handleOffer(from, sdp));
        (participantsList ?? []).forEach((p) => {
          const id = peerSocketId(p);
          if (id && id !== socket.id) maybeOfferToPeer(id);
        });
      } catch (e) {
        if (mountedRef.current) {
          setVoiceError("Microphone unavailable. Chat still works.");
        }
      }
    };

    const handleOffer = async (from, sdp) => {
      // Mic MUST be ready before answering — a track-less answer means
      // the offerer never gets ontrack and hears silence forever.
      try {
        await ensureMic();
      } catch (e) {
        return; // startVoice error path already surfaced voiceError
      }
      if (!mountedRef.current) return;
      try {
        const pc = getOrCreatePC(from);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushQueue(from, pc);
        await attachMicIfNeeded(from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", {
          sdp: { type: answer.type, sdp: answer.sdp },
          roomId,
          to: from,
        });
        console.log("[voice] answered", from);
      } catch (e) {
        console.warn("[voice] offer failed:", e?.message ?? e);
      }
    };

    const onOffer = async ({ from, sdp }) => {
      if (!from || from === socket.id || !sdp) return;
      if (!localStreamRef.current && !micPromiseRef.current) {
        // Mic not started yet — queue and answer once it is.
        pendingOffersRef.current.push({ from, sdp });
        ensureMic().catch(() => {});
        return;
      }
      if (!localStreamRef.current) {
        pendingOffersRef.current.push({ from, sdp });
        return;
      }
      handleOffer(from, sdp);
    };

    const onAnswer = async ({ from, sdp }) => {
      if (!from || !sdp) return;
      const pc = pcsRef.current.get(from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushQueue(from, pc);
        // If we offered before our mic was ready, attach + renegotiate now
        await attachMicIfNeeded(from, pc);
        console.log("[voice] connected to", from);
      } catch (e) {
        console.warn("[voice] answer failed:", e?.message ?? e);
      }
    };

    const onIce = async ({ from, candidate }) => {
      if (!from || !candidate) return;
      const pc = pcsRef.current.get(from);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {}
      } else {
        const q = queuesRef.current.get(from) ?? [];
        q.push(candidate);
        queuesRef.current.set(from, q);
      }
    };

    const onUserJoined = ({ userId }) => {
      if (isSocketId(userId) && userId !== socket.id) maybeOfferToPeer(userId);
    };

    const onUserLeft = ({ userId }) => {
      if (userId) removePeer(userId);
    };

    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIce);
    socket.on("user-joined", onUserJoined);
    socket.on("user-left", onUserLeft);

    startVoice();

    return () => {
      mountedRef.current = false;
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIce);
      socket.off("user-joined", onUserJoined);
      resetAudioOutput().catch(() => {});
      closeAllPeerConnections(pcsRef);
      stopLocalStream(localStreamRef.current);
      localStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Synchronize audio output destination whenever it changes
  useEffect(() => {
    if (mountedRef.current) {
      applyAudioOutput(audioOutput).catch(() => {});
    }
  }, [audioOutput]);

  useEffect(() => {
    if (!localStreamRef.current) return;
    (participantsList ?? []).forEach((p) => {
      const id = peerSocketId(p);
      if (id && id !== socket.id && !pcsRef.current.has(id)) {
        maybeOfferToPeer(id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantsList]);

  useEffect(() => {
    setLocalMicEnabled(localStreamRef.current, !muted);
  }, [muted]);

  useEffect(() => {
    Object.values(remoteStreams).forEach((stream) => {
      stream?.getAudioTracks?.()?.forEach((track) => {
        track.enabled = !muteIncoming;
      });
    });
  }, [remoteStreams, muteIncoming]);

  const entries = Object.entries(remoteStreams);

  return (
    <View style={styles.wrap} pointerEvents="none">
      {entries.map(([peerId, stream]) => (
        <RTCView
          key={peerId}
          streamURL={stream.toURL()}
          style={styles.hidden}
          objectFit="cover"
          zOrder={0}
        />
      ))}
      {voiceError ? (
        <Text style={styles.err}>{voiceError}</Text>
      ) : (
        <Text style={styles.status}>
          {remoteCount > 0
            ? "Voice connected (" + remoteCount + ")"
            : "Voice on - waiting for others"}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { position: "absolute", width: 1, height: 1, opacity: 0 },
  hidden: { width: 1, height: 1 },
  status: { fontSize: 1, color: "transparent" },
  err: { fontSize: 11, color: "#ffca28" },
});
export default WebRTCClient;

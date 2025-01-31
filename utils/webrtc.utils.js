import { Audio } from "expo-av";
import { socket } from '@/configs/socket';
import { mediaDevices, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription } from "react-native-webrtc";

let candidateQueue = [];

const processCandidateQueue = async (peerConnection) => {
  while (candidateQueue.length > 0) {
    const candidate = candidateQueue.shift();
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log("Successfully added queued ICE candidate.");
    } catch (error) {
      console.error("Error adding queued ICE candidate:", error);
    }
  }
};

// Create a new peer connection
export const createPeerConnection = () => {
  return new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }, // Public STUN server
    ],
  });
};

// Handle incoming remote tracks and play them using expo-av
export const handleRemoteTrack = async (event, setRemoteStream) => {
  const remoteStream = event.streams[0]; // Get the remote stream
  console.log("Remote audio track received:", remoteStream.getAudioTracks());
};

// Get user media (audio only)
export const getLocalStream = async () => {
  try {
    return await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
  } catch (error) {
    console.error("Error accessing media devices:", error);
    throw error;
  }
};

// Setup socket signaling handlers
export const setupSignalingHandlers = (peerConnection, roomId) => {
  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { candidate: event.candidate, roomId });
    }
  };
  peerConnection.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", peerConnection.iceConnectionState);
  };
  

  // Handle incoming signaling events
  socket.on("offer", async ({ sdp }) => {
    try {
      if (!sdp || !sdp.type || !sdp.sdp) {
        throw new Error("Invalid SDP received");
      }
      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log("Remote description set for offer.");
      
      // Process queued ICE candidates
      processCandidateQueue(peerConnection);
  
      const answer = await peerConnection.createAnswer();
      console.log('answer'+answer)
      await peerConnection.setLocalDescription(answer);
      socket.emit("answer", { sdp: answer, roomId });
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  });
  
  // Socket event for receiving answers
  socket.on("answer", async ({ sdp }) => {
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log("Remote description set for answer.");
  
      // Process queued ICE candidates
      processCandidateQueue(peerConnection);
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  });

  socket.on("ice-candidate", async ({ candidate }) => {
    if (peerConnection.remoteDescription) {
      try {
        console.log("Received ICE candidate:", candidate);
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("Successfully added ICE candidate.");
      } catch (error) {
        console.error("Error adding received ICE candidate:", error);
      }
    } else {
      // Queue candidate if remote description is not set yet
      console.log("Queuing ICE candidate as remote description is not set.");
      candidateQueue.push(candidate);
    }
  });
};

// Clean up WebRTC resources
export const cleanupWebRTC = (peerConnection, remoteAudioRef) => {
  if (peerConnection) {
    peerConnection.close();
  }
  if (remoteAudioRef.current) {
    remoteAudioRef.current.unloadAsync();
  }
};

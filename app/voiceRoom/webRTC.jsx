import { socket } from "@/configs/socket";
import { useEffect, useRef, useState } from "react";
import {
  createPeerConnection,
  handleRemoteTrack,
  getLocalStream,
  setupSignalingHandlers,
  cleanupWebRTC,
} from "@/utils/webrtc.utils";
import { RTCView } from "react-native-webrtc";

const WebRTCClient = ({ roomId }) => {
  const peerConnectionRef = useRef(null);
  const remoteAudioRef = useRef(null); // For playing remote audio
  const localStreamRef = useRef(null);
  const [remoteStream, setRemoteStream] = useState(null);

  useEffect(() => {
    const startWebRTC = async () => {
      try {
        // Create PeerConnection
        const peerConnection = createPeerConnection();
        peerConnectionRef.current = peerConnection;
        setInterval(async () => {
          const stats = await peerConnection.getStats();
          stats.forEach((report) => {
            if (report.type === "candidate-pair" && report.state === "checking") {
              console.log("Candidate pair stuck in checking:", report);
            }
          });
        }, 5000);
        
        // Get local stream and add tracks
        const localStream = await getLocalStream();
        localStreamRef.current = localStream;
        localStream
          .getTracks()
          .forEach((track) => peerConnection.addTrack(track, localStream));

        // Handle signaling and incoming remote tracks
        setupSignalingHandlers(peerConnection, roomId);
        peerConnection.ontrack = (event) =>
          handleRemoteTrack(event, setRemoteStream);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        //Send the offer to the server
        socket.emit("offer", {
          sdp: {
            type: offer.type, // This should be "offer"
            sdp: offer.sdp, // The SDP string
          },
          roomId,
        });
        console.log(`WebRTC setup for room: ${roomId}`);
      } catch (error) {
        console.error("Error setting up WebRTC:", error);
      }
    };

    startWebRTC();
    
    return () => {
      // Clean up WebRTC resources
      cleanupWebRTC(peerConnectionRef.current, remoteAudioRef);
    };
  }, [roomId]);
  console.log(remoteStream &&  remoteStream);
  return (
    remoteStream && (
      <RTCView
        streamURL={remoteStream} // Convert MediaStream to a playable URL
        style={{ width: "100%", height: "100%" }} // Adjust to your layout
        objectFit="cover"
      />
    )
  );
};

export default WebRTCClient;

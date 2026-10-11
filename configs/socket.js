import { io } from 'socket.io-client';
import { Alert } from 'react-native';

let errorShown = false;

// Created eagerly so existing `socket.on/emit` call sites stay safe,
// but does not connect until initializeSocket() is called.
export const socket = io(process.env.EXPO_PUBLIC_AUTH_URL, {
  transports: ['websocket'],
  autoConnect: false,
});

socket.on("connect", () => {
  console.log("Connected to server:", socket.id);
});

socket.on("connect_error", () => {
  if (errorShown) return;
  Alert.alert("Connection Error", "Unable to connect to the server. Please check your internet connection and try again.");
  errorShown = true;
});

export const initializeSocket = async () => {
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
};

export const getSocket = () => socket;

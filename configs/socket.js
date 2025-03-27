import { io } from 'socket.io-client';
import { tokenManager } from '@/utils/token.utils'
import { refreshToken } from '@/services/auth.service';
import { Alert } from 'react-native';

let socket, errorShown = false;

const initializeSocket = async () => {
  if(socket) return socket;
   await refreshToken('google');
  const accessToken = await tokenManager.getGoogleAccessToken(); 
    console.log('connecting to server')
  socket = io(process.env.EXPO_PUBLIC_AUTH_URL, {
    transports: ['websocket'],
    auth: {
      token: accessToken,
    },
  });
  socket.on("connect", () => {
    console.log("Connected to server:", socket.id);
  });

  socket.on("connect_error", (err) => {
    if(errorShown) return;
    Alert.alert("Connection Error", "Unable to connect to the server. Please check your internet connection and try again.");
    errorShown = true;
    
  });
  return socket;
};

export { initializeSocket, socket };

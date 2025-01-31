import { io } from 'socket.io-client';
import { tokenManager } from '@/utils/token.utils'

let socket;

const initializeSocket = async () => {
  const authToken = await tokenManager.getAuthToken(); 
    console.log('connecting to server')
  socket = io(process.env.EXPO_PUBLIC_AUTH_URL, {
    transports: ['websocket'],
    auth: {
      token: authToken,
    },
  });

  return socket;
};

export { initializeSocket, socket };

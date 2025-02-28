import { loadAuthState } from "@/state/slices/auth.slice";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Linking } from "react-native";
import { useDispatch } from "react-redux";
import { initializeSocket } from '@/configs/socket'
import useAppUpdater from '@/hooks/updater.hooks';

const EventListeners = () => {
  const router = useRouter();
  const { checkForUpdates } = useAppUpdater();
 
  useEffect(() => {
    const handleUrl = (event) => {
      const { url } = event;
      if(url.includes('oauthredirect')){
        router.replace('/(tabs)/library');
          return;
      }
      if (url === 'trackplayer://notification.click') {
        router.replace('player');
      }
    };
    Linking.addEventListener('url', handleUrl);

    const setupSocket = async () => {
      await initializeSocket();

      socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });
    };
    if (!__DEV__) {
      console.log = () => {};
      console.warn = () => {};
    }
    // setupSocket();
    checkForUpdates();

  }, []);

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(loadAuthState());
  }, [dispatch]);
  
  return null;
}

export default EventListeners
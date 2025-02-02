import { loadAuthState } from "@/state/slices/auth.slice";
import { useNavigation } from "expo-router";
import { useEffect } from "react";
import { Linking } from "react-native";
import { useDispatch } from "react-redux";
import { initializeSocket } from '@/configs/socket'
import useAutoUpdate from '@/services/ota.service';

const EventListeners = () => {
  const navigation = useNavigation();

  // useAutoUpdate();

  useEffect(() => {
    const handleUrl = (event) => {
      const { url } = event;
      if(url.includes('oauthredirect'))
          console.log('handle oauth')
      if (url === 'trackplayer://notification.click') {
        navigation.navigate('player');
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

    setupSocket();


  }, []);

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(loadAuthState());
  }, [dispatch]);
  
  return null;
}

export default EventListeners
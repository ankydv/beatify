import { loadAuthState } from "@/state/slices/auth.slice";
import { useNavigation } from "expo-router";
import { useEffect } from "react";
import { Linking } from "react-native";
import { useDispatch } from "react-redux";

const EventListeners = () => {
  const navigation = useNavigation();
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
  }, []);

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(loadAuthState());
  }, [dispatch]);
  
  return null;
}

export default EventListeners
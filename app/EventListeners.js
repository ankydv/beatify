import { useNavigation } from "expo-router";
import { useEffect } from "react";
import { Linking } from "react-native";

const EventListeners = () => {
  const navigation = useNavigation();
  useEffect(() => {
    const handleUrl = (event) => {
      const { url } = event;
      if (url === 'trackplayer://notification.click') {
        navigation.navigate('player');
      }
    };
    Linking.addEventListener('url', handleUrl);
  }, []);
  return null;
}

export default EventListeners
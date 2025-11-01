import { loadAuthState } from "@/state/slices/auth.slice";
import {
  useNavigation,
  useRouter,
} from "expo-router";
import { useEffect } from "react";
import { Linking } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { initializeSocket, socket } from "@/configs/socket";
import useAppUpdater from "@/hooks/updater.hooks";
import getVisitorData from "@/services/visitorData.service";
import {useHistoryApi} from "@/hooks/library.hooks/history.hooks";
import { useAuth } from "@clerk/clerk-expo";
import {useAppUpdate} from "@/hooks/otaUpdate.hooks"


const EventListeners = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const { checkForUpdates } = useAppUpdater();
  const { metadata } = useSelector((state) => state.audio);
  const { addToHistory } = useHistoryApi();
  const { isSignedIn } = useAuth();

  useAppUpdate();

  useEffect(() => {
    getVisitorData();
    const handleUrl = (event) => {
      const { url } = event;
      if (url.includes("oauthredirect")) {
        router.replace("/(tabs)/library");
        return;
      }
      if (url === "trackplayer://notification.click") {
        if (navigation.getState()?.routes?.some((r) => r.name === "player")) {
          router.dismissTo("player");
        } else {
          router.replace("player");
        }
      }
    };
    Linking.addEventListener("url", handleUrl);

    const setupSocket = async () => {
      await initializeSocket();

      socket.on("connect", () => {
        console.log("Socket connected:", socket.id);
      });

      socket.on("disconnect", () => {
        console.log("Socket disconnected");
      });
    };
    if (!__DEV__) {
      console.log = () => {};
      console.warn = () => {};
      checkForUpdates();
      console.log(__DEV__);
    }
    // setupSocket();
    

    return () => {
      if (socket) {
        socket.disconnect();
        console.log("Socket disconnected");
      }
    };
  }, []);

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(loadAuthState());
  }, [dispatch]);

  useEffect(() => {
    if (metadata && isSignedIn) {
      console.log("Current Track Changed:", metadata.videoDetails.title);
      addToHistory(metadata).then(() => {
        console.log("Track added to history");
      }).catch((err) => {
        console.error("Failed to add track to history:", err);
      });
    }
  }, [metadata]);

  return null;
};

export default EventListeners;

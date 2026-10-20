import { setSongId } from "@/state/slices/audio.slice";
import {
  useNavigation,
  useRouter,
} from "expo-router";
import { useEffect, useRef } from "react";
import { Linking } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { disconnectSocket, initializeSocket, socket } from "@/configs/socket";
import useAppUpdater from "@/hooks/updater.hooks";
import getVisitorData from "@/services/visitorData.service";
import {useHistoryApi} from "@/hooks/library.hooks/history.hooks";
import { useAuth } from "@clerk/clerk-expo";
import {useAppUpdate} from "@/hooks/otaUpdate.hooks";


import { setMinimised } from "@/state/slices/party.slice";
import store from "@/state/store";

const EventListeners = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const { checkForUpdates } = useAppUpdater();
  const { metadata } = useSelector((state) => state.audio);
  const { addToHistory } = useHistoryApi();
  const { isSignedIn, getToken } = useAuth();

  useAppUpdate();

  useEffect(() => {
    getVisitorData();
    const handleUrl = (event) => {
      const { url } = event || {};
      if (!url) return;
      if (url.includes("oauthredirect")) {
        router.replace("/(tabs)/library");
        return;
      }
      if (url === "trackplayer://notification.click" || url.includes("notification.click")) {
        try {
          const state = store.getState();
          if (state?.party?.roomId) {
            store.dispatch(setMinimised(false));
          }
        } catch (navErr) {
          console.warn("[EventListeners] Notification click handler error:", navErr);
        }
        // Notification click routing is cleanly handled by app/notification.click.tsx
        return;
      }
    };
    const sub = Linking.addEventListener("url", handleUrl);
    Linking.getInitialURL().then((initUrl) => {
      if (initUrl) handleUrl({ url: initUrl });
    }).catch(() => {});

    if (!__DEV__) {
      console.log = () => {};
      console.warn = () => {};
      checkForUpdates();
      console.log(__DEV__);
    }
    return () => {
      sub?.remove?.();
      disconnectSocket();
      console.log("Socket disconnected");
    };
  }, []);

  // Auth-aware socket lifecycle: (re)connect with a fresh Clerk token
  // whenever the user signs in; disconnect on sign-out.
  useEffect(() => {
    if (!isSignedIn) {
      disconnectSocket();
      return;
    }

    const onSocketConnect = () => {
      console.log("Socket connected:", socket.id);
    };

    const onSocketDisconnect = () => {
      console.log("Socket disconnected");
    };

    socket.on("connect", onSocketConnect);
    socket.on("disconnect", onSocketDisconnect);

    initializeSocket(() => getToken()).catch((err) => {
      console.warn("[socket] initialize failed:", err?.message ?? err);
    });

    return () => {
      socket.off("connect", onSocketConnect);
      socket.off("disconnect", onSocketDisconnect);
    };
  }, [isSignedIn, getToken]);

  const dispatch = useDispatch();
  // Guard against double-POSTs: React StrictMode / re-renders can fire the
  // metadata effect twice for the same track. Backend is idempotent (upsert),
  // but this avoids the redundant network call entirely.
  const lastHistoryVideoIdRef = useRef(null);

  useEffect(() => {
    if (metadata && isSignedIn) {
      // Party-mirrored room tracks carry no _playableFormat (synthetic
      // metadata built from the DJ bundle) — never write those to history.
      if (metadata?._playableFormat == null && metadata?.videoDetails?.isPartyMirror) return;
      const videoId = metadata?.videoDetails?.videoId;
      if (videoId && lastHistoryVideoIdRef.current === videoId) return;
      if (videoId) lastHistoryVideoIdRef.current = videoId;
      addToHistory(metadata).then((res) => {
        dispatch(setSongId(res.history.song));
      }).catch((err) => {
        // Allow retry if the write failed.
        if (videoId) lastHistoryVideoIdRef.current = null;
        console.error("Failed to add track to history:", err);
      });
    }
  }, [metadata, isSignedIn, addToHistory, dispatch]);

  return null;
};

export default EventListeners;

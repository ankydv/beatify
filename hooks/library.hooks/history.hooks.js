import { useClerkAxios } from "@/hooks/auth.hooks";
import { useCallback } from "react";

/**
 * Add a song to user's listening history
 * @param {Object} songData - Song JSON (as body.song expected by backend)
 * @returns {Promise<Object>} Response from backend
 */
export const useHistoryApi = () => {

  const server = process.env.EXPO_PUBLIC_AUTH_URL;

  const api = useClerkAxios();

  // Memoized so consumers (e.g. EventListeners `useEffect([..., addToHistory])`)
  // don't re-fire on every render and double-POST the same play.
  const addToHistory = useCallback(async (songData) => {
    try {
      const res = await api.post(`${server}/api/history/add`, { song: songData.videoDetails });
      return res.data;
    } catch (error) {
      console.error("Error adding to history:", error.response?.data || error.message);
      throw error.response?.data || { message: "Failed to add to history" };
    }
  }, [api, server]);

  const getHistory = useCallback(async () => {
    try {
      const res = await api.get(`${server}/api/history`);
      return res.data;
    } catch (error) {
      console.error("Error fetching history:", error.response?.data || error.message);
      throw error.response?.data || { message: "Failed to fetch history" };
    }
  }, [api, server]);

  return { addToHistory, getHistory };
};

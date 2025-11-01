import { useClerkAxios } from "@/hooks/auth.hooks";

/**
 * Add a song to user's listening history
 * @param {Object} songData - Song JSON (as body.song expected by backend)
 * @returns {Promise<Object>} Response from backend
 */
export const useHistoryApi = () => {

  const server = process.env.EXPO_PUBLIC_AUTH_URL;

  const api = useClerkAxios();

  const addToHistory = async (songData) => {
    try {
      const res = await api.post(`${server}/api/history/add`, { song: songData.videoDetails });
      return res.data;
    } catch (error) {
      console.error("Error adding to history:", error.response?.data || error.message);
      throw error.response?.data || { message: "Failed to add to history" };
    }
  };

  const getHistory = async () => {
    try {
      const res = await api.get(`${server}/api/history`);
      return res.data;
    } catch (error) {
      console.error("Error fetching history:", error.response?.data || error.message);
      throw error.response?.data || { message: "Failed to fetch history" };
    }
  };

  return { addToHistory, getHistory };
};

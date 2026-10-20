import { useCallback } from "react";
import { useClerkAxios } from "@/hooks/auth.hooks"; // your authenticated axios hook

export const usePlaylistApi = () => {
  const server = process.env.EXPO_PUBLIC_AUTH_URL;
  const api = useClerkAxios();

  /**
   * Fetch all playlists.
   * structure: {playlists: [{ _id, name, songCount}, ...]}
   **/

  // useCallback: these are consumed in useEffect/useFocusEffect dep arrays —
  // without stable refs every render retriggers fetches (request storm).
  const getPlaylists = useCallback(async (songId) => {
    try {
      const res = await api.get(`${server}/api/playlists`, songId ? { params: { songId } } : {});
      return res.data;
    } catch (error) {
      console.error("Error fetching playlists:", error.response?.data || error.message);
      throw error.response?.data || { message: "Failed to fetch playlists" };
    }
  }, [api, server]);

  const getIsAddedAnyPlaylist = useCallback(async (songId) => {
    try {
      const res = await api.get(`${server}/api/playlists/`, { params: { songId, getIsAdded: true } });
      return res.data.isAdded;
    } catch (error) {
      console.error("Error checking if song is added to any playlist:", error.response?.data || error.message);
      throw error.response?.data || { message: "Failed to check song in playlists" };
    }
  }, [api, server]);

  const getPlaylistDetails = useCallback(async (playlistId) => {
    try {
      const res = await api.get(`${server}/api/playlists/${encodeURIComponent(playlistId)}`);
      return res.data;
    } catch (error) {
      console.error("Error fetching playlist details:", error.response?.data || error.message);
      throw error.response?.data || { message: "Failed to fetch playlist details" };
    }
  }, [api, server]);

  /**
   * Add a song to a playlist.
   * If playlistId is not provided but playlistName is, backend will create a new playlist.
   */
  const addSongToPlaylist = useCallback(async ({ playlistId, playlistName, song }) => {
    try {
      const res = await api.post(`${server}/api/playlists/add-song`, {
        playlistId,
        playlistName,
        song,
      });
      return res.data;
    } catch (error) {
      console.error("Error adding song to playlist:", error.response?.data || error.message);
      throw error.response?.data || { message: "Failed to add song to playlist" };
    }
  }, [api, server]);
  /**
   * Add a song to multiple playlists.
   * Payload structure:
   * {
   *   song: { videoId, title, ... },
   *   playlists: [
   *    { playlistId: "existingPlaylistId" },
   *   { playlistName: "New Playlist Name" }
   *  ]
   * }
   * If playlistId is not provided but playlistName is, backend will create a new playlist.
   * **/

  const addSongToMultiplePlaylists = useCallback(async (payload) => {
    try {
      const res = await api.post(`${server}/api/playlists/add-song-bulk`, payload);
      return res.data;
    } catch (error) {
      console.error("Error adding song to multiple playlists:", error.response?.data || error.message);
      throw error.response?.data || { message: "Failed to add song to multiple playlists" };
    }
  }, [api, server]);

  const removeSongFromPlaylist = useCallback(async ({ playlistId, songId }) => {
    try {
      const res = await api.delete(
        `${server}/api/playlists/remove-song/${encodeURIComponent(playlistId)}/song/${encodeURIComponent(songId)}`
      );
      return res.data;
    } catch (error) {
      console.error("Error removing song from playlist:", error.response?.data || error.message);
      throw error.response?.data || { message: "Failed to remove song from playlist" };
    }
  }, [api, server]);

  const deletePlaylist = useCallback(async (playlistId) => {
    try {
      const res = await api.delete(`${server}/api/playlists/delete/${encodeURIComponent(playlistId)}`);
      return res.data;
    } catch (error) {
      console.error("Error deleting playlist:", error.response?.data || error.message);
      throw error.response?.data || { message: "Failed to delete playlist" };
    }
  }, [api, server]);

  return { addSongToPlaylist, getPlaylists, getIsAddedAnyPlaylist, addSongToMultiplePlaylists, getPlaylistDetails, removeSongFromPlaylist, deletePlaylist };
};

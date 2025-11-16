import { useClerkAxios } from "@/hooks/auth.hooks"; // your authenticated axios hook

export const usePlaylistApi = () => {
  const server = process.env.EXPO_PUBLIC_AUTH_URL;
  const api = useClerkAxios();

  /**
   * Fetch all playlists.
   * structure: {playlists: [{ _id, name, songCount}, ...]}
   **/

  const getPlaylists = async (songId) => {
    try {
      const res = await api.get(`${server}/api/playlists`, songId ? { params: { songId } } : {});
      return res.data;
    } catch (error) {
      console.error("Error fetching playlists:", error.response?.data || error.message);
      throw error.response?.data || { message: "Failed to fetch playlists" };
    }
  };

  const getIsAddedAnyPlaylist = async (songId) => {
    try {
      const res = await api.get(`${server}/api/playlists/`, { params: { songId, getIsAdded: true } });
      return res.data.isAdded;
    } catch (error) {
      console.error("Error checking if song is added to any playlist:", error.response?.data || error.message);
      throw error.response?.data || { message: "Failed to check song in playlists" };
    }
  };

  const getPlaylistDetails = async (playlistId) => {
    try {
      const res = await api.get(`${server}/api/playlists/${playlistId}`);
      return res.data;
    } catch (error) {
      console.error("Error fetching playlist details:", error.response?.data || error.message);
      throw error.response?.data || { message: "Failed to fetch playlist details" };
    }
  };

  /**
   * Add a song to a playlist.
   * If playlistId is not provided but playlistName is, backend will create a new playlist.
   */
  const addSongToPlaylist = async ({ playlistId, playlistName, song }) => {
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
  };
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

  const addSongToMultiplePlaylists = async (payload) => {
    try {
      const res = await api.post(`${server}/api/playlists/add-song-bulk`, payload);
      return res.data;
    } catch (error) {
      console.error("Error adding song to multiple playlists:", error.response?.data || error.message);
      throw error.response?.data || { message: "Failed to add song to multiple playlists" };
    }
  };

  return { addSongToPlaylist, getPlaylists, getIsAddedAnyPlaylist, addSongToMultiplePlaylists, getPlaylistDetails };
};

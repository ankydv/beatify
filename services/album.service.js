import musicApi from "../configs/apiClient.config";

export const getAlbum = async (id, isPlaylist) => {
  try {
    const response = await musicApi.get(`/${isPlaylist==='true'?'playlist':'albuminfo'}/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching album info:", error);
    throw error;
  }
};

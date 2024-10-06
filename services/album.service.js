import musicApi from "../configs/apiClient.config";

export const getAlbum = async (id) => {
  try {
    const response = await musicApi.get(`/albuminfo/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching album info:", error);
    throw error;
  }
};

import musicApi from "../configs/apiClient.config";

export const getArtist = async (id) => {
  try {
    const response = await musicApi.get(`/artistinfo/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching album info:", error);
    throw error;
  }
};

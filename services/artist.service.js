import musicApi from '../configs/apiClient.config';

/**
 * Fetch artist details, top songs, albums, singles, and related artists
 * @param {string} id - Artist channel ID / browseId
 */
export const getArtist = async (id) => {
  try {
    const response = await musicApi.get(`/artistinfo/${encodeURIComponent(id)}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching artist info:', error?.response?.data || error.message);
    throw error;
  }
};

/**
 * Fetch all albums or singles for an artist
 * @param {string} id - Artist channel ID
 * @param {string} params - Parameters token from artist.albums.params
 */
export const getArtistAlbums = async (id, params) => {
  try {
    const response = await musicApi.get(`/artistalbums/${encodeURIComponent(id)}`, {
      params: params ? { params } : {},
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching artist albums:', error?.response?.data || error.message);
    throw error;
  }
};

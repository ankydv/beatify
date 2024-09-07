import axios from 'axios';

const BASE_URL = 'https://lrclib.net/api/search';

/**
 * Fetches lyrics for a song using the lrclib.net API.
 * Filters the results to find lyrics with duration within ±3 seconds and synced lyrics.
 * @param {string} artist_name - The name of the artist.
 * @param {string} track_name - The name of the track.
 * @param {number} duration - The duration of the track in seconds.
 * @returns {Promise<Object>} - Returns a Promise that resolves to the filtered lyrics object or null.
 */
export const fetchLyrics = async (artist_name, track_name, duration) => {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        artist_name: artist_name,
        track_name: track_name,
      }
    });
    if (response.data && Array.isArray(response.data)) {
      const filteredLyrics = response.data.find(
        (lyricsObj) => 
          Math.abs(lyricsObj.duration - duration) <= 3 && lyricsObj.syncedLyrics !== null
      );

      return filteredLyrics || null;
    } else {
      throw new Error('Lyrics not found');
    }
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    throw error;
  }
};


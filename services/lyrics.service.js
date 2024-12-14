import axios from 'axios';

const BASE_URL = 'https://lrclib.net/api/search';

/**
 * Fetches lyrics for a song using the lrclib.net API.
 * Filters and prioritizes lyrics based on the proportion of English words within the duration range.
 * @param {string} artist_name - The name of the artist.
 * @param {string} track_name - The name of the track.
 * @param {number} duration - The duration of the track in seconds.
 * @returns {Promise<Object>} - Returns a Promise that resolves to the best-matched lyrics object or null.
 */
export const fetchLyrics = async (artist_name, track_name, duration) => {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        // artist_name: artist_name,
        track_name: track_name,
      }
    });9

    if (response.data && Array.isArray(response.data)) {
      // Filter lyrics within the duration range and calculate English word ratio
      const candidates = response.data
        .filter(
          (lyricsObj) =>
            Math.abs(lyricsObj.duration - duration) <= 3 &&
            lyricsObj.syncedLyrics !== null
        )
        .map((lyricsObj) => {
          const totalWords = lyricsObj.syncedLyrics.split(/\s+/).length;
          const englishWords = lyricsObj.syncedLyrics.match(/\b[a-zA-Z]+\b/g)?.length || 0;
          const englishRatio = englishWords / totalWords;
          return { ...lyricsObj, englishRatio };
        });

      // Sort by English word ratio in descending order
      candidates.sort((a, b) => b.englishRatio - a.englishRatio);

      // Return the best match or null if no candidates
      return candidates.length > 0 ? candidates[0] : null;
    } else {
      throw new Error('Lyrics not found');
    }
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    throw error;
  }
};

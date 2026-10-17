import musicApi from '@/configs/apiClient.config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HOME_CACHE_KEY = 'homeDataCache';
const MOODS_CACHE_KEY = 'moodCategoriesCache';
const CACHE_EXPIRATION_TIME = 3600 * 1000; // 1 hour

/**
 * Fetch home screen recommendations with local caching
 */
export const getHome = async (forceRefresh = false) => {
  try {
    if (!forceRefresh) {
      const cached = await AsyncStorage.getItem(HOME_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRATION_TIME) {
          return data;
        }
      }
    }

    const response = await musicApi.get('/home');
    const freshData = response.data;

    await AsyncStorage.setItem(
      HOME_CACHE_KEY,
      JSON.stringify({ data: freshData, timestamp: Date.now() })
    );

    return freshData;
  } catch (error) {
    console.error('Error fetching home data:', error?.message || error);
    // Return stale cache if network fails
    const cached = await AsyncStorage.getItem(HOME_CACHE_KEY);
    if (cached) {
      const { data } = JSON.parse(cached);
      return data;
    }
    throw error;
  }
};

/**
 * Fetch mood and genre categories from ytmusicapi
 */
export const getMoodCategories = async () => {
  try {
    const cached = await AsyncStorage.getItem(MOODS_CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_EXPIRATION_TIME * 6) {
        return data;
      }
    }

    const response = await musicApi.get('/moods');
    const freshData = response.data;

    await AsyncStorage.setItem(
      MOODS_CACHE_KEY,
      JSON.stringify({ data: freshData, timestamp: Date.now() })
    );

    return freshData;
  } catch (error) {
    console.warn('Error fetching mood categories:', error?.message || error);
    // Fallback default moods & genres if network fails
    return {
      'Moods & moments': [
        { title: 'Chill', params: 'ggMPOg1uX1JOQWZFeDByc2Jm' },
        { title: 'Energize', params: 'ggMPOg1uX2lRZUZiMnNrQnJW' },
        { title: 'Focus', params: 'ggMPOg1uX044Z2o5WERLckpU' },
        { title: 'Party', params: 'ggMPOg1uX3VOQWxsblVZTFNE' },
        { title: 'Workout', params: 'ggMPOg1uX0UzWGxlRE5jMDVk' },
        { title: 'Romance', params: 'ggMPOg1uX1ZEZzBvYUp0TGNI' },
      ],
      'Genres': [
        { title: 'Pop', params: 'ggMPOg1uX1ZEZzBvYUp0TGNI' },
        { title: 'Hip-Hop', params: 'ggMPOg1uX2lRZUZiMnNrQnJW' },
        { title: 'Electronic', params: 'ggMPOg1uX0UzWGxlRE5jMDVk' },
        { title: 'Rock', params: 'ggMPOg1uX1JOQWZFeDByc2Jm' },
        { title: 'Bollywood', params: 'ggMPOg1uX3VOQWxsblVZTFNE' },
        { title: 'Indie', params: 'ggMPOg1uX044Z2o5WERLckpU' },
      ],
    };
  }
};

/**
 * Fetch mood playlists for a specific mood/genre param (deduplicated & capped for fluid UI performance)
 */
export const getMoodPlaylists = async (params, limit = 30) => {
  try {
    const response = await musicApi.get('/moods/playlists', {
      params: { params, limit },
    });
    const raw = Array.isArray(response.data) ? response.data : [];
    const seen = new Set();
    const deduped = [];
    for (const item of raw) {
      const key = item?.playlistId || item?.browseId || item?.title;
      if (key && !seen.has(key)) {
        seen.add(key);
        deduped.push(item);
        if (deduped.length >= limit) break;
      }
    }
    return deduped;
  } catch (error) {
    console.error('Error fetching mood playlists:', error?.message || error);
    return [];
  }
};

/**
 * Fetch explore feed (new releases, trending, moods)
 */
export const getExplore = async () => {
  try {
    const response = await musicApi.get('/explore');
    return response.data;
  } catch (error) {
    console.error('Error fetching explore feed:', error?.message || error);
    return null;
  }
};

/**
 * Fetch charts (top music videos, trending artists)
 */
export const getCharts = async (country = 'IN') => {
  try {
    const response = await musicApi.get('/charts', {
      params: { country },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching charts:', error?.message || error);
    return null;
  }
};

/**
 * Fetch related tracks and vibe recommendations based on a videoId
 */
export const getRelated = async (videoId) => {
  try {
    const response = await musicApi.get(`/related/${videoId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching related tracks:', error?.message || error);
    return null;
  }
};

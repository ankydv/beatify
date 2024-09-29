import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants for cache keys and cache sizes
const METADATA_KEY = 'metadataCache';
const METADATA_CACHE_SIZE = 25;

/**
 * Helper function to get the value of a nested object property based on a string like "videoDetails.videoId"
 */
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

/**
 * Retrieve cached data from AsyncStorage.
 */
const getCache = async (key) => {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    console.error(`Error retrieving cache for ${key} from AsyncStorage`, error);
    return [];
  }
};

/**
 * Store data into AsyncStorage.
 */
const setCache = async (key, data) => {
  try {
    const jsonValue = JSON.stringify(data);
    await AsyncStorage.setItem(key, jsonValue);
  } catch (error) {
    console.error(`Error setting cache for ${key} in AsyncStorage`, error);
  }
};

/**
 * Cache data with a size limit, ensuring data is retained across updates.
 */
const cacheData = async (key, newData, cacheSize, searchKey) => {
  try {
    // Step 1: Retrieve the current cache
    const cachedData = await getCache(key);

    // Step 2: Check if the data already exists in the cache using the helper function to access nested keys
    const existsIndex = cachedData.findIndex(item => getNestedValue(item, searchKey) === getNestedValue(newData, searchKey));

    // If the item is found (index >= 0), remove it so the new version can be added at the start
    if (existsIndex >= 0) {
      cachedData.splice(existsIndex, 1);
    }

    // Step 3: Add new data to the start of the array
    cachedData.unshift(newData);

    // Step 4: Limit the size of the cache
    if (cachedData.length > cacheSize) {
      cachedData.pop(); // Remove the last (oldest) item
    }

    // Step 5: Store the updated cache back to AsyncStorage
    await setCache(key, cachedData);
  } catch (error) {
    console.error(`Error caching data for ${key}:`, error);
  }
};

/**
 * Search the cache for a specific item based on a search key.
 */
const searchInCache = async (key, searchKey, searchValue) => {
  try {
    // Retrieve the cache
    const cachedData = await getCache(key);

    // Find the item by searchKey using the helper function for nested properties
    return cachedData.find(item => getNestedValue(item, searchKey) === searchValue);
  } catch (error) {
    console.error(`Error searching in cache for ${key}:`, error);
    return null;
  }
};

// Metadata-specific cache functions
export const cacheMetadata = async (newMetadata) => {
  await cacheData(METADATA_KEY, newMetadata, METADATA_CACHE_SIZE, 'videoDetails.videoId');
};

export const getCachedMetadata = async (videoId) => {
  return await searchInCache(METADATA_KEY, 'videoDetails.videoId', videoId);
};
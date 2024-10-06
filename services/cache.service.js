import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants for cache keys, cache sizes, and expiration times
const METADATA_KEY = 'metadataCache';
const METADATA_CACHE_SIZE = 25;
const EXPIRATION_MINUTES = 350; 

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
 * Cache data with a size limit and expiration, ensuring data is retained across updates.
 */
const cacheData = async (key, newData, cacheSize, searchKey) => {
  try {
    // Step 1: Retrieve the current cache
    const cachedData = await getCache(key);

    // Step 2: Set expiration time by calculating when it should expire
    const expirationTime = Date.now() + EXPIRATION_MINUTES * 60 * 1000;
    const dataWithExpiration = { ...newData, _expiration: expirationTime };

    // Step 3: Check if the data already exists in the cache using the helper function to access nested keys
    const existsIndex = cachedData.findIndex(item => getNestedValue(item, searchKey) === getNestedValue(newData, searchKey));

    // If the item is found (index >= 0), remove it so the new version can be added at the start
    if (existsIndex >= 0) {
      cachedData.splice(existsIndex, 1);
    }

    // Step 4: Add new data to the start of the array
    cachedData.unshift(dataWithExpiration);

    // Step 5: Limit the size of the cache
    if (cachedData.length > cacheSize) {
      cachedData.pop(); // Remove the last (oldest) item
    }

    // Step 6: Store the updated cache back to AsyncStorage
    await setCache(key, cachedData);
  } catch (error) {
    console.error(`Error caching data for ${key}:`, error);
  }
};

/**
 * Search the cache for a specific item based on a search key, considering expiration.
 */
const searchInCache = async (key, searchKey, searchValue) => {
  try {
    // Retrieve the cache
    const cachedData = await getCache(key);

    // Find the item by searchKey using the helper function for nested properties
    const item = cachedData.find(item => getNestedValue(item, searchKey) === searchValue);

    if (item) {
      // Step 1: Check expiration
      const currentTime = Date.now();
      const expirationTime = item._expiration;

      // Step 2: If the current time exceeds the expiration time, return null
      if (currentTime > expirationTime) {
        return null;
      }

      // Step 3: Return the cached item if not expired
      return item;
    }

    return null; // Item not found in cache
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

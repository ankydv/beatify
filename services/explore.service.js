import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'homeDataCache';
const CACHE_EXPIRATION_TIME = 3600 * 1000; // 1 hour in milliseconds
const SERVER = process.env.EXPO_PUBLIC_API_URL;
export const getHome = async () => {
  try {
    // Check if data exists in the cache
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);
    if (cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);
      const currentTime = new Date().getTime();

      // Check if the cache is still valid (not expired)
      if (currentTime - timestamp < CACHE_EXPIRATION_TIME) {
        console.log('Returning cached data');
        return data;
      }
    }

    // Fetch fresh data if cache is not valid or doesn't exist
    const response = await axios.get(`${SERVER}/api/home`);
    const freshData = response.data;

    // Save the fetched data to cache with the current timestamp
    const cacheObject = {
      data: freshData,
      timestamp: new Date().getTime(), // Store the current timestamp
    };

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheObject));

    console.log('Returning fresh data');
    return freshData;
  } catch (error) {
    console.error('Error fetching home data:', error);
    throw error;
  }
};

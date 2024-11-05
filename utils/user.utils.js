import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserProfile } from '@/services/user.service';  // Assumes you have a service function to get user profile

const USER_INFO_KEY = 'userInfo';
const ONE_HOUR = 3600 * 1000;  // 1 hour in milliseconds

/**
 * Retrieves user info from AsyncStorage if available and valid.
 * Otherwise, fetches from the API and updates AsyncStorage.
 * @param {string} accessToken - The access token to retrieve user info.
 * @returns {Promise<Object>} - Returns a promise that resolves to user profile data.
 */
export const getUser = async () => {
  try {
    // Retrieve the stored user info object from AsyncStorage
    const storedData = await AsyncStorage.getItem(USER_INFO_KEY);
    
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      const { userInfo, timestamp } = parsedData;
      const now = Date.now();
      
      // Check if the stored data is still within the 1-hour validity period
      if (now - timestamp < ONE_HOUR) {
        return userInfo; // Return valid cached user info
      }
    }

    // If no valid cached data, fetch fresh data from the API
    const userInfo = await getUserProfile();

    // Store both the user info and the current timestamp together in AsyncStorage
    const dataToStore = JSON.stringify({ userInfo, timestamp: Date.now() });
    await AsyncStorage.setItem(USER_INFO_KEY, dataToStore);

    return userInfo;
  } catch (error) {
    console.error('Error retrieving user info:', error);
    throw error;
  }
};

export const removeUser = async () => {
  await AsyncStorage.removeItem(USER_INFO_KEY);
}
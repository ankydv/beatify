import { googleAuthApi } from '@/configs/axios';

/**
 * Fetches the user's profile details using the YouTube API.
 * @returns {Promise<Object>} - Returns a promise that resolves to user profile data.
 */
export const getUserProfile = async () => {
  try {
    const response = await googleAuthApi.get('/userinfo'); // Call userinfo endpoint
    return response.data; // Returns user profile data
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

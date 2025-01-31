import axios from 'axios';
import { tokenManager } from '../utils/token.utils';

export const refreshToken = async (force = false) => {
  const CLIENT_ID = process.env.EXPO_PUBLIC_CLIENT_ID;
  // const CLIENT_SECRET = process.env.EXPO_PUBLIC_CLIENT_SECRET;
  try {
    const refreshToken = process.env.EXPO_PUBLIC_YT_REFRESH_TOKEN;
    const expiresAt = await tokenManager.getExpiry();
    const currentTime = Math.floor(Date.now() / 1000);

    if (expiresAt > currentTime && !force) {
      return; // Token is still valid
    }

    if (!refreshToken) {
      console.log('No refresh token found');
      return;
    }

    console.log('Token needs to be refreshed');
    const startTime = currentTime - 30;

    // Set up URL-encoded data
    const data = new URLSearchParams({
      client_id: CLIENT_ID,
      // client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    // Send request to refresh token
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      data,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    console.log(response.data)
    const { access_token, expires_in } = response.data;
    const expires = startTime + expires_in;

    // Save new tokens and expiry time
    await tokenManager.saveTokens(access_token, refreshToken, authToken=false, expires);
    console.log('Token refreshed successfully');
  } catch (error) {
    console.error(
      'Error refreshing token:',
      error.response ? error.response.data : error.message
    );
  }
};

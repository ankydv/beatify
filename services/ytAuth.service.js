import axios from 'axios';

const CLIENT_ID = process.env.EXPO_PUBLIC_CLIENT_ID;
const CLIENT_SECRET = process.env.EXPO_PUBLIC_CLIENT_SECRET;

/**
 * Requests the device code and returns the response data.
 */
export const getDeviceCode = async () => {
  const data = {
    client_id: CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/userinfo.profile',
  };

  try {
    const response = await axios.post(
      'https://oauth2.googleapis.com/device/code',
      data,
      { headers: { 'Content-Type': 'application/json' } }
    );

    return response.data;  // Returns { verification_url, user_code, device_code, expires_in, interval }
  } catch (error) {
    console.error('Error requesting device code:', error);
    throw error;
  }
};

/**
 * Requests the bearer token using the device code.
 */
export const getBearerToken = async (deviceCode) => {
  const tokenData = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  };

  try {
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      tokenData,
      { headers: { 'Content-Type': 'application/json' } }
    );

    return response.data;  // Returns { access_token, refresh_token, expires_in }
  } catch (error) {
    console.error('Error fetching bearer token:', error);
    throw error;
  }
};
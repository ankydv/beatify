import axios from 'axios';
import { refreshToken } from '@/services/auth.service'; 
import { tokenManager } from '../utils/token.utils';

// Create an Axios instance for YouTube API
const ytApi = axios.create({
  baseURL: 'https://www.googleapis.com/oauth2/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to ensure refreshToken() is called before every request
ytApi.interceptors.request.use(
  async (config) => {
    // Call refreshToken() to ensure a valid access token
    await refreshToken();

    // Set the Authorization header with the refreshed access token
    const accessToken = await tokenManager.getAccessToken();
    config.headers['Authorization'] = `Bearer ${accessToken}`;

    return config;
  },
  (error) => Promise.reject(error)
);

export default ytApi;

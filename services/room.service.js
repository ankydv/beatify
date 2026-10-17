import axios from 'axios';

const AUTH_URL = (process.env.EXPO_PUBLIC_AUTH_URL || 'http://192.168.1.4:9001').replace(/\/+$/, '');

const roomApi = axios.create({
  baseURL: `${AUTH_URL}/api/rooms`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

/**
 * Create a new collaborative party room
 */
export const createPartyRoom = async ({ title, vibe, tags, isPrivate, roomId, token } = {}) => {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await roomApi.post(
      '/create',
      { title, vibe, tags, isPrivate, roomId },
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating party room:', error?.response?.data || error.message);
    throw error?.response?.data || { message: 'Failed to create room' };
  }
};

/**
 * Get active rooms with optional vibe or search filter
 */
export const getActiveRooms = async ({ vibe = '', search = '', limit = 30, token = null } = {}) => {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await roomApi.get('/', {
      params: { vibe, search, limit },
      headers,
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching active rooms:', error?.response?.data || error.message);
    return { success: false, rooms: [] };
  }
};

/**
 * Get discover feed of party rooms (categorized by vibe)
 */
export const getDiscoverRooms = async (token = null) => {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await roomApi.get('/discover', { headers });
    return response.data;
  } catch (error) {
    console.error('Error fetching discover rooms:', error?.response?.data || error.message);
    return { success: false, categories: [] };
  }
};

/**
 * Discover other users and rooms matching user's vibe
 */
export const getVibeMatches = async (token = null) => {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await roomApi.get('/vibe-matches', { headers });
    return response.data;
  } catch (error) {
    console.error('Error fetching vibe matches:', error?.response?.data || error.message);
    return { success: false, matchedUsers: [], recommendedRooms: [] };
  }
};

/**
 * Get room details by ID
 */
export const getRoomById = async (roomId) => {
  try {
    const response = await roomApi.get(`/${roomId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching room ${roomId}:`, error?.response?.data || error.message);
    return null;
  }
};

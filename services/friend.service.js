import axios from 'axios';

const AUTH_URL = (process.env.EXPO_PUBLIC_AUTH_URL || 'http://192.168.1.4:9001').replace(/\/+$/, '');

const friendApi = axios.create({
  baseURL: `${AUTH_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export const sendFriendRequest = async ({ recipientId, token } = {}) => {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await friendApi.post('/friends/request', { recipientId }, { headers });
    return response.data;
  } catch (error) {
    console.error('Error sending friend request:', error?.response?.data || error.message);
    throw error?.response?.data || { message: 'Failed to send friend request' };
  }
};

export const respondFriendRequest = async ({ friendshipId, action, token } = {}) => {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await friendApi.post('/friends/respond', { friendshipId, action }, { headers });
    return response.data;
  } catch (error) {
    console.error('Error responding to friend request:', error?.response?.data || error.message);
    throw error?.response?.data || { message: 'Failed to respond to friend request' };
  }
};

export const getFriendsList = async (token = null) => {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await friendApi.get('/friends', { headers });
    return response.data;
  } catch (error) {
    console.error('Error fetching friends:', error?.response?.data || error.message);
    return { success: false, friends: [] };
  }
};

export const getPendingRequests = async (token = null) => {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await friendApi.get('/friends/pending', { headers });
    return response.data;
  } catch (error) {
    console.error('Error fetching pending requests:', error?.response?.data || error.message);
    return { success: false, requests: [] };
  }
};

export const getDirectMessages = async ({ friendId, token } = {}) => {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await friendApi.get(`/messages/${friendId}`, { headers });
    return response.data;
  } catch (error) {
    console.error('Error fetching messages:', error?.response?.data || error.message);
    return { success: false, messages: [] };
  }
};

export const sendDirectMessage = async ({
  recipientId,
  message,
  type = 'text',
  roomId = null,
  roomTitle = null,
  saveToCloud = false,
  uuid = null,
  token,
} = {}) => {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await friendApi.post(
      '/messages/send',
      { recipientId, message, type, roomId, roomTitle, saveToCloud, uuid },
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error?.response?.data || error.message);
    throw error?.response?.data || { message: 'Failed to send message' };
  }
};

export const sweepMessagesApi = async ({ token } = {}) => {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await friendApi.get('/messages/sweep', { headers });
    return response.data;
  } catch (error) {
    console.error('Error sweeping messages:', error?.response?.data || error.message);
    return { success: false, messages: [] };
  }
};

export const ackMessagesApi = async ({ messageUuids, token } = {}) => {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await friendApi.post('/messages/ack', { messageUuids }, { headers });
    return response.data;
  } catch (error) {
    console.error('Error acking messages:', error?.response?.data || error.message);
    return { success: false, purgedCount: 0 };
  }
};


import axios from 'axios';

const SERVER = process.env.EXPO_PUBLIC_API_URL;

export const getQueue = async (videoId) => {
  try {
    const response = await axios.get(`${SERVER}/api/watchlist/${videoId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching the queue:', error);
    throw error;
  }
};
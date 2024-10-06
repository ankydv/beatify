import axios from 'axios';

const musicApi = axios.create({
  baseURL: `${process.env.EXPO_PUBLIC_API_URL2}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, 
});

export default musicApi;

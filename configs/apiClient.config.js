import axios from 'axios';

const base =
  process.env.EXPO_PUBLIC_API_URL2 ||
  process.env.EXPO_PUBLIC_API_URL ||
  'https://test-server-three-smoky.vercel.app';

const musicApi = axios.create({
  baseURL: `${base.replace(/\/+$/, '')}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, 
});

export default musicApi;

import axios from 'axios';
import setupInterceptors from './interceptors';

const createAxiosInstance = (baseURL) => {
  const axiosInstance = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  setupInterceptors(axiosInstance);
  return axiosInstance;
};

export default createAxiosInstance;

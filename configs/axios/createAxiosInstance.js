import axios from 'axios';
import { setupYtInterceptors, setupGoogleInterceptors } from './interceptors';

const createAxiosInstance = (baseURL, type = 'music') => {
  const axiosInstance = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if(type == 'music')
    setupYtInterceptors(axiosInstance);
  else if(type == 'google')
    setupGoogleInterceptors(axiosInstance)
  return axiosInstance;
};

export default createAxiosInstance;

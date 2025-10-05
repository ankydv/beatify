import axios from 'axios';
import { setupYtInterceptors, setupGoogleInterceptors, setupUserAuthInterceptors } from './interceptors';

export const createAxiosInstance = (baseURL, type = 'music') => {
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

export const createUserAuthAxiosInstance = (baseURL) => {
  const axiosInstance = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
  });
  setupUserAuthInterceptors(axiosInstance);
  return axiosInstance;
};
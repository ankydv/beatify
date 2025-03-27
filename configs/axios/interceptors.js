import { refreshToken } from '@/services/auth.service';
import {tokenManager} from '@/utils/token.utils';

export const setupYtInterceptors = (axiosInstance) => {
  axiosInstance.interceptors.request.use(
    async (config) => {
      await refreshToken();
      const accessToken = await tokenManager.getAccessToken();
      config.headers['Authorization'] = `Bearer ${accessToken}`;
      return config;
    },
    (error) => Promise.reject(error)
  );
};

export const setupGoogleInterceptors = (axiosInstance) => {
  axiosInstance.interceptors.request.use(
    async (config) => {
      await refreshToken('google');
      const accessToken = await tokenManager.getGoogleAccessToken();
      config.headers['Authorization'] = `Bearer ${accessToken}`;
      return config;
    },
    (error) => Promise.reject(error)
  );
};
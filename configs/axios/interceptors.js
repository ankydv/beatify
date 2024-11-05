import { refreshToken } from '@/services/auth.service';
import {tokenManager} from '@/utils/token.utils';

const setupInterceptors = (axiosInstance) => {
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

export default setupInterceptors;

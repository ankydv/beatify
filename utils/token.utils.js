import * as SecureStore from 'expo-secure-store';

export const tokenManager = {
  async saveTokens(accessToken, refreshToken, expiresAt) {
    
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    await SecureStore.setItemAsync('expiresAt', expiresAt.toString());
  },

  async getAccessToken() {
    return await SecureStore.getItemAsync('accessToken');
  },

  async getRefreshToken() {
    return await SecureStore.getItemAsync('refreshToken');
  },
  
  async getExpiry(){
    const expStr =  await SecureStore.getItemAsync('expiresAt');
    return Number(expStr);
  },

  async clearTokens() {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
  },

  // Add other token handling methods, like token refresh
};

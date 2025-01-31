import * as SecureStore from 'expo-secure-store';

export const tokenManager = {
  async saveTokens(accessToken, refreshToken, authToken, expiresAt) {
    
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    if(authToken)
      await SecureStore.setItemAsync('authToken', authToken);
    await SecureStore.setItemAsync('expiresAt', expiresAt.toString());
  },

  async getAccessToken() {
    return await SecureStore.getItemAsync('accessToken');
  },

  async getRefreshToken() {
    return await SecureStore.getItemAsync('refreshToken');
  },
  async getAuthToken() {
    return await SecureStore.getItemAsync('authToken');
  },
  
  async getExpiry(){
    const expStr =  await SecureStore.getItemAsync('expiresAt');
    return Number(expStr);
  },

  async clearTokens() {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('authToken');
  },

  // Add other token handling methods, like token refresh
};

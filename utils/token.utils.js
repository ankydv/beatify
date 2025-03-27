import * as SecureStore from 'expo-secure-store';

export const tokenManager = {
  async saveTokens(accessToken, googleAccessToken, refreshToken, authToken, expiresAt, googleExpiresAt) {
    if(accessToken)
      await SecureStore.setItemAsync('accessToken', accessToken);
    if(googleAccessToken)
      await SecureStore.setItemAsync('googleAccessToken', googleAccessToken)
    if(refreshToken)
      await SecureStore.setItemAsync('refreshToken', refreshToken);
    if(authToken)
      await SecureStore.setItemAsync('authToken', authToken);
    if(expiresAt)
      await SecureStore.setItemAsync('expiresAt', expiresAt.toString());
    if(googleExpiresAt)
      await SecureStore.setItemAsync('googleExpiresAt', googleExpiresAt.toString())
  },

  async getAccessToken() {
    return await SecureStore.getItemAsync('accessToken');
  },

  async getGoogleAccessToken() {
    return await SecureStore.getItemAsync('googleAccessToken');
  },

  async getRefreshToken() {
    return await SecureStore.getItemAsync('refreshToken');
  },
  async getAuthToken() {
    return await SecureStore.getItemAsync('authToken');
  },
  
  async getExpiry(type='music'){
    let expStr;
    if(type==='music')
      expStr =  await SecureStore.getItemAsync('expiresAt');
    else if(type==='google')
      expStr =  await SecureStore.getItemAsync('googleExpiresAt');
    return Number(expStr);
  },

  async clearTokens() {
    await SecureStore.deleteItemAsync('googleAccessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('authToken');
  },

  // Add other token handling methods, like token refresh
};

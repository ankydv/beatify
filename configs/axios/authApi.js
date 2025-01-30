import createAxiosInstance from './createAxiosInstance';

const authApi = createAxiosInstance(`${process.env.EXPO_PUBLIC_AUTH_URL}/api/auth`);
export default authApi;

import { createUserAuthAxiosInstance } from './createAxiosInstance';

const authApi = createUserAuthAxiosInstance(`${process.env.EXPO_PUBLIC_AUTH_URL}`);
export default authApi;

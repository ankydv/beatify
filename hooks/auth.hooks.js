import axios from "axios";
import { useAuth } from "@clerk/clerk-expo";

/**
 * Returns an Axios instance that automatically adds Clerk token.
 */
export const useClerkAxios = () => {
  const { getToken, isSignedIn } = useAuth();

  const instance = axios.create({
    baseURL: process.env.EXPO_PUBLIC_API_URL,
    headers: { "Content-Type": "application/json" },
  });

  instance.interceptors.request.use(async (config) => {
    if (!isSignedIn) {
      throw new Error("User is not signed in");
    }
    const token = await getToken(); 
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return instance;
};

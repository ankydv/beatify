import axios from "axios";
import { useMemo } from "react";
import { useAuth } from "@clerk/clerk-expo";

/**
 * Returns an Axios instance that automatically adds the Clerk session token.
 */
export const useClerkAxios = () => {
  const { getToken, isSignedIn } = useAuth();

  const instance = useMemo(() => {
    const axiosInstance = axios.create({
      headers: { "Content-Type": "application/json" },
    });

    axiosInstance.interceptors.request.use(async (config) => {
      if (!isSignedIn) {
        throw new Error("User is not signed in");
      }
      const token = await getToken();
      if (token) {
        console.log(token)
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return axiosInstance;
  }, [getToken, isSignedIn]);

  return instance;
};

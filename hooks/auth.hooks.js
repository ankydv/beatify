import axios from "axios";
import { useMemo, useRef } from "react";
import { useAuth } from "@clerk/clerk-expo";

/**
 * Returns an Axios instance that automatically adds the Clerk session token.
 *
 * PRODUCTION NOTE: the instance is created ONCE per hook mount (empty-dep
 * useMemo) and the token getter is read through a ref. Clerk's `getToken`
 * is NOT a stable reference, so depending on it (as before) produced a NEW
 * axios instance every render — cascading into useCallback invalidation and
 * infinite refetch loops in every consumer using the api in an effect.
 */
export const useClerkAxios = () => {
  const { getToken, isSignedIn } = useAuth();
  const authRef = useRef({ getToken, isSignedIn });
  authRef.current = { getToken, isSignedIn };

  const instance = useMemo(() => {
    const axiosInstance = axios.create({
      headers: { "Content-Type": "application/json" },
    });

    axiosInstance.interceptors.request.use(async (config) => {
      const { getToken: currentGetToken, isSignedIn: currentIsSignedIn } = authRef.current;
      if (!currentIsSignedIn) {
        throw new Error("User is not signed in");
      }
      const token = await currentGetToken();
      if (token) {
        //console.log(token)
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return axiosInstance;
  }, []);

  return instance;
};

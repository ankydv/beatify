import React, { useCallback, useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useAuth, useSSO } from "@clerk/clerk-expo";
import { Alert, View } from "react-native";
import GoogleSignInButton from "./GoogleSignInButton";
import { closeModal } from "@/state/slices/modal.slice";
import { useDispatch } from "react-redux";
import axios from "axios";
import { tokenManager } from "@/utils/token.utils";

export const useWarmUpBrowser = () => {
  useEffect(() => {
    // Preloads the browser for Android devices to reduce authentication load time
    // See: https://docs.expo.dev/guides/authentication/#improving-user-experience
    void WebBrowser.warmUpAsync();
    return () => {
      // Cleanup: closes browser when component unmounts
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

// Handle any pending authentication sessions
WebBrowser.maybeCompleteAuthSession();

export default function ClerkSignIn() {
  const dispatch = useDispatch();
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  useWarmUpBrowser();

  // Use the `useSSO()` hook to access the `startSSOFlow()` method
  const { startSSOFlow } = useSSO();

  const createUserInMongo = async () => {
    const token = await getToken();
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await axios.post(`${process.env.EXPO_PUBLIC_AUTH_URL}/api/auth/signUpUsingClerk`, {}, config);
    const authToken = response.data.authToken;
    if(authToken){
      console.log(authToken )
      await tokenManager.saveTokens(false, false, false, authToken);
    }
  }

  const onPress = useCallback(async () => {
    try {
      setIsLoading(true);
      // Start the authentication process by calling `startSSOFlow()`
      const { createdSessionId, setActive, authSessionResult } =
        await startSSOFlow({
          strategy: "oauth_google",
          // For web, defaults to current path
          // For native, you must pass a scheme, like AuthSession.makeRedirectUri({ scheme, path })
          // For more info, see https://docs.expo.dev/versions/latest/sdk/auth-session/#authsessionmakeredirecturioptions
          redirectUrl: AuthSession.makeRedirectUri() + "library",
        });

      // If sign in was successful, set the active session
      if (createdSessionId) {
        setActive!({ session: createdSessionId }).then(async() => {
          await createUserInMongo();
        });
      } else {
        Alert.alert("Sign in failed", "Please try again later");
      }
    } catch (err) {
      // See https://clerk.com/docs/custom-flows/error-handling
      // for more info on error handling
      console.error(JSON.stringify(err, null, 2));
      Alert.alert("Sign in failed", "Please try again later")
    } finally {
      setIsLoading(false);
      dispatch(closeModal());
    }
  }, []);

  return (
    <View>
      <GoogleSignInButton onPress={onPress} isLoading={isLoading} />
    </View>
  );
}

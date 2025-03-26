import React, { useEffect } from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { Button, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { authenticateUser } from "@/state/slices/auth.slice";
import { useDispatch, useSelector } from "react-redux";
import { getAuthToken } from "@/services/authToken.service"

const SignInWithYouTube = () => {
  const CLIENT_ID = process.env.EXPO_PUBLIC_CLIENT_ID;
  const dispatch = useDispatch();
  const {isLoggedIn} = useSelector((state) => state.auth);
  WebBrowser.maybeCompleteAuthSession();
  const config = {
    androidClientId: CLIENT_ID,
    scopes: ["profile", "email"],

  };
  const [request, response, promptAsync] = Google.useAuthRequest(config);

  const { colors } = useTheme();

  const handleSignIn = async () => {
    await promptAsync({ useProxy: false, showInRecents: false }).then(
    );
  };

  useEffect(() => {
    const login = async () => {
      if (response?.type === "success") {
        const { authentication } = response;
        const { accessToken, expiresIn, refreshToken } = authentication;
        // console.log(accessToken)
        const authToken = await getAuthToken(); 
        console.log(accessToken)
        console.log(refreshToken)
        dispatch(authenticateUser({accessToken, refreshToken, authToken, expiresIn}));
      } else {
        console.log("Response:", response);
      }
    }
    login();
  }, [response]);

  if(isLoggedIn){
    return (
      <Text>Logged In</Text>
    );
  }
  return (
    <Button
      style={[styles.button]}
      onPress={handleSignIn}
      mode="contained"
      icon='youtube'
      buttonColor={colors.secondary}
    >
        Sign in with YouTube
    </Button>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    borderRadius: 10,
  },
});

export default SignInWithYouTube;

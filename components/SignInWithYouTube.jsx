import React, { useEffect } from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { useTheme } from "@react-navigation/native";
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
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.primary }]}
      onPress={handleSignIn}
    >
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name="youtube" size={24} color="white" />
      </View>
      <Text style={[styles.buttonText, { color: colors.text }]}>
        Sign in with YouTube
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  iconContainer: {
    marginRight: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default SignInWithYouTube;

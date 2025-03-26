import { useEffect, useState } from "react";
import { Text, Button, Alert, StyleSheet, View } from "react-native";
import * as Linking from "expo-linking";
import * as Clipboard from "expo-clipboard";
import { getDeviceCode, getBearerToken } from "@/services/ytAuth.service";
import { authenticateUser } from "@/state/slices/auth.slice";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "react-native-paper";

const YtAuth = () => {
  const { isLoggedIn } = useSelector((state) => state.auth);

  const [isReady, setIsReady] = useState(false);
  const [isReadyStep2, setIsReadyStep2] = useState(false);
  const [url, setUrl] = useState("");
  const [userCode, setUserCode] = useState("");
  const [deviceCode, setDeviceCode] = useState("");

  const dispatch = useDispatch();
  const { colors } = useTheme();

  useEffect(() => {
    if(isLoggedIn) return;
    const fetchDeviceCode = async () => {
      try {
        const res = await getDeviceCode();
        setIsReady(true);
        const { verification_url, user_code, device_code } = res;
        const formattedUrl = new URL(verification_url);
        formattedUrl.searchParams.set('user_code', user_code);
        setUrl(formattedUrl.toString());
        setDeviceCode(device_code);
      } catch (error) {
        console.error("Error fetching device code:", error);
      }
    };

    fetchDeviceCode();
  }, []);

  const handleGoPress = async () => {
    if (url) {
      Linking.openURL(url);
      setIsReadyStep2(true);
    } else {
      console.log("Error in generating verification url");
    }
  };

  const handleDonePress = async () => {
    try {
      const tokenResponse = await getBearerToken(deviceCode);
      // You can now handle tokenResponse, for example, saving it or navigating to another screen
      console.log(tokenResponse)
      const { access_token, expires_in, refresh_token } = tokenResponse;
      const accessToken = access_token;
      const expiresIn = expires_in;
      const refreshToken = refresh_token;
      console.log(tokenResponse);
      dispatch(authenticateUser({ accessToken, refreshToken, expiresIn }));
      console.log("token fetched");
    } catch (error) {
      console.error("Error obtaining bearer token:", error);
    }
  };
  if (isLoggedIn) {
    return <Text style={{color: colors.text}}>Logged In</Text>;
  }
  return (
    <View style={[styles.container]}>
      <Text style={[styles.stepText, { color: colors.text }]}>
        Step 1: Authenticate Using Google
      </Text>
      <Button
        title="Authenticate Using Google"
        onPress={handleGoPress}
        disabled={!isReady}
        color={colors.primary}
      />
      <Text style={[styles.instructionText, { color: colors.text }]}>
        Step 2: Click Verify once the above step is finished successfully.
      </Text>
      <Button
        title="Verify"
        onPress={handleDonePress}
        disabled={!isReadyStep2}
        color={colors.secondary}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  stepText: {
    fontSize: 16,
    fontWeight: "bold",
    marginVertical: 10,
  },
  instructionText: {
    fontSize: 16,
    marginVertical: 10,
  },
  codeText: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 10,
    color: "blue",
  },
  urlText: {
    fontSize: 14,
    textAlign: "center",
    marginVertical: 10,
    color: "grey",
  },
  button: {
    marginVertical: 10,
  },
});

export default YtAuth;

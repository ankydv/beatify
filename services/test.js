import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

ANDROID_CLIENT_ID = '305437345954-6i31ktasfnb0858t9e3cp7907aqtcco7.apps.googleusercontent.com'


WebBrowser.maybeCompleteAuthSession();
const config = {
    androidClientId: ANDROID_CLIENT_ID,
  };

  const [request, response, promptAsync] = Google.useAuthRequest(config);

  export const testSignIn = async () => {
    await promptAsync({useProxy: false, showInRecents: true});
    console.log(response);
  }
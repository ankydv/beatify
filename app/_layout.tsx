import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import TrackPlayer from 'react-native-track-player';
import store from '@/state/store';
import { LightTheme } from '@/theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Provider } from 'react-redux';
import EventListeners from './EventListeners'
import GlobalModal from '../components/GlobalModal';
import { StatusBar } from 'expo-status-bar';

declare global {
  var trackPlayerServiceRegistered: boolean | undefined;
}

if (!global.trackPlayerServiceRegistered) {
  TrackPlayer.registerPlaybackService(() => require('../services/track.service'));
  global.trackPlayerServiceRegistered = true;
}



export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};




// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <Provider store={store}>
      <StatusBar translucent />
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : LightTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="player" options={{ headerShown: false }} />
          <Stack.Screen name="voiceRoom" options={{ headerShown: false }} />
          <Stack.Screen name="updater" options={{ headerShown: false }} />
        </Stack>
        <EventListeners />
        <GlobalModal />
      </ThemeProvider>
    </Provider>
  );
}

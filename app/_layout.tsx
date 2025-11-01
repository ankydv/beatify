import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DefaultTheme as NavigationLightTheme, DarkTheme as NavigationDarkTheme,  ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import TrackPlayer from 'react-native-track-player';
import store from '@/state/store';
import { LightTheme as PaperLightTheme, DarkTheme as PaperDarkTheme } from '@/theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Provider } from 'react-redux';
import EventListeners from './EventListeners'
import GlobalModal from '../components/GlobalModal';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, Text, Title, adaptNavigationTheme, useTheme } from 'react-native-paper';
import { ClerkProvider } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'

const {LightTheme, DarkTheme} = adaptNavigationTheme({
  reactNavigationDark: NavigationDarkTheme,
  reactNavigationLight: NavigationLightTheme,
});

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
  const theme = colorScheme === 'dark' ? PaperDarkTheme : PaperLightTheme;

  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <Provider store={store}>
        <StatusBar translucent />
        <PaperProvider theme={theme} >
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : LightTheme}>
            <Stack
              screenOptions={{
                headerStyle: {
                  backgroundColor: theme.colors.background,
                },
                headerTintColor: theme.colors.onBackground,
                headerTitleStyle: {
                  fontWeight: "600",
                },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="player" options={{ headerShown: false }} />
              <Stack.Screen name="voiceRoom" options={{ headerShown: false }} />
              <Stack.Screen name="updater" options={{ headerShown: false }} />
              <Stack.Screen name="addToPlaylist" options={{ headerShown: true, title: "Add To Playlists",
                 presentation: "modal", // makes it slide up like a modal
                 animation: "slide_from_bottom",
              }} />

            </Stack>
            <EventListeners />
            <GlobalModal />
          </ThemeProvider>
        </PaperProvider>
      </Provider>
    </ClerkProvider>
  );
}

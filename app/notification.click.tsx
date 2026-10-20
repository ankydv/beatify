import { useEffect } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import store from '@/state/store';
import { setMinimised } from '@/state/slices/party.slice';
import LoadingIndicator from '@/components/LoadingIndicator';

export default function NotificationClickScreen() {
  const router = useRouter();
  const navigation = useNavigation<any>();

  useEffect(() => {
    try {
      const state = store.getState();
      const activeRoomId = state?.party?.roomId;
      const routes = navigation.getState()?.routes || [];
      const prevRoute = routes.length > 1 ? routes[routes.length - 2]?.name : null;

      if (activeRoomId) {
        store.dispatch(setMinimised(false));
        if (prevRoute === 'voiceRoom') {
          // Already on voiceRoom, dismiss this notification screen
          if (router.canGoBack()) {
            router.back();
          } else if (navigation.canGoBack()) {
            navigation.goBack();
          }
          return;
        }
        router.replace({ pathname: '/voiceRoom', params: { roomId: activeRoomId } });
      } else {
        if (prevRoute === 'player') {
          // Already on player screen, dismiss this notification screen to prevent duplicate stack
          if (router.canGoBack()) {
            router.back();
          } else if (navigation.canGoBack()) {
            navigation.goBack();
          }
          return;
        }
        const hasPlayerInStack = routes.slice(0, -1).some((r: any) => r.name === 'player');
        if (hasPlayerInStack) {
          if (router.canGoBack()) {
            router.back();
          } else if (navigation.canGoBack()) {
            navigation.goBack();
          }
          navigation.navigate('player');
          return;
        }
        router.replace('/player');
      }
    } catch (e) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [router, navigation]);

  return null;
}

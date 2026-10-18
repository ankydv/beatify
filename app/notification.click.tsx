import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import store from '@/state/store';
import { setMinimised } from '@/state/slices/party.slice';
import LoadingIndicator from '@/components/LoadingIndicator';

export default function NotificationClickScreen() {
  const router = useRouter();

  useEffect(() => {
    try {
      const state = store.getState();
      const activeRoomId = state?.party?.roomId;

      if (activeRoomId) {
        store.dispatch(setMinimised(false));
        router.replace({ pathname: '/voiceRoom', params: { roomId: activeRoomId } });
      } else {
        router.replace('/player');
      }
    } catch (e) {
      router.replace('/(tabs)');
    }
  }, [router]);

  return <LoadingIndicator />;
}

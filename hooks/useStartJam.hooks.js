import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { prepareJamSeed } from '@/utils/partyPlayback.utils';
import { createPartyRoom as apiCreateRoom } from '@/services/room.service';

/**
 * Player jam button → host-a-room-as-DJ with seamless handoff.
 *
 * const { jamming, startJam } = useStartJam();
 * await startJam(); // creates room + enters as DJ
 *
 * - Personal track playing: prepareJamSeed() captures it BEFORE navigation.
 *   usePartyPlayback consumes the seed, carries the track + upcoming queue
 *   into the room via queue-add + dj:load, and NEVER resets local audio —
 *   the song keeps playing and becomes the room's queue (DJ).
 * - Nothing playing: plain host flow, enters as DJ of an empty room.
 */
export function useStartJam() {
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const [jamming, setJamming] = useState(false);

  const startJam = useCallback(async ({ title, vibe, tags, roomId } = {}) => {
    if (jamming) return null;
    if (!isSignedIn) {
      try {
        Alert.alert('Sign in to Jam', 'Please sign in to start a party room.');
      } catch (e) {}
      return null;
    }
    setJamming(true);
    try {
      // Capture BEFORE navigating: seamless seed iff a personal track exists.
      prepareJamSeed();
      const targetRoomId = roomId || String(Math.floor(1000 + Math.random() * 9000));
      try {
        const token = getToken ? await getToken() : null;
        if (token) {
          const res = await apiCreateRoom({
            title: title || `${user?.firstName || 'Host'}'s Jam ⚡`,
            vibe: vibe || 'Chill',
            tags: tags || [],
            isPrivate: false,
            roomId: targetRoomId,
            token,
          });
          const created = res?.room?.roomId ? String(res.room.roomId) : null;
          router.push({ pathname: 'voiceRoom', params: { roomId: created || String(targetRoomId) } });
          return created || String(targetRoomId);
        }
      } catch (e) {
        // Room may already exist (id collision) — still enter seamlessly.
      }
      router.push({ pathname: 'voiceRoom', params: { roomId: String(targetRoomId) } });
      return String(targetRoomId);
    } finally {
      setJamming(false);
    }
  }, [getToken, isSignedIn, jamming, router, user?.firstName]);

  return { jamming, startJam, isSignedIn: !!isSignedIn };
}

export default useStartJam;

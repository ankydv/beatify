import TrackPlayer, { State } from 'react-native-track-player';
import { useEffect } from 'react';
import { socket } from '@/configs/socket';
import { loadPartyBundle, ensurePlaying } from '@/utils/partyPlayback.utils';

// Listener fallback: if the DJ-shared URL fails on this device (rare IP/UA
// edge), resolve locally via InnerTube once instead of stalling.
export function usePartyFallback({ enabled, partyRef, delayRef }) {
  useEffect(() => {
    if (!enabled) return;

    const tryLocalResolve = async (bundlePayload) => {
      try {
        const p = partyRef.current;
        if (p.role === 'dj') return;
        const cur = p.currentIndex >= 0 ? p.queue[p.currentIndex] : null;
        const videoId = bundlePayload?.bundle?.videoId || bundlePayload?.videoId || cur?.videoId;
        if (!videoId) return;
        const { resolveBundle } = await import('@/utils/partyDj.utils');
        const fresh = await resolveBundle({ videoId });
        if (!fresh?.url) return;
        const pos = await TrackPlayer.getPosition().catch(() => 0);
        await loadPartyBundle({ ...(cur || {}), ...fresh }, pos);
        if (p.status === 'playing') {
          await ensurePlaying();
        }
      } catch (e) {}
    };

    const checkAndFallback = async (payload) => {
      try {
        let waitTime = 2500;
        if (payload?.playAtServerMs) {
          const delay = delayRef?.current ? delayRef.current(payload.playAtServerMs) : Math.max(0, payload.playAtServerMs - Date.now());
          waitTime = delay + 2000;
        }
        await new Promise((r) => setTimeout(r, waitTime));
        const p = partyRef.current;
        if (p.status !== 'playing' && p.status !== 'loading') return;
        const st = await TrackPlayer.getState().catch(() => null);
        if (st === State.Playing || st === State.Buffering) return;
        await tryLocalResolve(payload);
      } catch (e) {}
    };

    socket.on('dj:load', checkAndFallback);
    socket.on('dj:play', checkAndFallback);
    return () => {
      socket.off('dj:load', checkAndFallback);
      socket.off('dj:play', checkAndFallback);
    };
  }, [enabled, partyRef, delayRef]);
}

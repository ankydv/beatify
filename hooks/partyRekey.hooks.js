import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { emitWithAck } from '@/configs/socket';
import { applyState } from '@/state/slices/party.slice';
import { resolveBundle } from '@/utils/partyDj.utils';

const REFRESH_MARGIN_SEC = 120;

/** DJ-side: re-resolve + broadcast a fresh URL before googlevideo `expire`. */
export function usePartyRekey({ roomId, enabled = true }) {
  const dispatch = useDispatch();
  const party = useSelector((s) => s.party);
  const isDj = party.role === 'dj';

  useEffect(() => {
    if (!enabled || !isDj || !roomId) return;
    const id = setInterval(async () => {
      try {
        const cur = party.currentIndex >= 0 ? party.queue[party.currentIndex] : null;
        const upcoming = party.queue[party.currentIndex + 1];
        const candidates = [cur, upcoming].filter(Boolean);
        for (const item of candidates) {
          if (!item?.expiresAtSeconds) continue;
          const remain = item.expiresAtSeconds - Date.now() / 1000;
          if (remain > REFRESH_MARGIN_SEC) continue;
          try {
            const fresh = await resolveBundle({ videoId: item.videoId });
            await emitWithAck('dj:rekey', { roomId, queueId: item.queueId, bundle: fresh });
            const res = await emitWithAck('dj:state-request', { roomId });
            const st = res?.state || res;
            if (st?.queue) dispatch(applyState({ ...st, roomId }));
          } catch (e) {}
          break; // one rekey per tick
        }
      } catch (e) {}
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isDj, roomId, party.currentIndex]);
}

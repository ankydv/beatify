import TrackPlayer, { State } from 'react-native-track-player';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { socket, emitWithAck } from '@/configs/socket';
import { applyState } from '@/state/slices/party.slice';
import { setCurrentTrack, setMetadata, resetAudio } from '@/state/slices/audio.slice';
import { loadPartyBundle, ensurePlaying } from '@/utils/partyPlayback.utils';

/**
 * Mirror the party bundle into the audio slice so PlayerScreen, the bottom
 * PlayerBar, and the Android media notification show the ROOM song — not a
 * stale personal track. Personal queue is untouched; room leave restores via
 * restorePersonalTrack() in party.service.
 */
export function mirrorPartyTrack(dispatch, bundle) {
  if (!bundle) return;
  const artists = typeof bundle.artists === 'string'
    ? bundle.artists.split(',').map((n) => ({ name: n.trim() })).filter((a) => a.name)
    : [];
  dispatch(setCurrentTrack({
    videoId: bundle.videoId,
    title: bundle.title,
    artists,
    thumbnail: bundle.thumb ? [{ url: bundle.thumb }] : [],
    thumbnails: bundle.thumb ? [{ url: bundle.thumb }] : [],
    duration: bundle.durationSec,
    isPartyTrack: true,
  }));
  dispatch(setMetadata({
    videoDetails: {
      videoId: bundle.videoId,
      title: bundle.title,
      author: typeof bundle.artists === 'string' ? bundle.artists : 'Party DJ',
      lengthSeconds: String(bundle.durationSec || 0),
      thumbnail: { thumbnails: bundle.thumb ? [{ url: bundle.thumb }] : [] },
      isPartyMirror: true,
    },
  }));
}

export function usePartyExtras({ roomId, enabled, partyRef, serverNowRef }) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!enabled) return;
    const onRekey = async ({ queueId, bundle, cmdSeq }) => {
      try {
        const pos = await TrackPlayer.getPosition().catch(() => 0);
        const st = await TrackPlayer.getState().catch(() => null);
        await loadPartyBundle({ ...bundle, queueId }, pos);
        if (st === State.Playing) await ensurePlaying();
        mirrorPartyTrack(dispatch, { ...bundle, queueId });
      } catch (e) {}
      dispatch(applyState({ queue: partyRef.current.queue.map((q) => (q.queueId === queueId ? bundle : q)) }));
    };
    const onReqReceived = ({ request }) => {
      if (!request) return;
      const p = partyRef.current;
      if (p.pendingRequests.some((r) => r.requestId === request.requestId)) return;
      dispatch(applyState({ pendingRequests: [...p.pendingRequests, request] }));
    };
    const onReqUpdated = ({ requestId, status }) => {
      const p = partyRef.current;
      dispatch(applyState({
        pendingRequests: p.pendingRequests.map((r) => (r.requestId === requestId ? { ...r, status } : r)),
      }));
      if (status === 'approved') {
        emitWithAck('dj:state-request', { roomId })
          .then((res) => {
            const st = res?.state || res;
            if (st?.queue) dispatch(applyState({ ...st, roomId }));
          })
          .catch(() => {});
      }
    };
    socket.on('dj:rekey', onRekey);
    socket.on('dj:request-received', onReqReceived);
    socket.on('dj:request-updated', onReqUpdated);
    return () => {
      socket.off('dj:rekey', onRekey);
      socket.off('dj:request-received', onReqReceived);
      socket.off('dj:request-updated', onReqUpdated);
    };
  }, [enabled, roomId, dispatch, partyRef]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(async () => {
      const p = partyRef.current;
      if (p.role === 'dj' || p.status !== 'playing') return;
      if (p.anchorServerMs == null) return;
      try {
        // BUG-1 FIX: only correct forward drift. The old symmetric check
        // re-sought when the local player was BEHIND (buffering / slow start),
        // yanking listeners forward spuriously. Behind = keep playing, it
        // catches up; ahead by >1.2s = real overshoot, seek back.
        const expectedMs = (p.anchorPosMs || 0) + Math.max(0, serverNowRef.current() - p.anchorServerMs);
        const pos = (await TrackPlayer.getPosition()) * 1000;
        const aheadBy = pos - expectedMs;
        if (aheadBy > 1200) {
          await TrackPlayer.seekTo(Math.max(0, expectedMs) / 1000);
        }
      } catch (e) {}
    }, 5000);
    return () => clearInterval(id);
  }, [enabled, partyRef, serverNowRef]);
}

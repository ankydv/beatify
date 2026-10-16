import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { socket, emitWithAck } from '@/configs/socket';
import { applyState, setError } from '@/state/slices/party.slice';
import { resolveBundle, toArtists, toThumb } from '@/utils/partyDj.utils';

export function usePartyDj({ roomId } = {}) {
  const dispatch = useDispatch();
  const party = useSelector((s) => s.party);
  const isDj = party.role === 'dj';

  const fail = useCallback((e) => {
    dispatch(setError(e?.message || 'Party command failed'));
    throw e;
  }, [dispatch]);

  const clearErr = useCallback(() => dispatch(setError(null)), [dispatch]);

  const queueAdd = useCallback(async (song) => {
    try {
      clearErr();
      const bundle = await resolveBundle(song);
      const res = await emitWithAck('dj:queue-add', { roomId, bundle });
      if (!res?.success) throw new Error(res?.message || 'Queue add rejected');
      return { ...res, bundle };
    } catch (e) {
      return fail(e);
    }
  }, [roomId, fail, clearErr]);

  const queueRemove = useCallback(async (queueId) => {
    try {
      const res = await emitWithAck('dj:queue-remove', { roomId, queueId });
      if (!res?.success) throw new Error(res?.message || 'Remove rejected');
      return res;
    } catch (e) {
      return fail(e);
    }
  }, [roomId, fail]);

  const load = useCallback(async (queueId, positionMs = 0) => {
    try {
      const res = await emitWithAck('dj:load', { roomId, queueId, positionMs, playAtServerMs: Date.now() + 2500 });
      if (!res?.success) throw new Error(res?.message || 'Load rejected');
      return res;
    } catch (e) {
      return fail(e);
    }
  }, [roomId, fail]);

  const play = useCallback(async (queueId = null, positionMs = null) => {
    try {
      const pos = positionMs != null ? positionMs : (party.anchorPosMs || 0);
      const res = await emitWithAck('dj:play-at', { roomId, queueId, positionMs: pos, playAtServerMs: Date.now() + 1500 });
      if (!res?.success) throw new Error(res?.message || 'Play rejected');
      return res;
    } catch (e) {
      return fail(e);
    }
  }, [roomId, fail, party.anchorPosMs]);

  const pause = useCallback(async () => {
    try {
      let pos = party.anchorPosMs || 0;
      try {
        const TrackPlayer = (await import('react-native-track-player')).default;
        pos = Math.round((await TrackPlayer.getPosition()) * 1000);
      } catch (e) {}
      const res = await emitWithAck('dj:pause-at', { roomId, positionMs: pos });
      if (!res?.success) throw new Error(res?.message || 'Pause rejected');
      return res;
    } catch (e) {
      return fail(e);
    }
  }, [roomId, fail, party.anchorPosMs]);

  const next = useCallback(async () => {
    try {
      const res = await emitWithAck('dj:next', { roomId });
      if (!res?.success) throw new Error(res?.message || 'Nothing next');
      return res;
    } catch (e) {
      return fail(e);
    }
  }, [roomId, fail]);

  const prev = useCallback(async () => {
    try {
      const res = await emitWithAck('dj:prev', { roomId });
      if (!res?.success) throw new Error(res?.message || 'Nothing previous');
      return res;
    } catch (e) {
      return fail(e);
    }
  }, [roomId, fail]);

  const seek = useCallback(async (positionMs) => {
    try {
      socket.emit('dj:seek-at', { roomId, positionMs: Math.round(positionMs) });
    } catch (e) {
      return fail(e);
    }
  }, [roomId, fail]);

  const approve = useCallback(async (requestId) => {
    try {
      const req = party.pendingRequests.find((r) => r.requestId === requestId);
      if (!req) throw new Error('Request not found');
      const bundle = await resolveBundle(req);
      const res = await emitWithAck('dj:request-approve', { roomId, requestId, bundle });
      if (!res?.success) throw new Error(res?.message || 'Approve rejected');
      return res;
    } catch (e) {
      return fail(e);
    }
  }, [roomId, fail, party.pendingRequests]);

  const rejectReq = useCallback(async (requestId) => {
    try {
      const res = await emitWithAck('dj:request-reject', { roomId, requestId });
      if (!res?.success) throw new Error(res?.message || 'Reject failed');
      return res;
    } catch (e) {
      return fail(e);
    }
  }, [roomId, fail]);

  const requestSong = useCallback(async (song) => {
    try {
      const res = await emitWithAck('dj:request-add', {
        roomId,
        videoId: song?.videoId,
        title: song?.title || song?.name || song?.videoId,
        artists: toArtists(song),
        thumb: toThumb(song),
        durationSec: Number(song?.durationSec) || 0,
      });
      if (!res?.success) throw new Error(res?.message || 'Request rejected');
      return res;
    } catch (e) {
      return fail(e);
    }
  }, [roomId, fail]);

  const refresh = useCallback(async () => {
    try {
      const res = await emitWithAck('dj:state-request', { roomId });
      const st = res?.state || res;
      if (st?.queue) dispatch(applyState({ ...st, roomId }));
      return st;
    } catch (e) {
      return fail(e);
    }
  }, [roomId, fail, dispatch]);

  return { isDj, queueAdd, queueRemove, load, play, pause, seek, next, prev, approve, rejectReq, requestSong, refresh };
}

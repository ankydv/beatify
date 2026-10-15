import TrackPlayer, { State } from 'react-native-track-player';
import { useEffect } from 'react';
import { socket, emitWithAck } from '@/configs/socket';
import { applyState, setRole, setLoading } from '@/state/slices/party.slice';
import { loadPartyBundle, ensurePlaying, pauseParty, ensurePlayerReady } from '@/utils/partyPlayback.utils';
import { scheduleAt, clearScheduled } from '@/utils/partyPlayback.utils';
import { mirrorPartyTrack } from '@/hooks/partyExtras.hooks';

export function usePartyEvents({ roomId, enabled, dispatch, partyRef, cmdSeqRef, delayRef }) {
  useEffect(() => {
    if (!enabled) return;
    const accept = (cmdSeq) => {
      if (cmdSeq != null && cmdSeq <= cmdSeqRef.current) return false;
      if (cmdSeq != null) cmdSeqRef.current = cmdSeq;
      return true;
    };
    const onState = async (s) => {
      if (!s) return;
      if (s.cmdSeq != null && s.cmdSeq < cmdSeqRef.current) return;
      if (s.cmdSeq != null) cmdSeqRef.current = s.cmdSeq;
      dispatch(applyState({ ...s, roomId }));
      if (s.djSocketId) dispatch(setRole(s.djSocketId === socket.id ? 'dj' : 'listener'));

      // If playback is logically playing on the server, ensure late joiners start playing
      if (s.status === 'playing' && s.currentIndex >= 0 && s.queue?.[s.currentIndex]) {
        try {
          const active = await TrackPlayer.getActiveTrack().catch(() => null);
          const bundle = s.queue[s.currentIndex];
          const st = await TrackPlayer.getState().catch(() => null);
          const isCurrentActive = active && (String(active.id) === String(bundle.queueId) || String(active.id) === String(bundle.videoId));
          const isActuallyPlaying = isCurrentActive && (st === State.Playing || st === State.Buffering);
          if (!isActuallyPlaying && bundle) {
            const base = s.serverNowMs || Date.now();
            const expectedMs = (s.anchorPosMs || 0) + Math.max(0, Date.now() - (s.anchorServerMs || base));
            mirrorPartyTrack(dispatch, bundle);
            let playedOk = false;
            try {
              await loadPartyBundle(bundle, expectedMs / 1000);
              await ensurePlaying();
              if (expectedMs > 500) {
                try {
                  await TrackPlayer.seekTo(expectedMs / 1000);
                } catch (e) {}
              }
              await new Promise((r) => setTimeout(r, 1200));
              const checkSt = await TrackPlayer.getState().catch(() => null);
              if (checkSt === State.Playing || checkSt === State.Buffering) {
                playedOk = true;
              }
            } catch (err) {}

            if (!playedOk) {
              const { resolveBundle } = await import('@/utils/partyDj.utils');
              const fresh = await resolveBundle({ videoId: bundle.videoId }).catch(() => null);
              if (fresh) {
                await loadPartyBundle({ ...bundle, ...fresh }, expectedMs / 1000);
                await ensurePlaying();
                if (expectedMs > 500) {
                  try {
                    await TrackPlayer.seekTo(expectedMs / 1000);
                  } catch (e) {}
                }
              }
            }
          }
        } catch (e) {}
      }
    };
    const onLoad = async ({ queueId, bundle, playAtServerMs, positionMs, anchorPosMs, anchorServerMs, cmdSeq }) => {
      if (!accept(cmdSeq)) return;
      // BUG-1 FIX: refresh the sync anchor FIRST so the drift corrector and
      // the late-join math below use the NEW baseline, not the stale one
      // from the previous track/pause.
      dispatch(applyState({
        anchorPosMs: anchorPosMs ?? positionMs ?? 0,
        ...(anchorServerMs != null ? { anchorServerMs } : {}),
      }));
      const idx = partyRef.current.queue.findIndex((q) => q.queueId === queueId);
      dispatch(applyState({ status: 'loading', currentIndex: idx, cmdSeq }));
      dispatch(setLoading(queueId));
      mirrorPartyTrack(dispatch, bundle);
      try {
        await ensurePlayerReady();
        await loadPartyBundle(bundle, ((anchorPosMs ?? positionMs) || 0) / 1000);
        scheduleAt(delayRef.current(playAtServerMs), async () => {
          dispatch(setLoading(null));
          dispatch(applyState({ status: 'playing' }));
          await ensurePlaying();
        });
      } catch (e) {
        dispatch(setLoading(null));
      }
    };
    const onPlay = async ({ bundle, queueId, playAtServerMs, positionMs, anchorPosMs, anchorServerMs, cmdSeq }) => {
      if (!accept(cmdSeq)) return;
      if (bundle) mirrorPartyTrack(dispatch, bundle);
      // BUG-1 FIX: this is the +1min-gap root. dj:play carries a FUTURE
      // anchor (anchorPosMs @ anchorServerMs == playAtServerMs). The old code
      // seeked to positionMs immediately and left party.anchor* stale, so the
      // periodic drift corrector computed
      //   expected = OLD_anchorPos + (serverNow - OLD_anchorServer)
      // which included the whole paused duration → hard seek forward right
      // after resume. Refresh redux FIRST, then seek locally.
      dispatch(applyState({
        status: 'playing',
        anchorPosMs: anchorPosMs ?? positionMs ?? 0,
        ...(anchorServerMs != null ? { anchorServerMs } : {}),
        ...(playAtServerMs != null ? { playAtServerMs } : {}),
      }));
      try {
        await ensurePlayerReady();
        const active = await TrackPlayer.getActiveTrack().catch(() => null);
        const needLoad = !active || (queueId && String(active.id) !== String(queueId));
        if (needLoad && bundle) await loadPartyBundle(bundle, ((anchorPosMs ?? positionMs) || 0) / 1000);
        else if ((anchorPosMs ?? positionMs ?? 0) > 500) {
          try {
            await TrackPlayer.seekTo((anchorPosMs ?? positionMs) / 1000);
          } catch (e) {}
        }
        scheduleAt(delayRef.current(playAtServerMs), async () => {
          dispatch(applyState({ status: 'playing' }));
          await ensurePlaying();
        });
      } catch (e) {}
    };
    const onPause = async ({ positionMs, anchorPosMs, anchorServerMs, cmdSeq }) => {
      if (!accept(cmdSeq)) return;
      const pos = anchorPosMs ?? positionMs ?? 0;
      // BUG-1 FIX: cancel any pending scheduled-play timer (a resume queued
      // before this pause landed would otherwise fire late), freeze the redux
      // anchor to the pause point, THEN seek locally. Old order did seek→pause
      // while anchor stayed stale, so the corrector jumped forward.
      clearScheduled();
      dispatch(applyState({ status: 'paused', anchorPosMs: pos, ...(anchorServerMs != null ? { anchorServerMs } : {}) }));
      try {
        // Freeze local playback exactly at the pause point; local getPosition
        // may be ahead/behind Exo state, so force-seek to the server value.
        try {
          await TrackPlayer.seekTo(Math.max(0, pos) / 1000);
        } catch (e) {}
        await pauseParty();
      } catch (e) {}
    };
    const onSeek = async ({ positionMs, anchorPosMs, anchorServerMs, playing, cmdSeq }) => {
      if (!accept(cmdSeq)) return;
      const pos = anchorPosMs ?? positionMs ?? 0;
      // Same anchor-first ordering as pause: redux before local seek.
      dispatch(applyState({
        anchorPosMs: pos,
        ...(anchorServerMs != null ? { anchorServerMs } : {}),
      }));
      try {
        await TrackPlayer.seekTo(Math.max(0, pos) / 1000);
        if (playing) await ensurePlaying();
        else await pauseParty();
      } catch (e) {}
    };
    const onRole = ({ newDjSocketId }) => {
      dispatch(applyState({ djSocketId: newDjSocketId }));
      dispatch(setRole(newDjSocketId === socket.id ? 'dj' : 'listener'));
    };
    socket.on('dj:state', onState);
    socket.on('dj:queue-updated', onState);
    socket.on('dj:load', onLoad);
    socket.on('dj:play', onPlay);
    socket.on('dj:pause', onPause);
    socket.on('dj:seek', onSeek);
    socket.on('dj:role-changed', onRole);
    return () => {
      socket.off('dj:state', onState);
      socket.off('dj:queue-updated', onState);
      socket.off('dj:load', onLoad);
      socket.off('dj:play', onPlay);
      socket.off('dj:pause', onPause);
      socket.off('dj:seek', onSeek);
      socket.off('dj:role-changed', onRole);
      clearScheduled();
    };
  }, [enabled, roomId, dispatch, partyRef, cmdSeqRef, delayRef]);
}

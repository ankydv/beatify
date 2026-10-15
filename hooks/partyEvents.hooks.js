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
      if ((s.status === 'playing' || s.status === 'loading') && s.currentIndex >= 0 && s.queue?.[s.currentIndex]) {
        try {
          const bundle = s.queue[s.currentIndex];
          const now = Date.now();
          const isLogicallyPlaying = s.status === 'playing' || (s.status === 'loading' && now >= (s.playAtServerMs || 0));

          if (isLogicallyPlaying) {
            const active = await TrackPlayer.getActiveTrack().catch(() => null);
            const st = await TrackPlayer.getState().catch(() => null);
            const isCurrentActive = active && (String(active.id) === String(bundle.queueId) || String(active.id) === String(bundle.videoId));
            const isActuallyPlaying = isCurrentActive && (st === State.Playing || st === State.Buffering);
            if (!isActuallyPlaying && bundle) {
              const base = s.playAtServerMs || s.anchorServerMs || s.serverNowMs || now;
              const expectedMs = (s.anchorPosMs || 0) + Math.max(0, now - base);
              mirrorPartyTrack(dispatch, bundle);
              let playedOk = false;
              try {
                await ensurePlayerReady();
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
          } else if (s.status === 'loading' && now < (s.playAtServerMs || 0)) {
            const delay = delayRef.current ? delayRef.current(s.playAtServerMs) : Math.max(0, s.playAtServerMs - now);
            await ensurePlayerReady();
            await loadPartyBundle(bundle, ((s.anchorPosMs || 0) / 1000));
            scheduleAt(delay, async () => {
              dispatch(applyState({ status: 'playing' }));
              await ensurePlaying();
            });
          }
        } catch (e) {}
      }
    };
    const onLoad = async ({ queueId, bundle, playAtServerMs, positionMs, anchorPosMs, anchorServerMs, serverNowMs, cmdSeq }) => {
      if (!accept(cmdSeq)) return;
      const srvMs = anchorServerMs ?? serverNowMs ?? Date.now();
      dispatch(applyState({
        anchorPosMs: anchorPosMs ?? positionMs ?? 0,
        anchorServerMs: srvMs,
      }));
      const idx = partyRef.current.queue.findIndex((q) => q.queueId === queueId);
      dispatch(applyState({ status: 'loading', currentIndex: idx, cmdSeq }));
      dispatch(setLoading(queueId));
      mirrorPartyTrack(dispatch, bundle);

      try {
        await ensurePlayerReady();
      } catch (err) {
        // Player init failed -> retry and fetch latest status from server
        setTimeout(async () => {
          try {
            await ensurePlayerReady();
            const { fetchLatestPartyState } = await import('@/utils/partyPlayback.utils');
            await fetchLatestPartyState(roomId, dispatch);
          } catch (e) {}
        }, 1000);
        return;
      }

      try {
        await loadPartyBundle(bundle, ((anchorPosMs ?? positionMs) || 0) / 1000);
        const delay = delayRef.current ? delayRef.current(playAtServerMs) : Math.max(0, (playAtServerMs || 0) - Date.now());
        scheduleAt(delay, async () => {
          dispatch(setLoading(null));
          dispatch(applyState({ status: 'playing' }));
          await ensurePlaying();
          try {
            const { applyAudioOutput } = await import('@/utils/audioRoute.utils');
            applyAudioOutput().catch(() => {});
          } catch (e) {}
        });

        // Verification after scheduled start + buffer
        setTimeout(async () => {
          try {
            const checkSt = await TrackPlayer.getState().catch(() => null);
            if (checkSt !== State.Playing && checkSt !== State.Buffering) {
              const { resolveBundle } = await import('@/utils/partyDj.utils');
              const fresh = await resolveBundle({ videoId: bundle.videoId });
              if (fresh) {
                await loadPartyBundle({ ...bundle, ...fresh }, ((anchorPosMs ?? positionMs) || 0) / 1000);
                await ensurePlaying();
              }
            }
          } catch (err) {}
        }, delay + 1500);
      } catch (e) {
        dispatch(setLoading(null));
        try {
          const { resolveBundle } = await import('@/utils/partyDj.utils');
          const fresh = await resolveBundle({ videoId: bundle.videoId });
          if (fresh) {
            await loadPartyBundle({ ...bundle, ...fresh }, ((anchorPosMs ?? positionMs) || 0) / 1000);
            const delay = delayRef.current ? delayRef.current(playAtServerMs) : Math.max(0, (playAtServerMs || 0) - Date.now());
            scheduleAt(delay, async () => {
              dispatch(applyState({ status: 'playing' }));
              await ensurePlaying();
            });
          }
        } catch (err) {}
      }
    };
    const onPlay = async ({ bundle, queueId, playAtServerMs, positionMs, anchorPosMs, anchorServerMs, serverNowMs, cmdSeq }) => {
      if (!accept(cmdSeq)) return;
      if (bundle) mirrorPartyTrack(dispatch, bundle);
      const srvMs = anchorServerMs ?? serverNowMs ?? Date.now();
      dispatch(applyState({
        status: 'playing',
        anchorPosMs: anchorPosMs ?? positionMs ?? 0,
        anchorServerMs: srvMs,
        ...(playAtServerMs != null ? { playAtServerMs } : {}),
      }));

      try {
        await ensurePlayerReady();
      } catch (err) {
        setTimeout(async () => {
          try {
            await ensurePlayerReady();
            const { fetchLatestPartyState } = await import('@/utils/partyPlayback.utils');
            await fetchLatestPartyState(roomId, dispatch);
          } catch (e) {}
        }, 1000);
        return;
      }

      try {
        const active = await TrackPlayer.getActiveTrack().catch(() => null);
        const needLoad = !active || (queueId && String(active.id) !== String(queueId));
        const seekPos = ((anchorPosMs ?? positionMs) || 0) / 1000;
        if (needLoad && bundle) {
          await loadPartyBundle(bundle, seekPos);
        } else if (seekPos > 0.5) {
          try {
            await TrackPlayer.seekTo(seekPos);
          } catch (e) {}
        }
        const delay = delayRef.current ? delayRef.current(playAtServerMs) : Math.max(0, (playAtServerMs || 0) - Date.now());
        scheduleAt(delay, async () => {
          dispatch(applyState({ status: 'playing' }));
          await ensurePlaying();
          try {
            const { applyAudioOutput } = await import('@/utils/audioRoute.utils');
            applyAudioOutput().catch(() => {});
          } catch (e) {}
        });

        setTimeout(async () => {
          try {
            const checkSt = await TrackPlayer.getState().catch(() => null);
            if (checkSt !== State.Playing && checkSt !== State.Buffering) {
              const vid = bundle?.videoId || active?.id;
              if (vid) {
                const { resolveBundle } = await import('@/utils/partyDj.utils');
                const fresh = await resolveBundle({ videoId: vid });
                if (fresh) {
                  await loadPartyBundle({ ...(bundle || {}), ...fresh }, seekPos);
                  await ensurePlaying();
                }
              }
            }
          } catch (err) {}
        }, delay + 1500);
      } catch (e) {}
    };
    const onPause = async ({ positionMs, anchorPosMs, anchorServerMs, serverNowMs, cmdSeq }) => {
      if (!accept(cmdSeq)) return;
      const pos = anchorPosMs ?? positionMs ?? 0;
      const srvMs = anchorServerMs ?? serverNowMs ?? Date.now();
      clearScheduled();
      dispatch(applyState({ status: 'paused', anchorPosMs: pos, anchorServerMs: srvMs }));
      try {
        await ensurePlayerReady();
        try {
          await TrackPlayer.seekTo(Math.max(0, pos) / 1000);
        } catch (e) {}
        await pauseParty();
      } catch (e) {}
    };
    const onSeek = async ({ positionMs, anchorPosMs, anchorServerMs, serverNowMs, playing, cmdSeq }) => {
      if (!accept(cmdSeq)) return;
      const pos = anchorPosMs ?? positionMs ?? 0;
      const srvMs = anchorServerMs ?? serverNowMs ?? Date.now();
      dispatch(applyState({
        anchorPosMs: pos,
        anchorServerMs: srvMs,
      }));
      try {
        await ensurePlayerReady();
        const active = await TrackPlayer.getActiveTrack().catch(() => null);
        if (!active) {
          const { fetchLatestPartyState } = await import('@/utils/partyPlayback.utils');
          await fetchLatestPartyState(roomId, dispatch);
          return;
        }
        await TrackPlayer.seekTo(Math.max(0, pos) / 1000);
        if (playing) await ensurePlaying();
        else await pauseParty();
      } catch (e) {
        try {
          const { fetchLatestPartyState } = await import('@/utils/partyPlayback.utils');
          await fetchLatestPartyState(roomId, dispatch);
        } catch (err) {}
      }
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

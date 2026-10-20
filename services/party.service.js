import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import TrackPlayer, { useTrackPlayerEvents, Event, State } from 'react-native-track-player';
import { socket, emitWithAck, ensureSocketConnected } from '@/configs/socket';
import { applyState, setLoading, setRole, resetParty } from '@/state/slices/party.slice';
import { setCurrentTrack, setMetadata } from '@/state/slices/audio.slice';
import useClockSync from '@/hooks/clockSync.hooks';
import { usePartyEvents } from '@/hooks/partyEvents.hooks';
import { usePartyExtras, mirrorPartyTrack } from '@/hooks/partyExtras.hooks';
import { usePartyFallback } from '@/hooks/partyFallback.hooks';
import { loadPartyBundle, ensurePlaying, pauseParty, ensurePlayerReady, teardownPartyPlayer } from '@/utils/partyPlayback.utils';
import { clearScheduled, applyRoomControlLock, selectIsListenerLocked } from '@/utils/partyPlayback.utils';
import { consumeJamSeed, seedRoomFromPersonal, pausePersonalForIdleRoom } from '@/utils/partyPlayback.utils';
import { resolveBundle } from '@/utils/partyDj.utils';

/**
 * Snapshot the personal track before the room takes over, and restore it on
 * leave — so exiting the room brings back the user's own PlayerScreen /
 * bottom-bar instead of leaving the room song stuck there.
 */
let personalSnapshot = null;

export function snapshotPersonalTrack() {
  try {
    const store = require('@/state/store').default;
    const a = store.getState()?.audio;
    if (a?.currentTrack && !a.currentTrack?.isPartyTrack && !personalSnapshot) {
      personalSnapshot = { currentTrack: a.currentTrack, metadata: a.metadata };
    }
  } catch (e) {}
}

export function restorePersonalTrack(dispatch) {
  try {
    if (personalSnapshot) {
      dispatch(setCurrentTrack(personalSnapshot.currentTrack));
      dispatch(setMetadata(personalSnapshot.metadata));
      personalSnapshot = null;
    } else {
      // No personal track to restore — clear the mirrored room track so the
      // UI doesn't keep showing a song that is no longer playing.
      dispatch(setCurrentTrack(null));
      dispatch(setMetadata(null));
    }
  } catch (e) {}
}

export function usePartyPlayback({ roomId, enabled = true }) {
  const dispatch = useDispatch();
  const party = useSelector((s) => s.party);
  const { serverNow, delayUntil } = useClockSync({ enabled: enabled && !!roomId, roomId });
  const serverNowRef = useRef(serverNow);
  serverNowRef.current = serverNow;
  const delayRef = useRef(delayUntil);
  delayRef.current = delayUntil;
  const partyRef = useRef(party);
  partyRef.current = party;
  const cmdSeqRef = useRef(0);

  useEffect(() => {
    if (!enabled || !roomId) return;
    let alive = true;
    // Snapshot the personal track BEFORE the room overwrites the player.
    snapshotPersonalTrack();
    (async () => {
      try {
        await ensureSocketConnected();
        if (!alive) return;
        const res = await emitWithAck('party:hello', { roomId });
        if (!alive) return;
        if (res?.success && res.state) {
          dispatch(applyState({ ...res.state, roomId }));
          if (res.state?.djSocketId && socket?.id) {
            dispatch(setRole(res.state.djSocketId === socket.id ? 'dj' : 'listener'));
          }
          cmdSeqRef.current = res.state.cmdSeq || 0;
          const st = res.state;
          const bundle = st.currentIndex >= 0 ? st.queue?.[st.currentIndex] : null;
          // SEAMLESS JAM: this device created the room moments ago while its
          // own song was playing (player jam button / host-with-queue flow).
          // The local player ALREADY has that song — do NOT reset/reload.
          // Carry the personal track + upcoming queue into the room and just
          // keep playing; dj:load echo comes back and is skipped too.
          const jamSeed = consumeJamSeed();
          // Derive DJ-ness from the hello payload alone (no require() — the
          // socket module is already imported at the top of this file).
          const roleAfterHello =
            st?.djSocketId && socket?.id && st.djSocketId === socket.id ? 'dj' : null;
          const isSeamlessHost =
            !!jamSeed &&
            (roleAfterHello === 'dj' || st?.role === 'dj') &&
            (!bundle || String(bundle.videoId || '') === String(jamSeed.videoId || ''));
          if (isSeamlessHost) {
            if (socket?.id) dispatch(setRole(socket.id === st?.djSocketId || !st?.djSocketId ? 'dj' : 'listener'));
            else dispatch(setRole('dj'));
            // Fire-and-forget: queue-add + dj:load from the LIVE local
            // position. Local audio never stops; listeners join the stream.
            seedRoomFromPersonal(roomId).catch(() => {});
            return;
          }
          if (bundle) {
            // Mirror the current bundle into audio for EVERY server status
            // (playing | loading | paused | idle), so the player screen and the
            // Android media notification always show the room's now-playing track
            // right after join instead of going blank. Position/duration are
            // seeded from the mirrored bundle (durationSec > 0) so the slider and
            // the track card render with real values on a mid-room join.
            mirrorPartyTrack(dispatch, bundle);
          }
          // Try initializing the player; if delayed/failed, schedule a retry + fetchLatestPartyState
          try {
            await ensurePlayerReady();
          } catch (initErr) {
            console.warn('[partyPlayback] initial ensurePlayerReady failed, retrying in 1s...');
            setTimeout(async () => {
              if (!alive) return;
              try {
                await ensurePlayerReady();
                const { fetchLatestPartyState } = await import('@/utils/partyPlayback.utils');
                await fetchLatestPartyState(roomId, dispatch);
              } catch (e) {}
            }, 1000);
            return;
          }

          const now = serverNowRef.current ? serverNowRef.current() : Date.now();
          const isLogicallyPlaying = st.status === 'playing' || (st.status === 'loading' && now >= (st.playAtServerMs || 0));

          // Load + start playback when status is playing (or loading past scheduled time).
          if (bundle && isLogicallyPlaying) {
            const base = st.playAtServerMs || st.anchorServerMs || st.serverNowMs || now;
            const expectedMs = (st.anchorPosMs || 0) + Math.max(0, now - base);
            dispatch(setLoading(bundle.queueId));
            let playedOk = false;
            try {
              await loadPartyBundle(bundle, expectedMs / 1000);
              await ensurePlaying();
              if (expectedMs > 500) {
                try {
                  await TrackPlayer.seekTo(expectedMs / 1000);
                } catch (e) {}
              }
              // Verify whether playback actually started within 1.2s (ExoPlayer 403 won't throw synchronously in JS!)
              await new Promise((r) => setTimeout(r, 1200));
              const currentSt = await TrackPlayer.getState().catch(() => null);
              if (currentSt === State.Playing || currentSt === State.Buffering) {
                playedOk = true;
              }
            } catch (e) {}

            if (!playedOk && alive) {
              // Primary bundle failed (e.g. 403 on DJ's IP-bound URL) — resolve locally on this device
              try {
                const fresh = await resolveBundle({ videoId: bundle.videoId });
                if (fresh) {
                  await loadPartyBundle({ ...bundle, ...fresh }, expectedMs / 1000);
                  await ensurePlaying();
                  if (expectedMs > 500) {
                    try {
                      await TrackPlayer.seekTo(expectedMs / 1000);
                    } catch (err) {}
                  }
                }
              } catch (err) {}
            }
            dispatch(setLoading(null));
          } else if (bundle && st.status === 'loading' && now < (st.playAtServerMs || 0)) {
            // Track is scheduled to start soon
            try {
              await loadPartyBundle(bundle, ((st.anchorPosMs || 0) / 1000));
              const delay = delayRef.current ? delayRef.current(st.playAtServerMs) : Math.max(0, (st.playAtServerMs || 0) - now);
              setTimeout(async () => {
                if (!alive) return;
                dispatch(applyState({ status: 'playing' }));
                await ensurePlaying();
              }, delay);

              setTimeout(async () => {
                if (!alive) return;
                const currentSt = await TrackPlayer.getState().catch(() => null);
                if (currentSt !== State.Playing && currentSt !== State.Buffering) {
                  const fresh = await resolveBundle({ videoId: bundle.videoId }).catch(() => null);
                  if (fresh) {
                    await loadPartyBundle({ ...bundle, ...fresh }, ((st.anchorPosMs || 0) / 1000));
                    await ensurePlaying();
                  }
                }
              }, delay + 1500);
            } catch (e) {}
          } else if (bundle && st.status === 'paused') {
            try {
              await loadPartyBundle(bundle, (st.anchorPosMs || 0) / 1000);
              await pauseParty();
            } catch (e) {
              try {
                const fresh = await resolveBundle({ videoId: bundle.videoId });
                await loadPartyBundle({ ...bundle, ...fresh }, (st.anchorPosMs || 0) / 1000);
                await pauseParty();
              } catch (err) {}
            }
          } else {
            // Idle room (no bundle / empty queue): TAKE OVER the shared
            // player by pausing lingering personal audio. Reported bug was
            // that the personal song kept playing when the room had nothing
            // playing yet. Snapshot (taken above) restores it on leave.
            // Seamless hosts already returned above — this is joiners only.
            try {
              await pausePersonalForIdleRoom();
            } catch (e) {}
          }
        }
      } catch (e) {}
    })();
    // leave-room teardown
    const tearDown = async () => {
      try {
        await teardownPartyPlayer(dispatch);
      } catch (e) {}
    };
    return () => {
      alive = false;
      tearDown();
    };
  }, [enabled, roomId, dispatch]);

  usePartyEvents({ roomId, enabled, dispatch, partyRef, cmdSeqRef, delayRef });
  usePartyExtras({ roomId, enabled, partyRef, serverNowRef });
  usePartyFallback({ enabled, partyRef, delayRef });

  /**
   * Keep RNTP's native control set in the right mode for our role:
   *  - listener + room-owned audio => ZERO capabilities (the Android
   *    notification / lock screen / quick-settings tile / Bluetooth transport
   *    expose no play, pause, skip or seek action to press);
   *  - DJ, or no room-owned audio => the normal full set;
   *  - on leave/unmount the full set is handed straight back.
   * The JS gates in partyPlayback.utils remain the authoritative enforcement.
   */
  const listenerLocked = useSelector(selectIsListenerLocked);
  useEffect(() => {
    if (!enabled || !roomId) return;
    applyRoomControlLock({ ensureReady: listenerLocked });
    return () => {
      applyRoomControlLock({ mode: 'full', force: true });
    };
  }, [enabled, roomId, listenerLocked]);

  useTrackPlayerEvents([Event.PlaybackState, Event.PlaybackError], async (event) => {
    try {
      if (event.type === Event.PlaybackState && event.state === State.Ended) {
        const p = partyRef.current;
        const cur = p.currentIndex >= 0 ? p.queue[p.currentIndex] : null;
        if (cur && enabled && roomId) socket.emit('dj:track-ended', { roomId, queueId: cur.queueId });
      } else if (event.type === Event.PlaybackError) {
        console.warn('[partyPlayback] PlaybackError received:', event.message || event);
        const p = partyRef.current;
        if (p.roomId && p.role !== 'dj') {
          const cur = p.currentIndex >= 0 ? p.queue[p.currentIndex] : null;
          if (cur?.videoId) {
            try {
              const fresh = await resolveBundle({ videoId: cur.videoId });
              if (fresh) {
                const pos = await TrackPlayer.getPosition().catch(() => 0);
                await loadPartyBundle({ ...cur, ...fresh }, pos);
                if (p.status === 'playing') await ensurePlaying();
              }
            } catch (err) {}
          }
        }
      }
    } catch (e) {}
  });

  useEffect(() => () => clearScheduled(), []);
  return null;
}

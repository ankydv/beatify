import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import TrackPlayer, { useTrackPlayerEvents, Event, State } from 'react-native-track-player';
import { socket, emitWithAck } from '@/configs/socket';
import { applyState, setLoading, resetParty } from '@/state/slices/party.slice';
import { setCurrentTrack, setMetadata } from '@/state/slices/audio.slice';
import useClockSync from '@/hooks/clockSync.hooks';
import { usePartyEvents } from '@/hooks/partyEvents.hooks';
import { usePartyExtras, mirrorPartyTrack } from '@/hooks/partyExtras.hooks';
import { usePartyFallback } from '@/hooks/partyFallback.hooks';
import { loadPartyBundle, ensurePlaying, pauseParty, ensurePlayerReady, teardownPartyPlayer } from '@/utils/partyPlayback.utils';
import { clearScheduled, applyRoomControlLock, selectIsListenerLocked } from '@/utils/partyPlayback.utils';

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
        const res = await emitWithAck('party:hello', { roomId });
        if (!alive) return;
        if (res?.success && res.state) {
          dispatch(applyState({ ...res.state, roomId }));
          cmdSeqRef.current = res.state.cmdSeq || 0;
          const st = res.state;
          const bundle = st.currentIndex >= 0 ? st.queue?.[st.currentIndex] : null;
          if (bundle && (st.status === 'playing' || st.status === 'loading' || st.status === 'paused')) {
            mirrorPartyTrack(dispatch, bundle);
          }
          if (bundle && st.status === 'playing') {
            const base = st.serverNowMs || Date.now();
            const expectedMs = (st.anchorPosMs || 0) + Math.max(0, base - (st.anchorServerMs || base));
            dispatch(setLoading(bundle.queueId));
            try {
              await loadPartyBundle(bundle, expectedMs / 1000);
              await ensurePlaying();
            } catch (e) {
              // Init was deferred — fall through to the generic join path.
              dispatch(setLoading(null));
            }
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
  usePartyFallback({ enabled, partyRef });

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

  useTrackPlayerEvents([Event.PlaybackState], async (event) => {
    try {
      if (event.type === Event.PlaybackState && event.state === State.Ended) {
        const p = partyRef.current;
        const cur = p.currentIndex >= 0 ? p.queue[p.currentIndex] : null;
        if (cur && enabled && roomId) socket.emit('dj:track-ended', { roomId, queueId: cur.queueId });
      }
    } catch (e) {}
  });

  useEffect(() => () => clearScheduled(), []);
  return null;
}

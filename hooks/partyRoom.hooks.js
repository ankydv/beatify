import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-expo';
import { socket, ensureSocketConnected, emitWithAck } from '@/configs/socket';
import {
  applyState,
  setConnected,
  setJoinError,
  setJoining,
  setParticipants,
  clearPresence,
} from '@/state/slices/party.slice';

function publishParticipants(dispatch, list) {
  const arr = Array.isArray(list) ? list : [];
  dispatch(setParticipants(arr));
  // Presence (muted / raised hand) is keyed by socket id — it is stale as soon
  // as the roster changes. Everyone re-broadcasts on 'user-joined', so we can
  // simply drop it and relearn.
  dispatch(clearPresence());
}

/**
 * Party room RUNTIME (membership + participants + connection health).
 *
 * Lives at the app root (see components/PartyHost.jsx) rather than inside the
 * room screen, so the socket room, WebRTC mesh, party playback sync and chat
 * keep running while the room SCREEN is minimised. The screen is a pure view.
 *
 * Source of truth for "which room am I in" is `party.roomId` in redux:
 *  - screen mounts            -> dispatch(setRoom(roomId))   -> we join
 *  - user taps Leave          -> dispatch(resetParty())      -> we leave
 *  - user presses Back        -> dispatch(setMinimised(true))-> we keep going
 */
export function usePartyRoom() {
  const dispatch = useDispatch();
  const roomId = useSelector((s) => s.party.roomId);
  const { getToken } = useAuth();

  const mountedRef = useRef(true);
  const joinAttemptRef = useRef(0);
  const joinedRoomRef = useRef(null);
  const joinedSocketIdRef = useRef(null);
  const joinInFlightRef = useRef(false);
  const joinedAtRef = useRef(0);
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const joinRoom = useCallback(async (target) => {
    if (!target || joinInFlightRef.current) return false;
    if (joinedRoomRef.current === target && joinedSocketIdRef.current === socket.id) return true;

    const attempt = ++joinAttemptRef.current;
    joinInFlightRef.current = true;
    if (mountedRef.current) {
      dispatch(setJoining(true));
      dispatch(setJoinError(null));
    }

    try {
      await ensureSocketConnected();
      const token = await getTokenRef.current();
      if (token && !socket.auth?.token) await emitWithAck('authenticate', { token });
      if (!mountedRef.current || attempt !== joinAttemptRef.current || roomIdRef.current !== target) {
        return false;
      }

      const join = (attemptsLeft) => new Promise((resolve) => {
        let done = false;
        const finish = (value) => { if (!done) { done = true; resolve(value); } };
        const timer = setTimeout(() => finish({ ok: false, timedOut: true }), 8000);
        socket.timeout(8000).emit('join-room', { roomId: target }, (err, response) => {
          clearTimeout(timer);
          if (err) return finish({ ok: false, response: null });
          if (response?.success) return finish({ ok: true, response });
          // Server rejects a socket that is already in a room — clear this
          // socket's stale membership and retry once.
          if (attemptsLeft > 0 && String(response?.message || '').includes('already in a room')) {
            socket.emit('leave-room', {});
            setTimeout(() => finish(join(attemptsLeft - 1)), 600);
            return;
          }
          finish({ ok: false, response });
        });
      });

      const res = await join(1);
      if (!mountedRef.current || attempt !== joinAttemptRef.current) return false;

      // Timed out but we were already in this room — don't fail the screen.
      if (!res?.ok && res?.timedOut &&
          joinedRoomRef.current === target && joinedSocketIdRef.current === socket.id) {
        if (mountedRef.current) {
          dispatch(setJoining(false));
          dispatch(setConnected(socket.connected));
        }
        return true;
      }
      if (!res?.ok) {
        if (mountedRef.current) {
          dispatch(setJoining(false));
          dispatch(setJoinError(res?.response?.message || 'Could not join the room'));
        }
        return false;
      }

      joinedRoomRef.current = target;
      joinedSocketIdRef.current = socket.id;
      joinedAtRef.current = Date.now();
      if (mountedRef.current) publishParticipants(dispatch, res.response.roomParticipants);

      const partyRes = await emitWithAck('party:hello', { roomId: target });
      const state = partyRes?.state || partyRes;
      if (partyRes?.success && state && mountedRef.current) {
        dispatch(applyState({ ...state, roomId: target }));
      }
      if (mountedRef.current) {
        dispatch(setJoining(false));
        dispatch(setJoinError(null));
        dispatch(setConnected(socket.connected));
      }
      return true;
    } catch (e) {
      if (mountedRef.current) {
        dispatch(setJoining(false));
        dispatch(setJoinError(e?.message || 'Could not join the room'));
      }
      return false;
    } finally {
      joinInFlightRef.current = false;
    }
  }, [dispatch]);

  const leaveRoom = useCallback(() => {
    const rid = joinedRoomRef.current;
    const sid = joinedSocketIdRef.current;
    if (!rid) return;
    joinedRoomRef.current = null;
    joinedSocketIdRef.current = null;
    joinAttemptRef.current++;
    try {
      if (sid && sid !== socket.id) {
        // Membership was created under an older socket identity.
        const delay = Math.min(Math.max(Date.now() - joinedAtRef.current, 1500), 4000);
        socket.timeout(delay).emit('leave-room', { roomId: rid });
      } else if (socket.connected) {
        socket.emit('leave-room', { roomId: rid });
      }
    } catch (e) {}
    if (mountedRef.current) {
      dispatch(setParticipants([]));
      dispatch(setJoining(false));
    }
  }, [dispatch]);

  /** Re-announce if the socket reconnected and we silently lost membership. */
  const bootstrap = useCallback(async () => {
    const target = roomIdRef.current;
    if (!target) return;
    if (joinedRoomRef.current === target && joinedSocketIdRef.current === socket.id) return;
    try {
      await ensureSocketConnected();
      const token = await getTokenRef.current();
      if (token && !socket.auth?.token) await emitWithAck('authenticate', { token });
      if (!socket.connected || !mountedRef.current) return;
      if (joinedRoomRef.current === target && joinedSocketIdRef.current === socket.id) return;
      if (joinedRoomRef.current === target && joinedSocketIdRef.current &&
          joinedSocketIdRef.current !== socket.id) {
        // Socket identity changed under us — clear previous and re-join room
        joinedRoomRef.current = null;
        joinedSocketIdRef.current = null;
      }
      await joinRoom(target);
    } catch (e) {}
  }, [joinRoom]);

  // Room changed: join the new room / leave the old one.
  useEffect(() => {
    if (!roomId) {
      leaveRoom();
      if (mountedRef.current) dispatch(setJoinError(null));
      return undefined;
    }
    joinRoom(roomId);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Socket lifecycle + participant roster + foreground re-join.
  useEffect(() => {
    mountedRef.current = true;

    const onConnect = () => {
      dispatch(setConnected(true));
      bootstrap();
    };
    const onDisconnect = () => {
      dispatch(setConnected(false));
      joinedSocketIdRef.current = null;
    };
    const onError = (error) => {
      if (mountedRef.current) dispatch(setJoinError(error?.message || null));
    };
    const onJoined = (data) => {
      if (mountedRef.current) publishParticipants(dispatch, data?.roomParticipants ?? []);
    };
    const onLeft = (data) => {
      if (mountedRef.current) publishParticipants(dispatch, data?.roomParticipants ?? []);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('error', onError);
    socket.on('user-joined', onJoined);
    socket.on('user-left', onLeft);
    dispatch(setConnected(socket.connected));

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        bootstrap();
        if (roomIdRef.current) {
          import('@/utils/partyPlayback.utils').then(({ fetchLatestPartyState }) => {
            fetchLatestPartyState(roomIdRef.current, dispatch).catch(() => {});
          });
        }
      }
    });
    // The socket often reconnects before AppState flips; bootstrap early too.
    const timer = setTimeout(bootstrap, 250);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      appStateSub.remove();
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('error', onError);
      socket.off('user-joined', onJoined);
      socket.off('user-left', onLeft);
      // Real teardown only (host unmount) — the room screen no longer owns this.
      leaveRoom();
    };
  }, [dispatch, bootstrap, leaveRoom]);
}

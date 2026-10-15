import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { socket } from '@/configs/socket';
import { setMuted, setRaisedHand } from '@/state/slices/party.slice';

/** Quick-reaction vocabulary — short so it survives server-side clamping. */
export const REACTIONS = ['🔥', '🎉', '😂', '❤️', '👏', '😭', '🙌', '🎵'];

/**
 * Collaborative "presence" layer: mic mute, raised hand and emoji reactions.
 * All of it is ephemeral socket traffic (`party:reaction`) — it never touches
 * playback state, so every member (not just the DJ) may fire it.
 */
export function usePartyPresence() {
  const dispatch = useDispatch();
  const roomId = useSelector((s) => s.party.roomId);
  const muted = useSelector((s) => s.party.muted);
  const raisedHand = useSelector((s) => s.party.raisedHand);

  const emit = useCallback((kind, value) => {
    if (!roomId || !socket.connected) return;
    try {
      socket.emit('party:reaction', { roomId, kind, value });
    } catch (e) {}
  }, [roomId]);

  const broadcastPresence = useCallback((m = muted, h = raisedHand) => {
    emit('presence', { muted: m, raisedHand: h });
  }, [emit, muted, raisedHand]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    dispatch(setMuted(next));
    emit('presence', { muted: next, raisedHand });
    return next;
  }, [dispatch, emit, muted, raisedHand]);

  const setMute = useCallback((next) => {
    dispatch(setMuted(!!next));
    emit('presence', { muted: !!next, raisedHand });
  }, [dispatch, emit, raisedHand]);

  const toggleHand = useCallback(() => {
    const next = !raisedHand;
    dispatch(setRaisedHand(next));
    emit('hand', next);
    emit('presence', { muted, raisedHand: next });
    return next;
  }, [dispatch, emit, muted, raisedHand]);

  const react = useCallback((emoji) => {
    emit('emoji', emoji);
    return emoji;
  }, [emit]);

  return { roomId, muted, raisedHand, toggleMute, setMute, toggleHand, react, broadcastPresence, emit };
}

import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { socket } from '@/configs/socket';
import { usePartyRoom } from '@/hooks/partyRoom.hooks';
import { usePartyPlayback } from '@/services/party.service';
import { usePartyRekey } from '@/hooks/partyRekey.hooks';
import { pushChat, setPresence } from '@/state/slices/party.slice';
import { usePartyPresence } from '@/hooks/partyPresence.hooks';
import WebRTCClient from '@/app/voiceRoom/webRTC';
import PartyMiniBar from './PartyMiniBar';
import PartyReactions from './PartyReactions';

/**
 * Room RUNTIME host — mounted once at the app root (see app/_layout.tsx).
 *
 * Everything that must outlive the room SCREEN lives here: socket membership,
 * the participant roster, WebRTC voice, shared-listening sync and the chat
 * buffer. The room screen (app/voiceRoom/_layout.jsx) is therefore a pure
 * view, which is what makes "back = minimise" possible.
 */
export default function PartyHost() {
  const dispatch = useDispatch();
  const roomId = useSelector((s) => s.party.roomId);
  const participants = useSelector((s) => s.party.participants);
  const muted = useSelector((s) => s.party.muted);
  const raisedHand = useSelector((s) => s.party.raisedHand);

  usePartyRoom();
  usePartyPlayback({ roomId, enabled: !!roomId });
  usePartyRekey({ roomId, enabled: !!roomId });
  const { broadcastPresence } = usePartyPresence();

  // Chat lives here (not in the chat screen) so history survives minimising.
  useEffect(() => {
    const onMessage = (message) => {
      if (!message?.message) return;
      dispatch(pushChat(message));
    };
    socket.on('receive-message', onMessage);
    return () => socket.off('receive-message', onMessage);
  }, [dispatch]);

  // Learn other people's mute / raised-hand state, and re-announce ours
  // whenever somebody new joins so late joiners aren't blind to it.
  useEffect(() => {
    if (!roomId) return undefined;

    const onReaction = (p) => {
      if (!p?.from || p.kind === 'emoji') return;
      if (p.kind === 'presence') {
        dispatch(setPresence({ id: p.from, ...p.value }));
      } else if (p.kind === 'hand') {
        dispatch(setPresence({ id: p.from, raisedHand: !!p.value }));
      }
    };
    const announce = () => broadcastPresence(muted, raisedHand);

    socket.on('party:reaction', onReaction);
    socket.on('user-joined', announce);
    announce();

    return () => {
      socket.off('party:reaction', onReaction);
      socket.off('user-joined', announce);
    };
    // `broadcastPresence` is memoised on [muted, raisedHand] — do NOT depend on
    // the whole hook result object or this effect would re-fire every render
    // and echo presence back into redux forever.
  }, [roomId, dispatch, broadcastPresence, muted, raisedHand]);

  return (
    <>
      {roomId ? (
        <WebRTCClient roomId={roomId} participantsList={participants} muted={muted} />
      ) : null}
      <PartyMiniBar />
      <PartyReactions />
    </>
  );
}

import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { socket } from '@/configs/socket';
import { usePartyRoom } from '@/hooks/partyRoom.hooks';
import { usePartyPlayback } from '@/services/party.service';
import { usePartyRekey } from '@/hooks/partyRekey.hooks';
import { pushChat, setPresence, setAudioOutput } from '@/state/slices/party.slice';
import { usePartyPresence } from '@/hooks/partyPresence.hooks';
import WebRTCClient from '@/app/voiceRoom/webRTC';
import PartyMiniBar from './PartyMiniBar';
import PartyReactions from './PartyReactions';
import {
  getAvailableAudioRoutes,
  applyAudioOutput,
  subscribeAudioRoutesChanged,
  resetAudioOutput,
  acquirePartyLocks,
  releasePartyLocks,
} from '@/utils/audioRoute.utils';

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
  const muteIncoming = useSelector((s) => s.party.muteIncoming);
  const audioOutput = useSelector((s) => s.party.audioOutput || 'speaker');

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

  // Auto-detect audio hardware and route appropriately when entering/leaving room
  useEffect(() => {
    if (!roomId) {
      resetAudioOutput().catch(() => {});
      return undefined;
    }

    // Keep CPU and Wifi active in background/lock screen while in party room
    acquirePartyLocks().catch(() => {});

    let isMounted = true;
    (async () => {
      try {
        const routes = await getAvailableAudioRoutes();
        if (!isMounted) return;
        // Default to Bluetooth when wireless headphones/earbuds/speaker connected
        const initialRoute = routes?.bluetooth ? 'bluetooth' : 'speaker';
        dispatch(setAudioOutput(initialRoute));
        await applyAudioOutput(initialRoute);
      } catch (e) {}
    })();

    // Listen for bluetooth connection / disconnection events
    const unsubscribe = subscribeAudioRoutesChanged((routes) => {
      if (!isMounted) return;
      if (routes?.bluetooth && audioOutput !== 'bluetooth') {
        dispatch(setAudioOutput('bluetooth'));
        applyAudioOutput('bluetooth').catch(() => {});
      } else if (!routes?.bluetooth && audioOutput === 'bluetooth') {
        dispatch(setAudioOutput('speaker'));
        applyAudioOutput('speaker').catch(() => {});
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [roomId, dispatch]);

  return (
    <>
      {roomId ? (
        <WebRTCClient
          roomId={roomId}
          participantsList={participants}
          muted={muted}
          muteIncoming={muteIncoming}
          audioOutput={audioOutput}
        />
      ) : null}
      <PartyMiniBar />
      <PartyReactions />
    </>
  );
}

import React, { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { socket, ensureSocketConnected } from '@/configs/socket';
import { sweepMessagesApi, ackMessagesApi } from '@/services/friend.service';
import {
  saveMessageLocally,
  markOutgoingMessagesAsDelivered,
  markOutgoingMessagesAsSeen,
  getActiveChatId,
  emitGlobalChatNotification,
} from '@/services/chatStorage.service';

export default function GlobalChatManager() {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  // Process swept messages from Redis inbox, write to local device DB, and ACK to purge from Upstash
  const processSweptMessages = useCallback(async (messages) => {
    if (!Array.isArray(messages) || messages.length === 0) return;
    const writtenUuids = [];
    const myId = userIdRef.current;

    for (const msg of messages) {
      const friendId = msg.senderId === myId ? msg.recipientId : msg.senderId;
      if (!friendId) continue;

      const activeId = getActiveChatId();
      const isChatOpen = activeId === String(friendId);

      // Confirm local database write
      await saveMessageLocally(friendId, { ...msg, read: isChatOpen }, msg.senderId === myId);

      const uuid = msg.uuid || msg._id;
      if (uuid) writtenUuids.push(uuid);
    }

    // Ack & Purge Phase: erase specific messages from Upstash Redis
    if (writtenUuids.length > 0) {
      socket.emit('ack_messages', { messageUuids: writtenUuids });
      try {
        const token = getTokenRef.current ? await getTokenRef.current() : null;
        if (token) await ackMessagesApi({ messageUuids: writtenUuids, token });
      } catch (e) {}
    }
  }, []);

  // Sweep pending messages from Redis inbox
  const sweepInbox = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      await ensureSocketConnected();
      socket.emit('sweep_inbox', {}, async (res) => {
        if (res?.success && Array.isArray(res.messages) && res.messages.length > 0) {
          await processSweptMessages(res.messages);
        }
      });
    } catch (e) {
      try {
        const token = getTokenRef.current ? await getTokenRef.current() : null;
        if (token) {
          const res = await sweepMessagesApi({ token });
          if (res?.success && Array.isArray(res.messages) && res.messages.length > 0) {
            await processSweptMessages(res.messages);
          }
        }
      } catch (err) {}
    }
  }, [isSignedIn, processSweptMessages]);

  useEffect(() => {
    if (!isSignedIn) return;
    let alive = true;

    const handleMessageReceived = async (msg) => {
      if (!alive || !msg) return;
      const myId = userIdRef.current;
      const senderId = msg.senderId;
      if (senderId && myId && senderId === myId) return;

      const activeId = getActiveChatId();
      const isChatOpen = activeId === String(senderId);

      // 1. Confirm local database write
      await saveMessageLocally(senderId, { ...msg, read: isChatOpen }, false);

      // 2. Ack & Purge from Upstash Redis
      const uuid = msg.uuid || msg._id;
      if (uuid) {
        socket.emit('ack_messages', { messageUuids: [uuid] });
        socket.emit('friend:delivered', { senderId, messageUuids: [uuid] });
      }

      // 3. Trigger Global In-App Notification Toast if user is NOT currently inside active conversation
      if (!isChatOpen) {
        const isInvite = msg.type === 'jam_invite' || Boolean(msg.roomId);
        emitGlobalChatNotification({
          type: isInvite ? 'jam_invite' : 'message',
          title: isInvite ? 'Party Room Invite 🎧' : `${msg.senderName || 'New Message'} 💬`,
          message: msg.message,
          senderId,
          roomId: msg.roomId,
          roomTitle: msg.roomTitle,
        });
      }
    };

    const handleMessageSent = async (msg) => {
      if (!alive || !msg) return;
      const recipientId = msg.recipientId;
      await saveMessageLocally(recipientId, { ...msg, read: true, status: msg.status || 'delivered' }, true);
    };

    const handleMessagesRead = async ({ readerId }) => {
      if (!alive || !readerId) return;
      await markOutgoingMessagesAsSeen(readerId);
    };

    const handleMessageDelivered = async ({ recipientId, messageUuids }) => {
      if (!alive || !recipientId) return;
      await markOutgoingMessagesAsDelivered(recipientId, messageUuids);
    };

    const handleRequestReceived = (req) => {
      if (!alive || !req) return;
      emitGlobalChatNotification({
        type: 'friend_request',
        title: 'New Friend Request 🤝',
        message: `${req?.requesterName || 'A listener'} wants to connect and jam!`,
        requesterId: req?.requesterId,
      });
    };

    const handleSweepResponse = (data) => {
      if (alive && data?.messages) {
        processSweptMessages(data.messages);
      }
    };

    (async () => {
      try {
        await ensureSocketConnected();
        if (!alive) return;

        socket.on('friend:message-received', handleMessageReceived);
        socket.on('friend:message-sent', handleMessageSent);
        socket.on('friend:messages-read', handleMessagesRead);
        socket.on('friend:message-delivered', handleMessageDelivered);
        socket.on('friend:request-received', handleRequestReceived);
        socket.on('chat:sweep-response', handleSweepResponse);
        socket.on('inbox:swept', handleSweepResponse);
        socket.on('connect', sweepInbox);

        sweepInbox();
      } catch (err) {}
    })();

    // Foreground listener: sweep when app comes to foreground
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        sweepInbox();
      }
    });

    return () => {
      alive = false;
      socket.off('friend:message-received', handleMessageReceived);
      socket.off('friend:message-sent', handleMessageSent);
      socket.off('friend:messages-read', handleMessagesRead);
      socket.off('friend:message-delivered', handleMessageDelivered);
      socket.off('friend:request-received', handleRequestReceived);
      socket.off('chat:sweep-response', handleSweepResponse);
      socket.off('inbox:swept', handleSweepResponse);
      socket.off('connect', sweepInbox);
      appStateSub.remove();
    };
  }, [isSignedIn, sweepInbox, processSweptMessages]);

  return null;
}

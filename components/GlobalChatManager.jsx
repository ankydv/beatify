import React, { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { socket, ensureSocketConnected } from '@/configs/socket';
import { sweepMessagesApi, ackMessagesApi } from '@/services/friend.service';
import { registerPushNotifications } from '@/services/notification.service';
import {
  saveMessageLocally,
  markOutgoingMessagesAsDelivered,
  markOutgoingMessagesAsSeen,
  getActiveChatId,
  emitGlobalChatNotification,
} from '@/services/chatStorage.service';

export default function GlobalChatManager() {
  const router = useRouter();
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  // Register push notifications (FCM & background task)
  useEffect(() => {
    if (isSignedIn) {
      (async () => {
        try {
          const token = getTokenRef.current ? await getTokenRef.current() : null;
          await registerPushNotifications(token);
        } catch (e) {}
      })();
    }
  }, [isSignedIn]);

  // Handle system notification tap (when user taps background notification)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const rawData = response?.notification?.request?.content?.data;
        if (!rawData) return;
        let data = rawData;
        if (typeof rawData.payload === 'string') {
          try {
            data = JSON.parse(rawData.payload);
          } catch (e) {}
        }
        if (data.roomId) {
          router.push({ pathname: 'voiceRoom', params: { roomId: String(data.roomId) } });
        } else if (data.senderId) {
          router.push({ pathname: '/(tabs)/chat', params: { friendId: String(data.senderId) } });
        }
      } catch (err) {
        console.warn('[GlobalChatManager] Error handling notification response:', err);
      }
    });

    return () => sub.remove();
  }, [router]);

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
      if (uuid) {
        writtenUuids.push(uuid);
        if (msg.senderId && msg.senderId !== myId) {
          socket.emit('friend:delivered', { senderId: msg.senderId, messageUuids: [uuid] });
          if (isChatOpen) {
            markChatAsRead(friendId);
            socket.emit('friend:read-receipt', { recipientId: msg.senderId, readerId: myId });
          }
        }
      }
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
        socket.emit('ack_messages', { messageUuids: [uuid], senderId });
        socket.emit('friend:delivered', { senderId, messageUuids: [uuid] });
      }

      const isInvite = msg.type === 'jam_invite' || Boolean(msg.roomId);
      const senderName = msg.senderName || 'Your friend';
      const notifTitle = isInvite ? `${senderName} invited you 🎧` : `${senderName} 💬`;
      const notifBody = msg.message || (isInvite ? 'Live Jam Room Invite' : 'New message');

      // 3. IF CHAT IS CURRENTLY OPEN WITH THIS FRIEND:
      if (isChatOpen) {
        // User is viewing the conversation! Mark read and notify sender immediately (blue tick)
        await markChatAsRead(senderId);
        socket.emit('friend:read-receipt', { recipientId: senderId, readerId: myId });
      } else {
        // 4. CHAT IS NOT OPEN: Show notification based on AppState
        if (AppState.currentState !== 'active') {
          // App is minimised / in background: present system tray notification
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: notifTitle,
                body: notifBody,
                data: {
                  senderId: String(senderId),
                  senderName,
                  roomId: msg.roomId ? String(msg.roomId) : '',
                  messageUuid: String(uuid || ''),
                },
                sound: 'default',
              },
              trigger: null,
            });
          } catch (notifErr) {
            console.warn('[GlobalChatManager] Error presenting background notification:', notifErr);
          }
        } else {
          // App is in foreground: show global floating in-app banner
          emitGlobalChatNotification({
            type: isInvite ? 'jam_invite' : 'message',
            title: notifTitle,
            message: notifBody,
            senderId,
            roomId: msg.roomId,
            roomTitle: msg.roomTitle,
          });
        }
      }
    };

    const handleMessageSent = async (msg) => {
      if (!alive || !msg) return;
      const recipientId = msg.recipientId;
      await saveMessageLocally(recipientId, { ...msg, read: true, status: msg.status || 'sent' }, true);
    };

    const handleMessagesRead = async ({ readerId }) => {
      if (!alive || !readerId) return;
      await markOutgoingMessagesAsSeen(readerId);
    };

    const handleMessageDelivered = async ({ recipientId, messageUuids }) => {
      if (!alive || !recipientId) return;
      await markOutgoingMessagesAsDelivered(recipientId, messageUuids);
    };

    const handleRequestReceived = async (req) => {
      if (!alive || !req) return;
      const requesterName = req?.requesterName || 'A listener';
      const notifTitle = `${requesterName} 🤝`;
      const notifBody = 'Sent you a friend request to vibe together';

      if (AppState.currentState !== 'active') {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: notifTitle,
              body: notifBody,
              data: { requesterId: req?.requesterId },
              sound: 'default',
            },
            trigger: null,
          });
        } catch (e) {}
      } else {
        emitGlobalChatNotification({
          type: 'friend_request',
          title: notifTitle,
          message: notifBody,
          requesterId: req?.requesterId,
        });
      }
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

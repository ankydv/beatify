import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import {
  getFriendsList,
  getPendingRequests,
  sendFriendRequest as apiSendRequest,
  respondFriendRequest as apiRespondRequest,
  sendDirectMessage as apiSendMessage,
  sweepMessagesApi,
  ackMessagesApi,
} from '@/services/friend.service';
import {
  getLocalMessages,
  saveMessageLocally,
  getUnreadCounts,
  markChatAsRead,
  subscribeToChatUpdates,
} from '@/services/chatStorage.service';
import { socket, ensureSocketConnected } from '@/configs/socket';

export const useFriends = () => {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeChatFriend, setActiveChatFriend] = useState(null);
  const activeChatFriendRef = useRef(null);
  activeChatFriendRef.current = activeChatFriend;

  const [chatMessages, setChatMessages] = useState([]);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [incomingNotification, setIncomingNotification] = useState(null);

  // Sync unread counts from device storage
  const syncUnreadCounts = useCallback(async () => {
    const counts = await getUnreadCounts();
    const { total, ...rest } = counts;
    setUnreadCounts(rest);
    setTotalUnreadCount(total || 0);
  }, []);

  useEffect(() => {
    syncUnreadCounts();
    const unsub = subscribeToChatUpdates(syncUnreadCounts);
    return unsub;
  }, [syncUnreadCounts]);

  const fetchFriends = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const token = getTokenRef.current ? await getTokenRef.current() : null;
      const res = await getFriendsList(token);
      if (res?.success && Array.isArray(res.friends)) {
        setFriends(res.friends);
      }
    } catch (e) {
      console.warn('Failed to load friends:', e);
    }
  }, [isSignedIn]);

  const fetchPending = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const token = getTokenRef.current ? await getTokenRef.current() : null;
      const res = await getPendingRequests(token);
      if (res?.success && Array.isArray(res.requests)) {
        setPendingRequests(res.requests);
      }
    } catch (e) {
      console.warn('Failed to load pending requests:', e);
    }
  }, [isSignedIn]);

  const loadAll = useCallback(async () => {
    if (!isSignedIn) return;
    setLoading(true);
    await Promise.allSettled([fetchFriends(), fetchPending(), syncUnreadCounts()]);
    setLoading(false);
  }, [isSignedIn, fetchFriends, fetchPending, syncUnreadCounts]);

  // Load once when user signs in
  useEffect(() => {
    if (isSignedIn) {
      loadAll();
    } else {
      setFriends([]);
      setPendingRequests([]);
      setUnreadCounts({});
      setTotalUnreadCount(0);
    }
  }, [isSignedIn]);

  // Process swept messages from Redis inbox, write to local device DB, and ACK to permanently purge
  const processSweptMessages = useCallback(async (messages) => {
    if (!Array.isArray(messages) || messages.length === 0) return;
    const writtenUuids = [];

    for (const msg of messages) {
      const friendId = msg.senderId === user?.id ? msg.recipientId : msg.senderId;
      if (!friendId) continue;

      const currentActiveId = activeChatFriendRef.current?.friendId || activeChatFriendRef.current?.id;
      const isChatOpen = currentActiveId === friendId;

      // 1. Confirm local database write
      await saveMessageLocally(friendId, { ...msg, read: isChatOpen }, msg.senderId === user?.id);

      if (isChatOpen) {
        setChatMessages((prev) => {
          if (prev.some((m) => (m.uuid || m._id) === (msg.uuid || msg._id))) return prev;
          return [...prev, msg];
        });
      }

      const uuid = msg.uuid || msg._id;
      if (uuid) writtenUuids.push(uuid);
    }

    // 2. The Ack & Purge Phase: send message UUIDs back to server to HDEL from Upstash Redis
    if (writtenUuids.length > 0) {
      socket.emit('ack_messages', { messageUuids: writtenUuids }, (res) => {
        console.log('[Ack] Purged swept messages from Upstash:', res?.purgedCount);
      });
      try {
        const token = getTokenRef.current ? await getTokenRef.current() : null;
        if (token) await ackMessagesApi({ messageUuids: writtenUuids, token });
      } catch (err) {}
    }

    fetchFriends();
    syncUnreadCounts();
  }, [user?.id, fetchFriends, syncUnreadCounts]);

  // The Sweep Phase: Request all pending queued messages on reconnect or foreground
  const sweepPendingMessages = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      await ensureSocketConnected();
      socket.emit('sweep_inbox', {}, async (res) => {
        if (res?.success && Array.isArray(res.messages) && res.messages.length > 0) {
          await processSweptMessages(res.messages);
        }
      });
    } catch (e) {
      // Fallback to REST sweep if socket is reconnecting
      try {
        const token = getTokenRef.current ? await getTokenRef.current() : null;
        const res = await sweepMessagesApi({ token });
        if (res?.success && Array.isArray(res.messages) && res.messages.length > 0) {
          await processSweptMessages(res.messages);
        }
      } catch (err) {}
    }
  }, [isSignedIn, processSweptMessages]);

  // Real-time socket events for friend requests, messages, sweeps, and acks
  useEffect(() => {
    if (!isSignedIn) return;
    let alive = true;

    const handleReqReceived = (req) => {
      if (alive) {
        fetchPending();
        setIncomingNotification({
          type: 'friend_request',
          title: 'New Friend Request 🤝',
          message: `${req?.requesterName || 'A listener'} wants to connect and jam!`,
          requesterId: req?.requesterId,
        });
      }
    };

    const handleMsgReceived = async (msg) => {
      if (!alive || !msg) return;

      const senderId = msg.senderId;
      const currentActiveId = activeChatFriendRef.current?.friendId || activeChatFriendRef.current?.id;
      const isChatOpen = currentActiveId === senderId;

      // 1. Save locally to device DB
      await saveMessageLocally(senderId, { ...msg, read: isChatOpen }, false);

      // 2. The Ack & Purge Phase: confirm local write to server to HDEL from Upstash Redis
      const uuid = msg.uuid || msg._id;
      if (uuid) {
        socket.emit('ack_messages', { messageUuids: [uuid] });
      }

      if (isChatOpen) {
        setChatMessages((prev) => [...prev, msg]);
      } else {
        // Trigger in-app notification banner
        const isInvite = msg.type === 'jam_invite' || Boolean(msg.roomId);
        setIncomingNotification({
          type: isInvite ? 'jam_invite' : 'message',
          title: isInvite ? 'Party Room Invite 🎧' : 'New Message 💬',
          message: msg.message,
          senderId,
          roomId: msg.roomId,
          roomTitle: msg.roomTitle,
        });
      }

      fetchFriends();
      syncUnreadCounts();
    };

    const handleMsgSent = async (msg) => {
      if (!alive || !msg) return;
      const recipientId = msg.recipientId;
      await saveMessageLocally(recipientId, { ...msg, read: true }, true);
      const currentActiveId = activeChatFriendRef.current?.friendId || activeChatFriendRef.current?.id;
      if (currentActiveId === recipientId) {
        setChatMessages((prev) => {
          if (prev.some((m) => (m.uuid || m._id) && (msg.uuid || msg._id) && (m.uuid || m._id) === (msg.uuid || msg._id))) return prev;
          return [...prev, msg];
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

        socket.on('friend:request-received', handleReqReceived);
        socket.on('friend:message-received', handleMsgReceived);
        socket.on('friend:message-sent', handleMsgSent);
        socket.on('chat:sweep-response', handleSweepResponse);
        socket.on('inbox:swept', handleSweepResponse);
        socket.on('connect', sweepPendingMessages);

        // Immediate sweep on mount
        sweepPendingMessages();
      } catch (e) {}
    })();

    // Foreground listener: sweep when app comes to foreground
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        sweepPendingMessages();
      }
    });

    return () => {
      alive = false;
      socket.off('friend:request-received', handleReqReceived);
      socket.off('friend:message-received', handleMsgReceived);
      socket.off('friend:message-sent', handleMsgSent);
      socket.off('chat:sweep-response', handleSweepResponse);
      socket.off('inbox:swept', handleSweepResponse);
      socket.off('connect', sweepPendingMessages);
      appStateSub.remove();
    };
  }, [isSignedIn, fetchPending, fetchFriends, syncUnreadCounts, sweepPendingMessages, processSweptMessages]);

  const sendRequest = async (recipientId) => {
    const token = getTokenRef.current ? await getTokenRef.current() : null;
    const res = await apiSendRequest({ recipientId, token });
    fetchFriends();
    return res;
  };

  const respondRequest = async (friendshipId, action) => {
    const token = getTokenRef.current ? await getTokenRef.current() : null;
    const res = await apiRespondRequest({ friendshipId, action, token });
    fetchFriends();
    fetchPending();
    return res;
  };

  // Open dedicated chat with friend
  const openChat = async (friend) => {
    const friendId = friend.friendId || friend.id;
    setActiveChatFriend(friend);

    // 1. Immediately load local messages from device
    const localMsgs = await getLocalMessages(friendId);
    setChatMessages(localMsgs);

    // 2. Mark chat as read
    await markChatAsRead(friendId);
    syncUnreadCounts();
  };

  const closeChat = () => {
    setActiveChatFriend(null);
    setChatMessages([]);
  };

  // Send regular chat message
  const sendChatMessage = async (text) => {
    if (!activeChatFriend || !text?.trim()) return;
    const friendId = activeChatFriend.friendId || activeChatFriend.id;
    setSendingMsg(true);

    const msgUuid = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const localMsg = {
      _id: msgUuid,
      uuid: msgUuid,
      senderId: user?.id,
      recipientId: friendId,
      message: text.trim(),
      type: 'text',
      createdAt: new Date().toISOString(),
      read: true,
    };

    // Save locally immediately
    await saveMessageLocally(friendId, localMsg, true);
    setChatMessages((prev) => [...prev, localMsg]);

    try {
      const token = getTokenRef.current ? await getTokenRef.current() : null;
      await apiSendMessage({
        recipientId: friendId,
        message: text.trim(),
        type: 'text',
        uuid: msgUuid,
        saveToCloud: false, // Default device-only
        token,
      });
      fetchFriends();
    } catch (e) {
      console.warn('Failed to send message:', e);
    } finally {
      setSendingMsg(false);
    }
  };

  // Send Jam room invite to any friend (clickable invite in chat)
  const sendInvite = async ({ recipientId, roomId, roomTitle }) => {
    if (!recipientId || !roomId) return;
    try {
      const token = getTokenRef.current ? await getTokenRef.current() : null;
      const inviteText = `Join my party room #${roomId}: ${roomTitle || 'Live Jam'} 🎧`;
      const invUuid = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const localMsg = {
        _id: invUuid,
        uuid: invUuid,
        senderId: user?.id,
        recipientId,
        message: inviteText,
        type: 'jam_invite',
        roomId: String(roomId),
        roomTitle: roomTitle || `Party Room #${roomId}`,
        createdAt: new Date().toISOString(),
        read: true,
      };

      // Save locally
      await saveMessageLocally(recipientId, localMsg, true);

      // If this friend's chat is open, update timeline
      const currentActiveId = activeChatFriendRef.current?.friendId || activeChatFriendRef.current?.id;
      if (currentActiveId === recipientId) {
        setChatMessages((prev) => [...prev, localMsg]);
      }

      await apiSendMessage({
        recipientId,
        message: inviteText,
        type: 'jam_invite',
        roomId: String(roomId),
        roomTitle: roomTitle || `Party Room #${roomId}`,
        uuid: invUuid,
        saveToCloud: false,
        token,
      });

      fetchFriends();
      return { success: true };
    } catch (e) {
      console.warn('Failed to send jam invite:', e);
      return { success: false, message: e.message };
    }
  };

  const dismissNotification = () => {
    setIncomingNotification(null);
  };

  return {
    friends,
    pendingRequests,
    loading,
    refreshFriends: loadAll,
    sendRequest,
    respondRequest,
    activeChatFriend,
    chatMessages,
    openChat,
    closeChat,
    sendChatMessage,
    sendInvite,
    sendingMsg,
    unreadCounts,
    totalUnreadCount,
    incomingNotification,
    dismissNotification,
  };
};

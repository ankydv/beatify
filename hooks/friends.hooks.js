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
  getLocalMessagesPaginated,
  saveMessageLocally,
  getUnreadCounts,
  markChatAsRead,
  subscribeToChatUpdates,
  setActiveChatId,
  markOutgoingMessagesAsSent,
  markOutgoingMessagesAsDelivered,
  markOutgoingMessagesAsSeen,
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
  const [displayLimit, setDisplayLimit] = useState(20);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
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

  // Real-time socket events for friend requests
  useEffect(() => {
    if (!isSignedIn) return;
    let alive = true;

    const handleReqReceived = () => {
      if (alive) {
        fetchPending();
        fetchFriends();
      }
    };

    socket.on('friend:request-received', handleReqReceived);
    return () => {
      alive = false;
      socket.off('friend:request-received', handleReqReceived);
    };
  }, [isSignedIn, fetchPending, fetchFriends]);

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

  // Sync open conversation messages whenever chat storage updates
  useEffect(() => {
    if (!activeChatFriend) return;
    const friendId = activeChatFriend.friendId || activeChatFriend.id;
    const syncConversation = async () => {
      const { messages, hasMore } = await getLocalMessagesPaginated(friendId, displayLimit);
      setChatMessages(messages);
      setHasMoreOlder(hasMore);
    };
    const unsub = subscribeToChatUpdates(syncConversation);
    return () => {
      unsub();
    };
  }, [activeChatFriend, displayLimit]);

  // Open dedicated chat with friend (loads last 20 messages)
  const openChat = async (friend) => {
    const friendId = friend.friendId || friend.id;
    setActiveChatId(friendId);
    setActiveChatFriend(friend);
    setDisplayLimit(20);

    // 1. Immediately load last 20 messages from device
    const { messages, hasMore } = await getLocalMessagesPaginated(friendId, 20);
    setChatMessages(messages);
    setHasMoreOlder(hasMore);

    // 2. Mark chat as read
    await markChatAsRead(friendId);
    syncUnreadCounts();

    // 3. Emit read receipt to sender over socket
    try {
      socket.emit('friend:read-receipt', { recipientId: friendId, readerId: user?.id });
    } catch (e) {}
  };

  // Load 10 older messages when user pulls down or requests older history
  const loadOlderMessages = async () => {
    if (!activeChatFriend || loadingOlder || !hasMoreOlder) return;
    setLoadingOlder(true);
    try {
      const friendId = activeChatFriend.friendId || activeChatFriend.id;
      const nextLimit = displayLimit + 10;
      const { messages, hasMore } = await getLocalMessagesPaginated(friendId, nextLimit);
      setDisplayLimit(nextLimit);
      setChatMessages(messages);
      setHasMoreOlder(hasMore);
    } catch (e) {
      console.warn('Failed to load older messages:', e);
    } finally {
      setLoadingOlder(false);
    }
  };

  const closeChat = () => {
    setActiveChatId(null);
    setActiveChatFriend(null);
    setChatMessages([]);
    setDisplayLimit(20);
    setHasMoreOlder(false);
  };

  // Send regular chat message
  const sendChatMessage = async (text) => {
    if (!activeChatFriend || !text?.trim()) return;
    const friendId = activeChatFriend.friendId || activeChatFriend.id;
    setSendingMsg(true);

    const myName =
      user?.fullName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
      user?.username ||
      user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
      '';

    const msgUuid = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const localMsg = {
      _id: msgUuid,
      uuid: msgUuid,
      senderId: user?.id,
      senderName: myName,
      recipientId: friendId,
      message: text.trim(),
      type: 'text',
      createdAt: new Date().toISOString(),
      read: true,
      isOutgoing: true,
      status: 'sending',
    };

    // Save locally immediately
    await saveMessageLocally(friendId, localMsg, true);
    setChatMessages((prev) => {
      const incomingId = localMsg.uuid || localMsg._id;
      if (prev.some((m) => (m.uuid || m._id) === incomingId)) return prev;
      return [...prev, localMsg];
    });

    try {
      const token = getTokenRef.current ? await getTokenRef.current() : null;
      await apiSendMessage({
        recipientId: friendId,
        message: text.trim(),
        type: 'text',
        uuid: msgUuid,
        senderName: myName,
        saveToCloud: false, // Default device-only
        token,
      });
      // Mark as sent in local storage (single checkmark until recipient ACKs)
      await markOutgoingMessagesAsSent(friendId, [msgUuid]);
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
      const myName =
        user?.fullName ||
        [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
        user?.username ||
        user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
        '';

      const inviteText = `Join my party room #${roomId}: ${roomTitle || 'Live Jam'} 🎧`;
      const invUuid = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const localMsg = {
        _id: invUuid,
        uuid: invUuid,
        senderId: user?.id,
        senderName: myName,
        recipientId,
        message: inviteText,
        type: 'jam_invite',
        roomId: String(roomId),
        roomTitle: roomTitle || `Party Room #${roomId}`,
        createdAt: new Date().toISOString(),
        read: true,
        isOutgoing: true,
        status: 'sent',
      };

      // Save locally
      await saveMessageLocally(recipientId, localMsg, true);

      // If this friend's chat is open, update timeline
      const currentActiveId = activeChatFriendRef.current?.friendId || activeChatFriendRef.current?.id;
      if (currentActiveId === recipientId) {
        setChatMessages((prev) => {
          const incomingId = localMsg.uuid || localMsg._id;
          if (prev.some((m) => (m.uuid || m._id) === incomingId)) return prev;
          return [...prev, localMsg];
        });
      }

      await apiSendMessage({
        recipientId,
        message: inviteText,
        type: 'jam_invite',
        roomId: String(roomId),
        roomTitle: roomTitle || `Party Room #${roomId}`,
        uuid: invUuid,
        senderName: myName,
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
    hasMoreOlder,
    loadingOlder,
    loadOlderMessages,
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

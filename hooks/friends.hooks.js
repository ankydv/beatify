import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import {
  getFriendsList,
  getPendingRequests,
  sendFriendRequest as apiSendRequest,
  respondFriendRequest as apiRespondRequest,
  getDirectMessages,
  sendDirectMessage as apiSendMessage,
} from '@/services/friend.service';
import { socket, ensureSocketConnected } from '@/configs/socket';

export const useFriends = () => {
  const { getToken, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeChatFriend, setActiveChatFriend] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [sendingMsg, setSendingMsg] = useState(false);

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
    await Promise.allSettled([fetchFriends(), fetchPending()]);
    setLoading(false);
  }, [isSignedIn, fetchFriends, fetchPending]);

  // Load once when user signs in
  useEffect(() => {
    if (isSignedIn) {
      loadAll();
    } else {
      setFriends([]);
      setPendingRequests([]);
    }
  }, [isSignedIn]);

  // Real-time socket events for friend requests and messages
  useEffect(() => {
    if (!isSignedIn) return;
    let alive = true;

    const handleReqReceived = () => {
      if (alive) fetchPending();
    };

    const handleMsgReceived = (msg) => {
      if (!alive) return;
      setChatMessages((prev) => [...prev, msg]);
      fetchFriends();
    };

    const handleMsgSent = (msg) => {
      if (!alive) return;
      setChatMessages((prev) => [...prev, msg]);
    };

    (async () => {
      try {
        await ensureSocketConnected();
        if (!alive) return;

        socket.on('friend:request-received', handleReqReceived);
        socket.on('friend:message-received', handleMsgReceived);
        socket.on('friend:message-sent', handleMsgSent);
      } catch (e) {}
    })();

    return () => {
      alive = false;
      socket.off('friend:request-received', handleReqReceived);
      socket.off('friend:message-received', handleMsgReceived);
      socket.off('friend:message-sent', handleMsgSent);
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

  const openChat = async (friend) => {
    setActiveChatFriend(friend);
    try {
      const token = getTokenRef.current ? await getTokenRef.current() : null;
      const res = await getDirectMessages({ friendId: friend.friendId || friend.id, token });
      if (res?.success) {
        setChatMessages(res.messages || []);
      }
    } catch (e) {
      console.warn('Failed to load chat history:', e);
    }
  };

  const closeChat = () => {
    setActiveChatFriend(null);
    setChatMessages([]);
  };

  const sendChatMessage = async (text) => {
    if (!activeChatFriend || !text?.trim()) return;
    setSendingMsg(true);
    try {
      const token = getTokenRef.current ? await getTokenRef.current() : null;
      await apiSendMessage({
        recipientId: activeChatFriend.friendId || activeChatFriend.id,
        message: text.trim(),
        token,
      });
      fetchFriends();
    } catch (e) {
      console.warn('Failed to send message:', e);
    } finally {
      setSendingMsg(false);
    }
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
    sendingMsg,
  };
};

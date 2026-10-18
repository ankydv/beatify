import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_PREFIX = '@beatify_chat_';
const UNREAD_PREFIX = '@beatify_unread_';

// Simple event subscriber for cross-component unread updates
const listeners = new Set();

export const subscribeToChatUpdates = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const notifySubscribers = () => {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {}
  });
};

/**
 * Get messages stored locally on device for a specific friend
 */
export const getLocalMessages = async (friendId) => {
  if (!friendId) return [];
  try {
    const raw = await AsyncStorage.getItem(`${CHAT_PREFIX}${friendId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed to load local messages:', e);
    return [];
  }
};

/**
 * Get paginated messages stored locally on device for a specific friend
 * Returns the most recent `limit` messages (e.g., last 20), along with total and hasMore flag.
 */
export const getLocalMessagesPaginated = async (friendId, limit = 20) => {
  if (!friendId) return { messages: [], total: 0, hasMore: false };
  try {
    const all = await getLocalMessages(friendId);
    const total = all.length;
    const start = Math.max(0, total - limit);
    const messages = all.slice(start);
    return {
      messages,
      total,
      hasMore: start > 0,
    };
  } catch (e) {
    console.warn('Failed to load paginated messages:', e);
    return { messages: [], total: 0, hasMore: false };
  }
};

/**
 * Save a message locally on device
 */
export const saveMessageLocally = async (friendId, msg, isOutgoing = false) => {
  if (!friendId || !msg) return [];
  try {
    const existing = await getLocalMessages(friendId);
    const incomingId = msg.uuid || msg._id;

    // De-duplicate by uuid/_id or matching payload timestamp
    const exists = existing.some((m) => {
      const existingId = m.uuid || m._id;
      if (existingId && incomingId && existingId === incomingId) return true;
      if (
        m.senderId === msg.senderId &&
        m.message === msg.message &&
        Math.abs(new Date(m.createdAt || 0).getTime() - new Date(msg.createdAt || 0).getTime()) < 3000
      ) {
        return true;
      }
      return false;
    });
    if (exists) return existing;

    const formatted = {
      _id: incomingId || `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      uuid: incomingId || undefined,
      senderId: msg.senderId,
      senderName: msg.senderName || undefined,
      recipientId: msg.recipientId,
      message: msg.message,
      type: msg.type || (msg.roomId ? 'jam_invite' : 'text'),
      roomId: msg.roomId || null,
      roomTitle: msg.roomTitle || null,
      createdAt: msg.createdAt || new Date().toISOString(),
      read: isOutgoing ? true : Boolean(msg.read),
      isOutgoing: Boolean(isOutgoing),
      status: msg.status || (isOutgoing ? 'sent' : 'delivered'),
    };

    const updated = [...existing, formatted].slice(-300); // keep recent 300
    await AsyncStorage.setItem(`${CHAT_PREFIX}${friendId}`, JSON.stringify(updated));

    // Update unread count if incoming
    if (!isOutgoing && !formatted.read) {
      await incrementUnread(friendId);
    }

    notifySubscribers();
    return updated;
  } catch (e) {
    console.warn('Failed to save message locally:', e);
    return [];
  }
};

/**
 * Mark outgoing messages as sent (confirmed written by server, single checkmark)
 */
export const markOutgoingMessagesAsSent = async (friendId, messageUuids = null) => {
  if (!friendId) return [];
  try {
    const messages = await getLocalMessages(friendId);
    let changed = false;
    const targetSet = Array.isArray(messageUuids) ? new Set(messageUuids) : null;

    const updated = messages.map((m) => {
      if (m.isOutgoing && m.status === 'sending') {
        const matches = !targetSet || targetSet.has(m.uuid) || targetSet.has(m._id);
        if (matches) {
          changed = true;
          return { ...m, status: 'sent' };
        }
      }
      return m;
    });

    if (changed) {
      await AsyncStorage.setItem(`${CHAT_PREFIX}${friendId}`, JSON.stringify(updated));
      notifySubscribers();
    }
    return updated;
  } catch (e) {
    return [];
  }
};

/**
 * Mark outgoing messages as delivered
 */
export const markOutgoingMessagesAsDelivered = async (friendId, messageUuids = null) => {
  if (!friendId) return [];
  try {
    const messages = await getLocalMessages(friendId);
    let changed = false;
    const targetSet = Array.isArray(messageUuids) ? new Set(messageUuids) : null;

    const updated = messages.map((m) => {
      if (m.isOutgoing && m.status !== 'seen') {
        const matches = !targetSet || targetSet.has(m.uuid) || targetSet.has(m._id);
        if (matches) {
          changed = true;
          return { ...m, status: 'delivered' };
        }
      }
      return m;
    });

    if (changed) {
      await AsyncStorage.setItem(`${CHAT_PREFIX}${friendId}`, JSON.stringify(updated));
      notifySubscribers();
    }
    return updated;
  } catch (e) {
    return [];
  }
};

/**
 * Mark all outgoing messages to a friend as seen (read receipt from friend)
 */
export const markOutgoingMessagesAsSeen = async (friendId) => {
  if (!friendId) return [];
  try {
    const messages = await getLocalMessages(friendId);
    let changed = false;

    const updated = messages.map((m) => {
      if (m.isOutgoing && m.status !== 'seen') {
        changed = true;
        return { ...m, status: 'seen' };
      }
      return m;
    });

    if (changed) {
      await AsyncStorage.setItem(`${CHAT_PREFIX}${friendId}`, JSON.stringify(updated));
      notifySubscribers();
    }
    return updated;
  } catch (e) {
    return [];
  }
};

/**
 * Active Chat Tracker: Track which friend's chat screen is currently open
 */
let currentActiveChatId = null;
const activeChatListeners = new Set();

export const subscribeToActiveChat = (fn) => {
  activeChatListeners.add(fn);
  fn(currentActiveChatId);
  return () => activeChatListeners.delete(fn);
};

export const setActiveChatId = (friendId) => {
  const nextId = friendId ? String(friendId) : null;
  if (currentActiveChatId !== nextId) {
    currentActiveChatId = nextId;
    activeChatListeners.forEach((fn) => {
      try {
        fn(currentActiveChatId);
      } catch (e) {}
    });
  }
};

export const getActiveChatId = () => currentActiveChatId;

/**
 * Global In-App Notification Event Hub
 */
const notifListeners = new Set();

export const subscribeToGlobalChatNotifications = (fn) => {
  notifListeners.add(fn);
  return () => notifListeners.delete(fn);
};

export const emitGlobalChatNotification = (notif) => {
  notifListeners.forEach((fn) => {
    try {
      fn(notif);
    } catch (e) {}
  });
};

/**
 * Get unread counts map for all friends: { [friendId]: number, total: number }
 */
export const getUnreadCounts = async () => {
  try {
    const raw = await AsyncStorage.getItem(UNREAD_PREFIX);
    const map = raw ? JSON.parse(raw) : {};
    let total = 0;
    Object.values(map).forEach((c) => {
      total += Number(c) || 0;
    });
    return { ...map, total };
  } catch (e) {
    return { total: 0 };
  }
};

/**
 * Increment unread count for a friend
 */
export const incrementUnread = async (friendId) => {
  if (!friendId) return;
  try {
    const counts = await getUnreadCounts();
    counts[friendId] = (counts[friendId] || 0) + 1;
    delete counts.total;
    await AsyncStorage.setItem(UNREAD_PREFIX, JSON.stringify(counts));
    notifySubscribers();
  } catch (e) {}
};

/**
 * Mark all messages from a friend as read
 */
export const markChatAsRead = async (friendId) => {
  if (!friendId) return;
  try {
    // 1. Mark in messages list
    const messages = await getLocalMessages(friendId);
    const updated = messages.map((m) => ({ ...m, read: true }));
    await AsyncStorage.setItem(`${CHAT_PREFIX}${friendId}`, JSON.stringify(updated));

    // 2. Clear unread count for this friend
    const counts = await getUnreadCounts();
    delete counts[friendId];
    delete counts.total;
    await AsyncStorage.setItem(UNREAD_PREFIX, JSON.stringify(counts));

    notifySubscribers();
  } catch (e) {}
};

/**
 * Clear local conversation
 */
export const clearLocalChat = async (friendId) => {
  if (!friendId) return;
  try {
    await AsyncStorage.removeItem(`${CHAT_PREFIX}${friendId}`);
    notifySubscribers();
  } catch (e) {}
};


import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import {
  View,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
  BackHandler,
  TextInput as RNTextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme, TextInput, Button, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { useIsFocused } from '@react-navigation/native';
import { socket } from '@/configs/socket';
import { setActiveChatId, markChatAsRead } from '@/services/chatStorage.service';

import { useFriends } from '@/hooks/friends.hooks';

// ---- Memoized bubbles: typing in the input (chatInputText state) must NOT
// re-render every mounted bubble. Same for status ticks + invite cards.
const StatusTick = memo(function StatusTick({ status, read }) {
  const s = status || (read ? 'seen' : 'sent');
  if (s === 'sending') {
    return <Icon name="clock-outline" size={11} color="rgba(255,255,255,0.6)" style={styles.statusTick} />;
  }
  if (s === 'seen') {
    return <Icon name="check-all" size={13} color="#00E5FF" style={styles.statusTick} />;
  }
  if (s === 'delivered') {
    return <Icon name="check-all" size={13} color="rgba(255,255,255,0.85)" style={styles.statusTick} />;
  }
  return <Icon name="check" size={12} color="rgba(255,255,255,0.7)" style={styles.statusTick} />;
});

const ChatBubble = memo(function ChatBubble({ msg, isMe, bubbleBg, bubbleTextColor, onFollowRoom }) {
  const time = useMemo(() => {
    if (!msg.createdAt) return '';
    try {
      return new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }, [msg.createdAt]);

  const isJamInvite = msg.type === 'jam_invite' || Boolean(msg.roomId);
  if (isJamInvite) {
    return (
      <View
        style={[
          styles.inviteCardWrapper,
          isMe ? styles.inviteCardMe : styles.inviteCardOther,
        ]}
      >
        <LinearGradient
          colors={isMe ? ['#8A2387', '#E94057'] : ['#1F1C2C', '#928DAB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.inviteCardGradient}
        >
          <View style={styles.inviteCardHeader}>
            <Icon name="music-box-multiple" size={18} color="#FFFFFF" />
            <Text style={styles.inviteCardBadge}>PARTY ROOM INVITE 🎧</Text>
          </View>
          <Text style={styles.inviteCardTitle} numberOfLines={2}>
            {msg.roomTitle || `Party Room #${msg.roomId}`}
          </Text>
          <Text style={styles.inviteCardCode}>Room Code: #{msg.roomId}</Text>

          <TouchableOpacity
            style={styles.inviteJoinButton}
            onPress={() => onFollowRoom?.(msg.roomId)}
            activeOpacity={0.85}
          >
            <Text style={styles.inviteJoinButtonText}>Join Jam Room 🚀</Text>
            <Icon name="arrow-right-circle" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          <View style={styles.inviteMetaRow}>
            <Text style={styles.inviteTimeText}>{time}</Text>
            {isMe && <StatusTick status={msg.status} read={msg.read} />}
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (isMe) {
    return (
      <View style={styles.chatBubbleMeContainer}>
        <LinearGradient
          colors={['#8A2387', '#E94057']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.chatBubbleGradientMe}
        >
          <Text style={styles.chatBubbleTextMe}>{msg.message}</Text>
          <View style={styles.bubbleMetaMe}>
            <Text style={styles.bubbleTimeMe}>{time}</Text>
            <StatusTick status={msg.status} read={msg.read} />
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.chatBubbleOther, { backgroundColor: bubbleBg }]}>
      <Text style={[styles.chatBubbleTextOther, { color: bubbleTextColor }]}>
        {msg.message}
      </Text>
      <View style={styles.bubbleMetaOther}>
        <Text style={styles.bubbleTimeOther}>{time}</Text>
      </View>
    </View>
  );
});

// Memoized Friend Row in Chat List
const FriendRow = memo(function FriendRow({
  friend: f,
  unread,
  theme,
  onPress,
  onFollowRoom,
}) {
  const friendId = f.friendId || f.id;
  const isLive = f.isLiveInRoom && f.roomInfo?.roomId;

  return (
    <TouchableOpacity
      style={[styles.friendRow, { backgroundColor: theme.colors.elevation.level1 }]}
      onPress={() => onPress(f)}
      activeOpacity={0.78}
    >
      <View style={styles.friendRowAvatarBox}>
        {f.picture ? (
          <Image source={{ uri: f.picture }} style={styles.friendRowAvatar} />
        ) : (
          <View style={[styles.friendRowAvatar, styles.avatarFallback]}>
            <Icon name="account" size={24} color="#FFFFFF" />
          </View>
        )}
        {isLive && <View style={styles.liveIndicatorBadge} />}
      </View>

      <View style={styles.friendRowMeta}>
        <View style={styles.friendRowTopLine}>
          <Text style={styles.friendRowName} numberOfLines={1}>
            {f.name}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.synergyBadge}>
              <Icon name="shimmer" size={11} color="#FFD700" />
              <Text style={styles.synergyBadgeText}>{f.synergyPoints || 10} Synergy</Text>
            </View>

            {unread > 0 && (
              <View style={styles.unreadCountBadge}>
                <Text style={styles.unreadCountText}>{unread}</Text>
              </View>
            )}
          </View>
        </View>

        <Text
          style={[styles.friendRowStatus, unread > 0 && styles.friendRowStatusUnread]}
          numberOfLines={1}
        >
          {isLive
            ? `🎧 Live in ${f.roomInfo?.title || `Room #${f.roomInfo?.roomId}`}`
            : f.lastMessage?.message
            ? f.lastMessage.message
            : 'Tap to open chat'}
        </Text>
      </View>

      {isLive ? (
        <TouchableOpacity
          style={styles.chatListFollowBtn}
          onPress={(e) => {
            e.stopPropagation();
            onFollowRoom(f.roomInfo?.roomId);
          }}
          activeOpacity={0.8}
        >
          <Icon name="account-arrow-right" size={14} color="#FFFFFF" />
          <Text style={styles.chatListFollowBtnText}>Follow</Text>
        </TouchableOpacity>
      ) : (
        <Icon name="chevron-right" size={20} color="#888888" style={{ marginLeft: 6 }} />
      )}
    </TouchableOpacity>
  );
});

export default function ChatScreen() {
  const router = useRouter();
  const { friendId: paramFriendId } = useLocalSearchParams();
  const theme = useTheme();
  const { user } = useUser();

  const {
    friends,
    pendingRequests,
    loading,
    refreshFriends,
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
  } = useFriends();

  const [searchQuery, setSearchQuery] = useState('');
  const [chatInputText, setChatInputText] = useState('');
  const [respondingId, setRespondingId] = useState(null);

  // Scroll & conversation state management
  const flatListRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const currentScrollYRef = useRef(0);
  const lastMessageIdRef = useRef(null);
  const handledParamFriendIdRef = useRef(null);
  const [showScrollBottomHint, setShowScrollBottomHint] = useState(false);

  // Follow friend into their active party room
  const handleFollowRoom = useCallback((roomId) => {
    if (!roomId) return;
    router.push({
      pathname: 'voiceRoom',
      params: { roomId: String(roomId) },
    });
  }, [router]);

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!chatInputText.trim()) return;
    const msg = chatInputText.trim();
    setChatInputText('');
    await sendChatMessage(msg);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowScrollBottomHint(false);
  }, [chatInputText, sendChatMessage]);

  const handleCloseConversation = useCallback(() => {
    closeChat();
    handledParamFriendIdRef.current = null;
    if (paramFriendId) {
      router.setParams({ friendId: '' });
    }
  }, [closeChat, paramFriendId, router]);

  const handleLoadOlder = useCallback(async () => {
    if (!hasMoreOlder || loadingOlder) return;
    await loadOlderMessages();
  }, [hasMoreOlder, loadingOlder, loadOlderMessages]);

  // Auto-open chat if navigated with friendId param
  useEffect(() => {
    if (paramFriendId && friends.length > 0) {
      if (handledParamFriendIdRef.current === paramFriendId) return;
      const target = friends.find((f) => (f.friendId || f.id) === paramFriendId);
      if (target && (!activeChatFriend || (activeChatFriend.friendId || activeChatFriend.id) !== paramFriendId)) {
        handledParamFriendIdRef.current = paramFriendId;
        openChat(target);
      }
    }
  }, [paramFriendId, friends, activeChatFriend, openChat]);

  const isFocused = useIsFocused();

  // Keep activeChatId synced with screen focus:
  // When user switches away to another tab, activeChatId MUST be cleared so incoming messages
  // are NOT falsely treated as "viewing conversation" and properly trigger unread badge & notification.
  useEffect(() => {
    if (isFocused && activeChatFriend) {
      const friendId = activeChatFriend.friendId || activeChatFriend.id;
      setActiveChatId(friendId);
      markChatAsRead(friendId);
      socket.emit('friend:read-receipt', { recipientId: friendId, readerId: user?.id });
    } else {
      setActiveChatId(null);
    }
  }, [isFocused, activeChatFriend, user?.id]);

  // Real-time blue tick read receipts: whenever new messages arrive while this screen is focused
  useEffect(() => {
    if (isFocused && activeChatFriend && chatMessages.length > 0) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg && !lastMsg.isOutgoing) {
        const friendId = activeChatFriend.friendId || activeChatFriend.id;
        markChatAsRead(friendId);
        socket.emit('friend:read-receipt', { recipientId: friendId, readerId: user?.id });
      }
    }
  }, [chatMessages, isFocused, activeChatFriend, user?.id]);

  // Inverted data for FlatList: index 0 is newest (bottom)
  const invertedMessages = useMemo(() => {
    return [...chatMessages].reverse();
  }, [chatMessages]);

  const renderMessageItem = useCallback(
    ({ item: msg }) => {
      const isMe = msg.senderId === user?.id;
      return (
        <ChatBubble
          msg={msg}
          isMe={isMe}
          bubbleBg={theme.colors.elevation.level2}
          bubbleTextColor={theme.colors.onSurface}
          onFollowRoom={handleFollowRoom}
        />
      );
    },
    [user?.id, theme.colors.elevation.level2, theme.colors.onSurface, handleFollowRoom]
  );

  const keyExtractor = useCallback((item, index) => {
    return item.uuid || item._id || `${item.senderId}-${item.createdAt}-${index}`;
  }, []);

  const renderFooter = useCallback(() => {
    if (!hasMoreOlder) return null;
    return (
      <TouchableOpacity
        style={styles.loadOlderBtn}
        onPress={handleLoadOlder}
        disabled={loadingOlder}
        activeOpacity={0.7}
      >
        {loadingOlder ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="arrow-up-circle-outline" size={15} color="#9E9EA7" style={{ marginRight: 6 }} />
            <Text style={styles.loadOlderText}>Load older messages</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [hasMoreOlder, loadingOlder, handleLoadOlder, theme.colors.primary]);

  // Reset scroll flags when active chat changes
  useEffect(() => {
    if (activeChatFriend) {
      isNearBottomRef.current = true;
      setShowScrollBottomHint(false);
      prevMessageCountRef.current = 0;
      lastMessageIdRef.current = null;
    }
  }, [activeChatFriend]);

  // Handle auto-scroll or show "New messages below" hint
  useEffect(() => {
    if (!activeChatFriend) return;
    const count = chatMessages.length;
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = count;

    if (count === 0) return;

    const lastMsg = chatMessages[count - 1];
    const currentLastId = lastMsg?.uuid || lastMsg?._id || lastMsg?.id;
    const isNewBottomMessage = Boolean(
      lastMessageIdRef.current && currentLastId && lastMessageIdRef.current !== currentLastId
    );
    lastMessageIdRef.current = currentLastId;

    if (count > prevCount && isNewBottomMessage) {
      const isMe = lastMsg?.senderId === user?.id;

      if (isMe || isNearBottomRef.current) {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        setShowScrollBottomHint(false);
      } else {
        setShowScrollBottomHint(true);
      }
    }
  }, [chatMessages, activeChatFriend, user?.id]);

  // Android hardware back handler: return to chat list if conversation is open
  useEffect(() => {
    const handleHardwareBack = () => {
      if (activeChatFriend) {
        handleCloseConversation();
        return true; // Consume event so it doesn't navigate back to home screen
      }
      if (!router.canGoBack()) {
        router.replace('/(tabs)/homeRoutes');
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => sub.remove();
  }, [activeChatFriend, paramFriendId, closeChat]);

  // Handle responding to a friend request
  const handleResponse = async (friendshipId, action) => {
    setRespondingId(friendshipId);
    try {
      await respondRequest(friendshipId, action);
      if (action === 'accept') {
        Alert.alert('Friend Connected! 🎉', 'You unlocked mutual synergy points with your new music friend.');
      }
    } catch (e) {
      Alert.alert('Notice', e?.message || 'Failed to update request');
    } finally {
      setRespondingId(null);
    }
  };

  const filteredFriends = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return friends;
    return friends.filter((f) => (f.name || '').toLowerCase().includes(q));
  }, [friends, searchQuery]);

  // Throttled via rAF for inverted FlatList: offset <= 60 is bottom
  const scrollTickingRef = useRef(false);
  const handleConversationScroll = useCallback((e) => {
    if (scrollTickingRef.current) return;
    scrollTickingRef.current = true;
    const y = e.nativeEvent.contentOffset.y;
    requestAnimationFrame(() => {
      scrollTickingRef.current = false;
      currentScrollYRef.current = y;
      const isClose = y <= 60;
      isNearBottomRef.current = isClose;
      if (isClose) setShowScrollBottomHint((prev) => (prev ? false : prev));
    });
  }, []);

  const liveFriends = useMemo(() => {
    return friends.filter((f) => f.isLiveInRoom && f.roomInfo);
  }, [friends]);

  // Chat List Pagination: paginate friends list to scale cleanly
  const CHAT_PAGE_SIZE = 15;
  const [chatListPage, setChatListPage] = useState(1);

  // Reset pagination when searching
  useEffect(() => {
    setChatListPage(1);
  }, [searchQuery]);

  const paginatedFriends = useMemo(() => {
    return filteredFriends.slice(0, chatListPage * CHAT_PAGE_SIZE);
  }, [filteredFriends, chatListPage]);

  const hasMoreFriends = paginatedFriends.length < filteredFriends.length;

  const handleLoadMoreFriends = useCallback(() => {
    if (hasMoreFriends) {
      setChatListPage((prev) => prev + 1);
    }
  }, [hasMoreFriends]);

  const renderFriendRow = useCallback(
    ({ item: f }) => {
      const friendId = f.friendId || f.id;
      const unread = unreadCounts[friendId] || 0;
      return (
        <FriendRow
          friend={f}
          unread={unread}
          theme={theme}
          onPress={openChat}
          onFollowRoom={handleFollowRoom}
        />
      );
    },
    [unreadCounts, theme, openChat, handleFollowRoom]
  );

  const friendKeyExtractor = useCallback((f) => {
    return String(f.friendId || f.id || f._id);
  }, []);

  const chatListHeader = useMemo(() => {
    return (
      <View>
        {/* Incoming Friend Requests */}
        {pendingRequests.length > 0 && (
          <View style={styles.pendingSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="account-clock" size={20} color="#FFD700" style={{ marginRight: 6 }} />
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Incoming Requests ({pendingRequests.length})
                </Text>
              </View>
            </View>

            {pendingRequests.map((req) => (
              <View
                key={req._id}
                style={[styles.pendingCard, { backgroundColor: theme.colors.elevation.level2 }]}
              >
                <View style={styles.pendingUserMeta}>
                  {req.requesterPicture ? (
                    <Image source={{ uri: req.requesterPicture }} style={styles.pendingAvatar} />
                  ) : (
                    <View style={[styles.pendingAvatar, styles.avatarFallback]}>
                      <Icon name="account" size={18} color="#FFFFFF" />
                    </View>
                  )}
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.pendingName} numberOfLines={1}>
                      {req.requesterName}
                    </Text>
                    <Text style={styles.pendingSub}>Wants to vibe & listen with you</Text>
                  </View>
                </View>

                <View style={styles.pendingActionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.acceptBtn]}
                    onPress={() => handleResponse(req._id, 'accept')}
                    disabled={respondingId === req._id}
                  >
                    <Icon name="check" size={16} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Accept</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.declineBtn]}
                    onPress={() => handleResponse(req._id, 'decline')}
                    disabled={respondingId === req._id}
                  >
                    <Icon name="close" size={16} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Live Friends in Rooms */}
        {liveFriends.length > 0 && (
          <View style={styles.liveSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.liveDot} />
              <Text variant="titleSmall" style={styles.sectionTitle}>
                Friends Vibing in Rooms ({liveFriends.length})
              </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveScroll}>
              {liveFriends.map((f) => (
                <View
                  key={f.friendId}
                  style={[styles.liveFriendCard, { backgroundColor: theme.colors.elevation.level2 }]}
                >
                  <View style={styles.liveAvatarBox}>
                    {f.picture ? (
                      <Image source={{ uri: f.picture }} style={styles.liveAvatar} />
                    ) : (
                      <View style={[styles.liveAvatar, styles.avatarFallback]}>
                        <Icon name="account" size={20} color="#FFFFFF" />
                      </View>
                    )}
                    <View style={styles.liveAvatarDot} />
                  </View>

                  <Text style={styles.liveFriendName} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text style={styles.liveRoomTitle} numberOfLines={1}>
                    {f.roomInfo?.title || `Room #${f.roomInfo?.roomId}`}
                  </Text>

                  <TouchableOpacity
                    style={styles.liveFollowBtn}
                    onPress={() => handleFollowRoom(f.roomInfo?.roomId)}
                    activeOpacity={0.8}
                  >
                    <Icon name="account-arrow-right" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.liveFollowBtnText}>Follow</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Search Filter Box */}
        <View style={styles.searchBox}>
          <TextInput
            placeholder="Search friends..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            mode="outlined"
            dense
            left={<TextInput.Icon icon="magnify" />}
            style={{ backgroundColor: theme.colors.elevation.level1 }}
          />
        </View>

        {/* Friends List Header */}
        <View style={styles.friendsListHeadingRow}>
          <Text variant="titleMedium" style={styles.friendsListHeading}>
            All Friends ({friends.length})
          </Text>
          {paginatedFriends.length < filteredFriends.length && (
            <Text style={styles.friendsListPaginationHint}>
              Showing {paginatedFriends.length} of {filteredFriends.length}
            </Text>
          )}
        </View>
      </View>
    );
  }, [
    pendingRequests,
    liveFriends,
    searchQuery,
    theme.colors.elevation.level2,
    theme.colors.elevation.level1,
    handleResponse,
    respondingId,
    handleFollowRoom,
    friends.length,
    paginatedFriends.length,
    filteredFriends.length,
  ]);

  const chatListEmpty = useMemo(() => {
    if (friends.length === 0) {
      return (
        <View style={styles.emptyStateBox}>
          <Icon name="account-group-outline" size={48} color="#888888" />
          <Text style={styles.emptyStateTitle}>No friends added yet</Text>
          <Text style={styles.emptyStateSub}>
            Head to the Party tab to match musical vibes and send friend requests!
          </Text>
          <TouchableOpacity
            style={[styles.exploreBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push('/(tabs)/party')}
          >
            <Icon name="party-popper" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.exploreBtnText}>Find Vibe Matches</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (filteredFriends.length === 0) {
      return (
        <View style={styles.emptyStateBox}>
          <Text style={styles.emptyStateSub}>No friends matching "{searchQuery}"</Text>
        </View>
      );
    }
    return null;
  }, [friends.length, filteredFriends.length, searchQuery, theme.colors.primary, router]);

  const chatListFooter = useMemo(() => {
    return (
      <View>
        {hasMoreFriends && (
          <TouchableOpacity
            style={styles.loadMoreFriendsWrapper}
            onPress={handleLoadMoreFriends}
            activeOpacity={0.7}
          >
            <Text style={styles.loadMoreFriendsText}>
              Load more friends ({paginatedFriends.length} of {filteredFriends.length})
            </Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 100 }} />
      </View>
    );
  }, [hasMoreFriends, handleLoadMoreFriends, paginatedFriends.length, filteredFriends.length]);

  // -------------------------------------------------------------
  // DEDICATED FULL-SCREEN CHAT CONVERSATION VIEW (NOT A MODAL)
  // -------------------------------------------------------------
  if (activeChatFriend) {
    const friendId = activeChatFriend.friendId || activeChatFriend.id;
    const isLive = activeChatFriend.isLiveInRoom && activeChatFriend.roomInfo?.roomId;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
        {/* Dedicated Chat Top Navigation Bar */}
        <View style={[styles.chatRoomHeader, { backgroundColor: theme.colors.elevation.level2 }]}>
          <TouchableOpacity onPress={handleCloseConversation} style={styles.backButton} activeOpacity={0.7}>
            <Icon name="arrow-left" size={24} color={theme.colors.onSurface} />
          </TouchableOpacity>

          <View style={styles.chatRoomUserMeta}>
            {activeChatFriend.picture ? (
              <Image source={{ uri: activeChatFriend.picture }} style={styles.chatRoomAvatar} />
            ) : (
              <View style={[styles.chatRoomAvatar, styles.avatarFallback]}>
                <Icon name="account" size={20} color="#FFFFFF" />
              </View>
            )}
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text variant="titleMedium" style={styles.chatRoomName} numberOfLines={1}>
                {activeChatFriend.name}
              </Text>
              <View style={styles.synergyPill}>
                <Icon name="shimmer" size={11} color="#FFD700" />
                <Text style={styles.synergyPillText}>
                  {activeChatFriend.synergyPoints || 10} Mutual Synergy (+5/msg)
                </Text>
              </View>
            </View>
          </View>

          {isLive && (
            <TouchableOpacity
              style={styles.chatHeaderFollowBtn}
              onPress={() => handleFollowRoom(activeChatFriend.roomInfo?.roomId)}
              activeOpacity={0.8}
            >
              <Icon name="play-circle" size={14} color="#FFFFFF" />
              <Text style={styles.chatHeaderFollowBtnText}>Follow</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Message History Timeline */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {chatMessages.length === 0 ? (
            <ScrollView
              style={styles.chatRoomScroll}
              contentContainerStyle={styles.chatEmptyScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.chatEmptyBox}>
                <View style={styles.emptyIconCircle}>
                  <Icon name="waveform" size={34} color="#E94057" />
                </View>
                <Text style={styles.chatEmptyTitle}>Start the Vibe ⚡</Text>
                <Text style={styles.chatEmptySub}>
                  End-to-end device storage. Send a message to start vibing and earn +5 mutual synergy points!
                </Text>

                <View style={styles.quickChipsWrapper}>
                  <Text style={styles.quickChipsLabel}>QUICK PROMPTS</Text>
                  <View style={styles.quickChipsRow}>
                    <TouchableOpacity
                      style={styles.quickChip}
                      onPress={() => setChatInputText('🎵 What are you listening to right now?')}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.quickChipText}>🎵 What are you listening to?</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickChip}
                      onPress={() => setChatInputText("🚀 Let's jam together in a party room!")}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.quickChipText}>🚀 Let's jam together</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickChip}
                      onPress={() => setChatInputText('✨ Vibe check (+5 synergy points)')}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.quickChipText}>✨ Vibe check (+5 synergy)</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>
          ) : (
            <FlatList
              ref={flatListRef}
              inverted
              data={invertedMessages}
              keyExtractor={keyExtractor}
              renderItem={renderMessageItem}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              style={styles.chatRoomScroll}
              contentContainerStyle={styles.chatRoomFlatListContent}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={renderFooter}
              onEndReached={hasMoreOlder && !loadingOlder ? handleLoadOlder : undefined}
              onEndReachedThreshold={0.15}
              onScroll={handleConversationScroll}
              scrollEventThrottle={32}
            />
          )}

          {/* Floating "New messages below" Hint Button */}
          {showScrollBottomHint && (
            <View style={styles.floatingHintWrapper} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.floatingHintBtn}
                onPress={() => {
                  flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                  setShowScrollBottomHint(false);
                }}
                activeOpacity={0.85}
              >
                <Icon name="arrow-down" size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.floatingHintText}>New messages below</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Chat Message Input Bar - Modern Floating Capsule */}
          <View style={[styles.chatInputCapsuleWrapper, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.chatInputCapsule, { backgroundColor: theme.colors.elevation.level2 }]}>
              <RNTextInput
                placeholder="Message friend (+5 synergy)..."
                placeholderTextColor="#7E7E8F"
                value={chatInputText}
                onChangeText={setChatInputText}
                style={[styles.chatNativeInput, { color: theme.colors.onSurface }]}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={styles.sendCapsuleBtn}
                onPress={handleSendMessage}
                disabled={sendingMsg || !chatInputText.trim()}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={chatInputText.trim() ? ['#8A2387', '#E94057'] : ['#2A2A38', '#2A2A38']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendGradientCircle}
                >
                  {sendingMsg ? (
                    <ActivityIndicator size={14} color="#FFFFFF" />
                  ) : (
                    <Icon
                      name="send"
                      size={15}
                      color={chatInputText.trim() ? '#FFFFFF' : '#6A6A7D'}
                      style={{ marginLeft: 2 }}
                    />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------
  // DEDICATED MESSAGES DASHBOARD & CONVERSATION LIST
  // -------------------------------------------------------------
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* ---------------- Top Header ---------------- */}
      <View style={styles.header}>
        <View>
          <Text variant="titleMedium" style={styles.headerTag}>
            MESSAGES & SYNERGY
          </Text>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Vibe Chats 💬
          </Text>
        </View>

        {totalUnreadCount > 0 ? (
          <View style={[styles.totalUnreadPill, { backgroundColor: '#E94057' }]}>
            <Icon name="message-badge" size={14} color="#FFFFFF" />
            <Text style={styles.totalUnreadText}>{totalUnreadCount} New</Text>
          </View>
        ) : pendingRequests.length > 0 ? (
          <View style={[styles.pendingCounterPill, { backgroundColor: theme.colors.primary }]}>
            <Icon name="bell-ring" size={14} color="#FFFFFF" />
            <Text style={styles.pendingCounterText}>{pendingRequests.length} Requests</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        data={paginatedFriends}
        keyExtractor={friendKeyExtractor}
        renderItem={renderFriendRow}
        ListHeaderComponent={chatListHeader}
        ListEmptyComponent={chatListEmpty}
        ListFooterComponent={chatListFooter}
        onEndReached={handleLoadMoreFriends}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshFriends}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerTag: {
    fontSize: 12,
    color: '#888888',
    letterSpacing: 1,
    fontWeight: '700',
  },
  headerTitle: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  totalUnreadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  totalUnreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pendingCounterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  pendingCounterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  pendingSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  pendingCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  pendingUserMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarFallback: {
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pendingSub: {
    fontSize: 12,
    color: '#AAAAAA',
    marginTop: 2,
  },
  pendingActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  acceptBtn: {
    backgroundColor: '#38ef7d',
  },
  declineBtn: {
    backgroundColor: '#e74c3c',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  liveSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38ef7d',
    marginRight: 6,
  },
  liveScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  liveFriendCard: {
    width: 130,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  liveAvatarBox: {
    position: 'relative',
    marginBottom: 6,
  },
  liveAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  liveAvatarDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#38ef7d',
    borderWidth: 2,
    borderColor: '#121212',
  },
  liveFriendName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  liveRoomTitle: {
    fontSize: 11,
    color: '#AAAAAA',
    textAlign: 'center',
    marginVertical: 4,
  },
  liveFollowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E94057',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 4,
  },
  liveFollowBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  searchBox: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  friendsListSection: {
    marginHorizontal: 16,
  },
  friendsListHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 10,
  },
  friendsListHeading: {
    fontWeight: '700',
  },
  friendsListPaginationHint: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  loadMoreFriendsWrapper: {
    marginHorizontal: 16,
    marginVertical: 10,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreFriendsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9E9EA7',
  },
  friendRowAvatarBox: {
    position: 'relative',
    marginRight: 12,
  },
  friendRowAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  liveIndicatorBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#38ef7d',
    borderWidth: 2,
    borderColor: '#121212',
  },
  friendRowMeta: {
    flex: 1,
  },
  friendRowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  friendRowName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    maxWidth: '60%',
  },
  synergyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  synergyBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '700',
  },
  unreadCountBadge: {
    backgroundColor: '#E94057',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  friendRowStatus: {
    fontSize: 12,
    color: '#AAAAAA',
  },
  friendRowStatusUnread: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  chatListFollowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E94057',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
    marginLeft: 8,
  },
  chatListFollowBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyStateBox: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
  },
  emptyStateSub: {
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
    marginTop: 6,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    marginTop: 16,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // ---------------- Dedicated Chat View Styles ----------------
  chatRoomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backButton: {
    padding: 6,
    marginRight: 6,
  },
  chatRoomUserMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatRoomAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  chatRoomName: {
    fontSize: 16,
    fontWeight: '800',
  },
  synergyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
    gap: 3,
    alignSelf: 'flex-start',
  },
  synergyPillText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '700',
  },
  chatHeaderFollowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E94057',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
    marginLeft: 8,
  },
  chatHeaderFollowBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  chatRoomScroll: {
    flex: 1,
  },
  chatRoomScrollContent: {
    padding: 14,
    gap: 10,
  },
  chatRoomFlatListContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chatEmptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 14,
  },
  chatEmptyBox: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(233, 64, 87, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(233, 64, 87, 0.25)',
  },
  chatEmptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  chatEmptySub: {
    fontSize: 13,
    color: '#8E8E9F',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 280,
  },
  quickChipsWrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  quickChipsLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6E6E82',
    letterSpacing: 1,
    marginBottom: 10,
  },
  quickChipsRow: {
    flexDirection: 'column',
    gap: 8,
    width: '100%',
    alignItems: 'center',
  },
  quickChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    width: '90%',
    alignItems: 'center',
  },
  quickChipText: {
    color: '#E0E0EC',
    fontSize: 13,
    fontWeight: '600',
  },
  chatBubbleMeContainer: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    marginVertical: 3,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    overflow: 'hidden',
    shadowColor: '#8A2387',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  chatBubbleGradientMe: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chatBubbleTextMe: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  chatBubbleOther: {
    alignSelf: 'flex-start',
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    marginVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  chatBubbleTextOther: {
    fontSize: 14,
    lineHeight: 20,
  },
  chatInputCapsuleWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  chatInputCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 5,
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chatNativeInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
    maxHeight: 100,
  },
  sendCapsuleBtn: {
    marginLeft: 6,
  },
  sendGradientCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---------------- Clickable Jam Invite Card Styles ----------------
  inviteCardWrapper: {
    maxWidth: '85%',
    marginVertical: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  inviteCardMe: {
    alignSelf: 'flex-end',
  },
  inviteCardOther: {
    alignSelf: 'flex-start',
  },
  inviteCardGradient: {
    padding: 14,
    borderRadius: 16,
  },
  inviteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  inviteCardBadge: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  inviteCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  inviteCardCode: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  inviteJoinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  inviteJoinButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  bubbleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  bubbleMetaMe: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  bubbleMetaOther: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
  bubbleTimeText: {
    fontSize: 10,
    lineHeight: 12,
  },
  bubbleTimeMe: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  bubbleTimeOther: {
    color: '#8E8E93',
  },
  statusTick: {
    marginLeft: 2,
  },
  inviteMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 4,
  },
  inviteTimeText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
  },
  floatingHintWrapper: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
  floatingHintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E94057',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  floatingHintText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  loadOlderBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
  },
  loadOlderText: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '600',
  },
});

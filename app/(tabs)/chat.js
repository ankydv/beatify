import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme, TextInput, Button, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';

import { useFriends } from '@/hooks/friends.hooks';

export default function ChatScreen() {
  const router = useRouter();
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
    openChat,
    closeChat,
    sendChatMessage,
    sendInvite,
    sendingMsg,
    unreadCounts,
    totalUnreadCount,
    incomingNotification,
    dismissNotification,
  } = useFriends();

  const [searchQuery, setSearchQuery] = useState('');
  const [chatInputText, setChatInputText] = useState('');
  const [respondingId, setRespondingId] = useState(null);

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

  // Follow friend into their active party room
  const handleFollowRoom = (roomId) => {
    if (!roomId) return;
    router.push({
      pathname: 'voiceRoom',
      params: { roomId: String(roomId) },
    });
  };

  // Send message
  const handleSendMessage = async () => {
    if (!chatInputText.trim()) return;
    const msg = chatInputText.trim();
    setChatInputText('');
    await sendChatMessage(msg);
  };

  const filteredFriends = friends.filter((f) =>
    (f.name || '').toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const liveFriends = friends.filter((f) => f.isLiveInRoom && f.roomInfo);

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
          <TouchableOpacity onPress={closeChat} style={styles.backButton} activeOpacity={0.7}>
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
          <ScrollView
            style={styles.chatRoomScroll}
            contentContainerStyle={styles.chatRoomScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {chatMessages.length === 0 ? (
              <View style={styles.chatEmptyBox}>
                <Icon name="chat-processing-outline" size={48} color="#666666" />
                <Text style={styles.chatEmptyTitle}>Device-First Direct Chat 🔒</Text>
                <Text style={styles.chatEmptySub}>
                  Messages are stored securely on your device. Send a message to start vibing and earn mutual synergy points!
                </Text>
              </View>
            ) : (
              chatMessages.map((msg, idx) => {
                const isMe = msg.senderId === user?.id;
                const isJamInvite = msg.type === 'jam_invite' || Boolean(msg.roomId);

                if (isJamInvite) {
                  return (
                    <View
                      key={msg._id || idx}
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
                          onPress={() => handleFollowRoom(msg.roomId)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.inviteJoinButtonText}>Join Jam Room 🚀</Text>
                          <Icon name="arrow-right-circle" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                      </LinearGradient>
                    </View>
                  );
                }

                return (
                  <View
                    key={msg._id || idx}
                    style={[
                      styles.chatBubble,
                      isMe
                        ? [styles.chatBubbleMe, { backgroundColor: theme.colors.primary }]
                        : [styles.chatBubbleOther, { backgroundColor: theme.colors.elevation.level2 }],
                    ]}
                  >
                    <Text style={[styles.chatBubbleText, isMe && { color: '#FFFFFF' }]}>
                      {msg.message}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Chat Message Input Bar */}
          <View style={[styles.chatRoomInputRow, { backgroundColor: theme.colors.elevation.level1 }]}>
            <TextInput
              placeholder="Message friend (+5 synergy)..."
              value={chatInputText}
              onChangeText={setChatInputText}
              mode="outlined"
              dense
              style={{ flex: 1, marginRight: 8, backgroundColor: theme.colors.background }}
            />
            <Button
              mode="contained"
              onPress={handleSendMessage}
              loading={sendingMsg}
              disabled={sendingMsg || !chatInputText.trim()}
              style={{ borderRadius: 10 }}
            >
              Send
            </Button>
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
      {/* ---------------- In-App Floating Notification Banner ---------------- */}
      {incomingNotification && (
        <View style={styles.notificationToastWrapper}>
          <TouchableOpacity
            style={styles.notificationToast}
            onPress={() => {
              const notif = incomingNotification;
              dismissNotification();
              if (notif.roomId) {
                handleFollowRoom(notif.roomId);
              } else if (notif.senderId) {
                const target = friends.find((f) => f.friendId === notif.senderId);
                if (target) openChat(target);
              }
            }}
            activeOpacity={0.9}
          >
            <View style={styles.toastIconBox}>
              <Icon
                name={incomingNotification.type === 'jam_invite' ? 'music-circle' : 'message-text'}
                size={22}
                color="#FFFFFF"
              />
            </View>
            <View style={{ flex: 1, marginHorizontal: 10 }}>
              <Text style={styles.toastTitle}>{incomingNotification.title}</Text>
              <Text style={styles.toastMessage} numberOfLines={1}>
                {incomingNotification.message}
              </Text>
            </View>
            <TouchableOpacity onPress={dismissNotification} style={{ padding: 4 }}>
              <Icon name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      )}

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

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshFriends}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* ---------------- Incoming Friend Requests Section ---------------- */}
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

        {/* ---------------- Friends Vibing Now (Live in Rooms) ---------------- */}
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

        {/* ---------------- Search Filter Box ---------------- */}
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

        {/* ---------------- Friends List with Unread Badges & Direct Follow Buttons ---------------- */}
        <View style={styles.friendsListSection}>
          <Text variant="titleMedium" style={styles.friendsListHeading}>
            All Friends ({friends.length})
          </Text>

          {friends.length === 0 ? (
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
          ) : filteredFriends.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyStateSub}>No friends matching "{searchQuery}"</Text>
            </View>
          ) : (
            filteredFriends.map((f) => {
              const friendId = f.friendId || f.id;
              const unread = unreadCounts[friendId] || 0;
              const isLive = f.isLiveInRoom && f.roomInfo?.roomId;

              return (
                <TouchableOpacity
                  key={friendId}
                  style={[styles.friendRow, { backgroundColor: theme.colors.elevation.level1 }]}
                  onPress={() => openChat(f)}
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

                        {/* Unread Message Indicator per Chat in Chat List */}
                        {unread > 0 && (
                          <View style={styles.unreadCountBadge}>
                            <Text style={styles.unreadCountText}>{unread}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <Text style={[styles.friendRowStatus, unread > 0 && styles.friendRowStatusUnread]} numberOfLines={1}>
                      {isLive
                        ? `🎧 Live in ${f.roomInfo?.title || `Room #${f.roomInfo?.roomId}`}`
                        : f.lastMessage?.message
                        ? f.lastMessage.message
                        : 'Tap to open chat'}
                    </Text>
                  </View>

                  {/* 1-Tap Follow Button in Chatlist Item */}
                  {isLive ? (
                    <TouchableOpacity
                      style={styles.chatListFollowBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleFollowRoom(f.roomInfo?.roomId);
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
            })
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
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
  friendsListHeading: {
    fontWeight: '700',
    marginBottom: 10,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
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
  chatEmptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  chatEmptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 10,
  },
  chatEmptySub: {
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  chatBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  chatBubbleMe: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  chatBubbleOther: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
  },
  chatBubbleText: {
    fontSize: 14,
    lineHeight: 19,
  },
  chatRoomInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
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

  // ---------------- Floating Toast Notification Styles ----------------
  notificationToastWrapper: {
    position: 'absolute',
    top: 50,
    left: 14,
    right: 14,
    zIndex: 9999,
    elevation: 10,
  },
  notificationToast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1B2E',
    borderWidth: 1,
    borderColor: '#E94057',
    padding: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  toastIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E94057',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  toastMessage: {
    color: '#DDDDDD',
    fontSize: 12,
    marginTop: 2,
  },
});

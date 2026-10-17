import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
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
    sendingMsg,
  } = useFriends();

  const [searchQuery, setSearchQuery] = useState('');
  const [chatInputText, setChatInputText] = useState('');
  const [respondingId, setRespondingId] = useState(null);

  // Handle responding to a friend request
  const handleResponse = async (friendshipId, action) => {
    setRespondingId(friendshipId);
    try {
      const res = await respondRequest(friendshipId, action);
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

        {pendingRequests.length > 0 && (
          <View style={[styles.pendingCounterPill, { backgroundColor: theme.colors.primary }]}>
            <Icon name="bell-ring" size={14} color="#FFFFFF" />
            <Text style={styles.pendingCounterText}>{pendingRequests.length} Requests</Text>
          </View>
        )}
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
        {/* ---------------- Pending Requests Section ---------------- */}
        {pendingRequests.length > 0 && (
          <View style={styles.pendingSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="account-clock" size={20} color="#FFD700" style={{ marginRight: 6 }} />
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Incoming Friend Requests ({pendingRequests.length})
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

        {/* ---------------- Friends List ---------------- */}
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
            filteredFriends.map((f) => (
              <TouchableOpacity
                key={f.friendId}
                style={[styles.friendRow, { backgroundColor: theme.colors.elevation.level1 }]}
                onPress={() => openChat(f)}
                activeOpacity={0.75}
              >
                <View style={styles.friendRowAvatarBox}>
                  {f.picture ? (
                    <Image source={{ uri: f.picture }} style={styles.friendRowAvatar} />
                  ) : (
                    <View style={[styles.friendRowAvatar, styles.avatarFallback]}>
                      <Icon name="account" size={24} color="#FFFFFF" />
                    </View>
                  )}
                  {f.isLiveInRoom && <View style={styles.liveIndicatorBadge} />}
                </View>

                <View style={styles.friendRowMeta}>
                  <View style={styles.friendRowTopLine}>
                    <Text style={styles.friendRowName} numberOfLines={1}>
                      {f.name}
                    </Text>
                    <View style={styles.synergyBadge}>
                      <Icon name="shimmer" size={12} color="#FFD700" />
                      <Text style={styles.synergyBadgeText}>{f.synergyPoints || 10} Synergy</Text>
                    </View>
                  </View>

                  <Text style={styles.friendRowStatus} numberOfLines={1}>
                    {f.isLiveInRoom
                      ? `🎧 Listening in ${f.roomInfo?.title || `Room #${f.roomInfo?.roomId}`}`
                      : f.lastMessage?.message
                      ? f.lastMessage.message
                      : 'Tap to start a conversation'}
                  </Text>
                </View>

                <Icon name="chevron-right" size={20} color="#888888" />
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ---------------- 1-on-1 Chat Modal ---------------- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={Boolean(activeChatFriend)}
        onRequestClose={closeChat}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.chatModalContent, { backgroundColor: theme.colors.elevation.level3 }]}>
            {/* Chat Modal Header */}
            <View style={styles.chatModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                {activeChatFriend?.picture ? (
                  <Image source={{ uri: activeChatFriend.picture }} style={styles.chatFriendAvatar} />
                ) : (
                  <View style={[styles.chatFriendAvatar, styles.avatarFallback]}>
                    <Icon name="account" size={18} color="#FFFFFF" />
                  </View>
                )}
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }} numberOfLines={1}>
                    {activeChatFriend?.name}
                  </Text>
                  <View style={styles.synergyPill}>
                    <Icon name="shimmer" size={11} color="#FFD700" />
                    <Text style={styles.synergyPillText}>
                      {activeChatFriend?.synergyPoints || 10} Mutual Synergy (+5 per message)
                    </Text>
                  </View>
                </View>
              </View>

              {activeChatFriend?.isLiveInRoom && activeChatFriend.roomInfo?.roomId && (
                <TouchableOpacity
                  style={styles.chatFollowBtn}
                  onPress={() => {
                    const rid = activeChatFriend.roomInfo?.roomId;
                    closeChat();
                    handleFollowRoom(rid);
                  }}
                >
                  <Icon name="play-circle" size={14} color="#FFFFFF" />
                  <Text style={styles.chatFollowBtnText}>Follow</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={closeChat} style={{ marginLeft: 8 }}>
                <Icon name="close" size={24} color={theme.colors.onSurface} />
              </TouchableOpacity>
            </View>

            {/* Chat Messages */}
            <ScrollView style={styles.chatMessagesScroll} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
              {chatMessages.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                  <Icon name="chat-outline" size={40} color="#888888" />
                  <Text style={{ color: '#888888', marginTop: 8, fontSize: 13, textAlign: 'center' }}>
                    No messages yet. Send a message to chat and earn mutual synergy points!
                  </Text>
                </View>
              ) : (
                chatMessages.map((msg, idx) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <View
                      key={msg._id || idx}
                      style={[
                        styles.chatBubble,
                        isMe
                          ? [styles.chatBubbleMe, { backgroundColor: theme.colors.primary }]
                          : styles.chatBubbleOther,
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

            {/* Input Row */}
            <View style={styles.chatInputRow}>
              <TextInput
                placeholder="Message friend..."
                value={chatInputText}
                onChangeText={setChatInputText}
                mode="outlined"
                dense
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                mode="contained"
                onPress={handleSendMessage}
                loading={sendingMsg}
                disabled={sendingMsg || !chatInputText.trim()}
              >
                Send
              </Button>
            </View>
          </View>
        </View>
      </Modal>
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
    maxWidth: '65%',
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
  friendRowStatus: {
    fontSize: 12,
    color: '#AAAAAA',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  chatModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
    minHeight: '55%',
  },
  chatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  chatFriendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  },
  synergyPillText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '700',
  },
  chatFollowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E94057',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 3,
    marginRight: 6,
  },
  chatFollowBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  chatMessagesScroll: {
    flex: 1,
  },
  chatBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  chatBubbleMe: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  chatBubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomLeftRadius: 2,
  },
  chatBubbleText: {
    fontSize: 13,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
});

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme, TextInput, Button, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';

import { usePartyRoomDiscovery } from '@/hooks/partyRoomDiscovery.hooks';

const { width: SCREEN_W } = Dimensions.get('window');

const VIBE_OPTIONS = [
  { id: 'Chill', label: '☕ Chill', color: '#4A90E2' },
  { id: 'Party', label: '🎉 Party', color: '#E94057' },
  { id: 'Focus', label: '🎧 Focus', color: '#50E3C2' },
  { id: 'Energize', label: '⚡ Energize', color: '#F5A623' },
  { id: 'Romance', label: '❤️ Romance', color: '#D0021B' },
  { id: 'Bollywood', label: '🪕 Bollywood', color: '#9013FE' },
  { id: 'Gaming', label: '🎮 Gaming', color: '#7ED321' },
];

const PartyScreen = () => {
  const router = useRouter();
  const theme = useTheme();

  const {
    activeRooms,
    vibeProfile,
    matchedUsers,
    selectedVibe,
    setSelectedVibe,
    searchQuery,
    setSearchQuery,
    loading,
    refreshing,
    onRefresh,
    createRoom,
    currentUser,
  } = usePartyRoomDiscovery();

  // Code join state
  const [inputRoomId, setInputRoomId] = useState('');
  const [joinError, setJoinError] = useState('');

  // Create room modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [newRoomVibe, setNewRoomVibe] = useState('Chill');
  const [newRoomTags, setNewRoomTags] = useState('chill, lofi, beats');
  const [newCustomRoomId, setNewCustomRoomId] = useState('');
  const [creating, setCreating] = useState(false);

  // Quick join room handler
  const joinRoom = (roomId) => {
    if (!roomId) return;
    router.push({
      pathname: 'voiceRoom',
      params: { roomId: String(roomId) },
    });
  };

  // Handle manual code join
  const handleCodeJoin = () => {
    if (!inputRoomId.trim()) {
      setJoinError('Please enter a room code');
      return;
    }
    setJoinError('');
    joinRoom(inputRoomId.trim());
  };

  // Handle Room Creation
  const handleCreateRoomSubmit = async () => {
    setCreating(true);
    try {
      const generatedId = newCustomRoomId.trim() || String(Math.floor(1000 + Math.random() * 9000));
      const tagsArray = newRoomTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const res = await createRoom({
        title: newRoomTitle.trim() || `${currentUser?.firstName || 'Host'}'s Party Room`,
        vibe: newRoomVibe,
        tags: tagsArray,
        isPrivate: false,
        roomId: generatedId,
      });

      setCreateModalVisible(false);
      setNewRoomTitle('');
      setNewCustomRoomId('');

      // Directly enter newly created room
      joinRoom(res?.room?.roomId || generatedId);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  // Quick match to the most active room
  const handleQuickMatch = () => {
    if (activeRooms && activeRooms.length > 0) {
      joinRoom(activeRooms[0].roomId);
    } else {
      joinRoom('1001');
    }
  };

  const gamification = vibeProfile?.gamification || {
    level: 3,
    levelTitle: 'Vibe Rider',
    xp: 320,
    nextLevelXp: 500,
    streakDays: 4,
    badges: [],
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* ---------------- Top Header ---------------- */}
      <View style={styles.header}>
        <View>
          <Text variant="titleMedium" style={styles.headerTag}>
            COLLABORATIVE JAM
          </Text>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Party Hub 🎉
          </Text>
        </View>

        <TouchableOpacity
          style={styles.quickMatchButton}
          onPress={handleQuickMatch}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#8A2387', '#E94057', '#F27121']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.quickMatchGradient}
          >
            <Icon name="lightning-bolt" size={16} color="#FFFFFF" />
            <Text style={styles.quickMatchText}>Instant Jam</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* ---------------- Gamified Vibe Card ---------------- */}
        <View style={styles.vibeCardWrapper}>
          <LinearGradient
            colors={['#1F1C2C', '#928DAB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.vibeCard}
          >
            <View style={styles.vibeTopRow}>
              <View style={styles.vibeUserAvatarBox}>
                {currentUser?.imageUrl ? (
                  <Image source={{ uri: currentUser.imageUrl }} style={styles.vibeUserAvatar} />
                ) : (
                  <View style={[styles.vibeUserAvatar, styles.avatarFallback]}>
                    <Icon name="account-music" size={24} color="#FFFFFF" />
                  </View>
                )}
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>Lv {gamification.level}</Text>
                </View>
              </View>

              <View style={styles.vibeUserMeta}>
                <View style={styles.vibeTitleRow}>
                  <Text style={styles.vibeUserName}>
                    {currentUser?.firstName || 'Party DJ'}
                  </Text>
                  <View style={styles.streakPill}>
                    <Icon name="fire" size={14} color="#FF9500" />
                    <Text style={styles.streakText}>{gamification.streakDays}d Streak</Text>
                  </View>
                </View>
                <Text style={styles.vibeTitle}>{vibeProfile?.title || 'Groove Seeker'}</Text>

                {/* XP Progress Bar */}
                <View style={styles.xpBarTrack}>
                  <View
                    style={[
                      styles.xpBarFill,
                      { width: `${Math.min(100, (gamification.xp / gamification.nextLevelXp) * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.xpText}>
                  {gamification.xp} / {gamification.nextLevelXp} XP to {gamification.levelTitle}
                </Text>
              </View>
            </View>

            {/* Badges preview */}
            {gamification.badges && gamification.badges.length > 0 && (
              <View style={styles.badgesRow}>
                {gamification.badges.map((b) => (
                  <View key={b.id} style={styles.badgeItem}>
                    <Icon name={b.icon || 'star'} size={14} color="#FFD700" />
                    <Text style={styles.badgeName}>{b.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </LinearGradient>
        </View>

        {/* ---------------- Quick Actions (Create / Join by Code) ---------------- */}
        <View style={styles.actionsGrid}>
          {/* Host Party Button */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => setCreateModalVisible(true)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#11998e', '#38ef7d']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionGradient}
            >
              <View style={styles.actionIconBox}>
                <Icon name="plus-circle" size={26} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Create Room</Text>
              <Text style={styles.actionSubtitle}>Host a collaborative jam with voice & queue</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Join by Code Card */}
          <View style={[styles.codeJoinCard, { backgroundColor: theme.colors.elevation.level2 }]}>
            <View style={styles.codeHeader}>
              <Icon name="numeric" size={20} color={theme.colors.primary} />
              <Text style={styles.codeTitle}>Join via Code</Text>
            </View>
            <View style={styles.codeRow}>
              <TextInput
                style={styles.codeInput}
                placeholder="4-digit ID"
                value={inputRoomId}
                onChangeText={(t) => {
                  setInputRoomId(t);
                  setJoinError('');
                }}
                keyboardType="numeric"
                maxLength={6}
                mode="outlined"
                dense
              />
              <Button
                mode="contained"
                onPress={handleCodeJoin}
                style={styles.codeButton}
                contentStyle={{ height: 40 }}
              >
                Join
              </Button>
            </View>
            {joinError ? <Text style={styles.errorText}>{joinError}</Text> : null}
          </View>
        </View>

        {/* ---------------- Vibe Match Filter Chips ---------------- */}
        <View style={styles.sectionHeaderRow}>
          <Text variant="titleMedium" style={styles.sectionHeading}>
            Discover Live Party Rooms 🔊
          </Text>
          <Text style={styles.roomCountText}>{activeRooms.length} active</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.vibeChipScroll}
        >
          <TouchableOpacity
            onPress={() => setSelectedVibe('All')}
            style={[
              styles.vibeFilterChip,
              selectedVibe === 'All'
                ? [styles.vibeFilterChipActive, { backgroundColor: theme.colors.primary }]
                : [styles.vibeFilterChipInactive, { backgroundColor: theme.colors.elevation.level1 }],
            ]}
          >
            <Text
              style={[
                styles.vibeFilterText,
                selectedVibe === 'All' ? styles.vibeFilterTextActive : { color: theme.colors.onSurfaceVariant },
              ]}
            >
              ✨ All Vibes
            </Text>
          </TouchableOpacity>

          {VIBE_OPTIONS.map((v) => {
            const isActive = selectedVibe === v.id;
            return (
              <TouchableOpacity
                key={v.id}
                onPress={() => setSelectedVibe(v.id)}
                style={[
                  styles.vibeFilterChip,
                  isActive
                    ? [styles.vibeFilterChipActive, { backgroundColor: theme.colors.primary }]
                    : [styles.vibeFilterChipInactive, { backgroundColor: theme.colors.elevation.level1 }],
                ]}
              >
                <Text
                  style={[
                    styles.vibeFilterText,
                    isActive ? styles.vibeFilterTextActive : { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {v.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ---------------- Live Active Rooms List ---------------- */}
        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Tuning into live party rooms...</Text>
          </View>
        ) : activeRooms.length === 0 ? (
          <View style={styles.emptyRoomsBox}>
            <Icon name="music-off" size={40} color="#888888" />
            <Text style={styles.emptyTitle}>No active rooms for this vibe</Text>
            <Text style={styles.emptySubtitle}>Be the first to create one and start the party!</Text>
            <Button
              mode="contained-tonal"
              onPress={() => setCreateModalVisible(true)}
              style={{ marginTop: 10 }}
            >
              Start Room Now
            </Button>
          </View>
        ) : (
          <View style={styles.roomsList}>
            {activeRooms.map((room) => {
              const currentTrack = room.currentTrack;
              return (
                <TouchableOpacity
                  key={room.roomId}
                  style={[styles.roomCard, { backgroundColor: theme.colors.elevation.level2 }]}
                  activeOpacity={0.88}
                  onPress={() => joinRoom(room.roomId)}
                >
                  <View style={styles.roomCardHeader}>
                    <View style={styles.liveIndicator}>
                      <View style={styles.liveIndicatorDot} />
                      <Text style={styles.liveIndicatorText}>LIVE</Text>
                    </View>
                    <View style={styles.vibeTagBadge}>
                      <Text style={styles.vibeTagText}>#{room.vibe || 'Chill'}</Text>
                    </View>
                    <View style={styles.listenersBadge}>
                      <Icon name="account-group" size={14} color="#AAAAAA" />
                      <Text style={styles.listenersCount}>{room.memberCount || 1} listening</Text>
                    </View>
                  </View>

                  <Text variant="titleMedium" style={styles.roomCardTitle} numberOfLines={1}>
                    {room.title}
                  </Text>

                  {/* Now playing bar in room card */}
                  <View style={styles.roomTrackBar}>
                    {currentTrack?.thumb ? (
                      <Image source={{ uri: currentTrack.thumb }} style={styles.roomTrackThumb} />
                    ) : (
                      <View style={[styles.roomTrackThumb, styles.thumbFallback]}>
                        <Icon name="music" size={16} color="#FFFFFF" />
                      </View>
                    )}
                    <View style={styles.roomTrackInfo}>
                      <Text style={styles.roomTrackTitle} numberOfLines={1}>
                        {currentTrack?.title || 'Up Next in Queue...'}
                      </Text>
                      <Text style={styles.roomTrackArtist} numberOfLines={1}>
                        {currentTrack?.artists?.map((a) => a.name).join(', ') || 'Collaborative DJ Queue'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.joinPillButton}
                      onPress={() => joinRoom(room.roomId)}
                    >
                      <Text style={styles.joinPillText}>Join</Text>
                      <Icon name="play-circle" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>

                  {/* Room tags */}
                  {room.tags && room.tags.length > 0 && (
                    <View style={styles.roomTagsRow}>
                      {room.tags.slice(0, 3).map((t, idx) => (
                        <Text key={idx} style={styles.roomTagItem}>
                          #{t}
                        </Text>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ---------------- Vibe Matchmakers Section ---------------- */}
        <View style={styles.vibeMatchSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="account-heart" size={20} color="#FF6584" style={{ marginRight: 6 }} />
              <Text variant="titleMedium" style={styles.sectionHeading}>
                People on Your Frequency 💫
              </Text>
            </View>
            <Text style={styles.roomCountText}>Vibe Match</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.vibeMatchScroll}
          >
            {matchedUsers.map((m) => (
              <View
                key={m.id}
                style={[styles.matchCard, { backgroundColor: theme.colors.elevation.level2 }]}
              >
                <View style={styles.matchAvatarBox}>
                  <Image source={{ uri: m.picture }} style={styles.matchAvatar} />
                  <View style={styles.matchPercentageBadge}>
                    <Text style={styles.matchPercentageText}>{m.matchPercentage}%</Text>
                  </View>
                </View>

                <Text style={styles.matchName} numberOfLines={1}>
                  {m.name}
                </Text>
                <Text style={styles.matchVibeTitle} numberOfLines={1}>
                  {m.vibeTitle}
                </Text>

                <View style={styles.sharedTasteBox}>
                  <Text style={styles.sharedTasteLabel}>Shared Taste:</Text>
                  <Text style={styles.sharedTasteArtists} numberOfLines={1}>
                    {m.sharedArtists?.join(', ') || m.favoriteGenre}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.matchActionBtn}
                  onPress={() => joinRoom(m.roomId || '1001')}
                >
                  <Text style={styles.matchActionText}>Jam With {m.name.split(' ')[0]}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ---------------- Create Room Modal ---------------- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={createModalVisible}
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.elevation.level3 }]}>
            <View style={styles.modalHeader}>
              <Text variant="titleLarge" style={styles.modalTitle}>
                Create Party Room 🎉
              </Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Icon name="close" size={24} color={theme.colors.onSurface} />
              </TouchableOpacity>
            </View>

            <TextInput
              label="Room Title"
              placeholder="e.g. Late Night Synthwave Chill"
              value={newRoomTitle}
              onChangeText={setNewRoomTitle}
              mode="outlined"
              style={styles.modalInput}
            />

            <Text style={styles.modalFieldLabel}>Select Vibe / Mood:</Text>
            <View style={styles.modalVibeChipsGrid}>
              {VIBE_OPTIONS.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setNewRoomVibe(v.id)}
                  style={[
                    styles.modalVibeChip,
                    newRoomVibe === v.id
                      ? [styles.modalVibeChipActive, { backgroundColor: theme.colors.primary }]
                      : styles.modalVibeChipInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.modalVibeChipText,
                      newRoomVibe === v.id && styles.modalVibeChipTextActive,
                    ]}
                  >
                    {v.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              label="Tags (comma-separated)"
              placeholder="e.g. lofi, chill, late-night"
              value={newRoomTags}
              onChangeText={setNewRoomTags}
              mode="outlined"
              style={styles.modalInput}
            />

            <TextInput
              label="Room Code (optional)"
              placeholder="Leave blank to auto-generate"
              value={newCustomRoomId}
              onChangeText={setNewCustomRoomId}
              keyboardType="numeric"
              maxLength={6}
              mode="outlined"
              style={styles.modalInput}
            />

            <Button
              mode="contained"
              onPress={handleCreateRoomSubmit}
              loading={creating}
              disabled={creating}
              style={styles.createSubmitButton}
              contentStyle={{ height: 48 }}
            >
              Start Collaborative Room
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

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
  quickMatchButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  quickMatchGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  quickMatchText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 4,
  },
  scroll: {
    flex: 1,
  },
  vibeCardWrapper: {
    marginHorizontal: 14,
    marginVertical: 10,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
  },
  vibeCard: {
    padding: 16,
    borderRadius: 16,
  },
  vibeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vibeUserAvatarBox: {
    position: 'relative',
    marginRight: 14,
  },
  vibeUserAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarFallback: {
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  levelBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
  },
  vibeUserMeta: {
    flex: 1,
  },
  vibeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vibeUserName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  streakText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 3,
  },
  vibeTitle: {
    color: '#E0E0E0',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 6,
  },
  xpBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#00E676',
    borderRadius: 3,
  },
  xpText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  actionsGrid: {
    marginHorizontal: 14,
    marginVertical: 6,
    gap: 10,
  },
  actionCard: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionGradient: {
    padding: 16,
    borderRadius: 14,
  },
  actionIconBox: {
    marginBottom: 6,
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  actionSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 2,
  },
  codeJoinCard: {
    padding: 14,
    borderRadius: 14,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeTitle: {
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  codeInput: {
    flex: 1,
    height: 40,
  },
  codeButton: {
    borderRadius: 8,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 8,
  },
  sectionHeading: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  roomCountText: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '600',
  },
  vibeChipScroll: {
    paddingHorizontal: 14,
    gap: 8,
    paddingBottom: 6,
  },
  vibeFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    marginRight: 6,
  },
  vibeFilterChipActive: {},
  vibeFilterChipInactive: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  vibeFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  vibeFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  loaderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#888888',
  },
  emptyRoomsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontWeight: '700',
    fontSize: 15,
    marginTop: 10,
  },
  emptySubtitle: {
    color: '#888888',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  roomsList: {
    paddingHorizontal: 14,
    gap: 12,
    marginTop: 6,
  },
  roomCard: {
    padding: 14,
    borderRadius: 14,
    elevation: 2,
  },
  roomCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3B30',
    marginRight: 4,
  },
  liveIndicatorText: {
    color: '#FF3B30',
    fontSize: 10,
    fontWeight: '800',
  },
  vibeTagBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  vibeTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  listenersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listenersCount: {
    fontSize: 11,
    color: '#AAAAAA',
  },
  roomCardTitle: {
    fontWeight: '800',
    marginBottom: 10,
  },
  roomTrackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    padding: 8,
    borderRadius: 10,
  },
  roomTrackThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  thumbFallback: {
    backgroundColor: '#444444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomTrackInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  roomTrackTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  roomTrackArtist: {
    fontSize: 11,
    color: '#888888',
    marginTop: 2,
  },
  joinPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6584',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  joinPillText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  roomTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  roomTagItem: {
    fontSize: 11,
    color: '#888888',
  },
  vibeMatchSection: {
    marginTop: 10,
  },
  vibeMatchScroll: {
    paddingHorizontal: 14,
    gap: 12,
    paddingVertical: 4,
  },
  matchCard: {
    width: 170,
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  matchAvatarBox: {
    position: 'relative',
    marginBottom: 8,
  },
  matchAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  matchPercentageBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  matchPercentageText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  matchName: {
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
  matchVibeTitle: {
    fontSize: 11,
    color: '#888888',
    textAlign: 'center',
    marginTop: 2,
  },
  sharedTasteBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    width: '100%',
    padding: 6,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: 'center',
  },
  sharedTasteLabel: {
    fontSize: 9,
    color: '#888888',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sharedTasteArtists: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  matchActionBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
  },
  matchActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontWeight: '800',
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginVertical: 8,
  },
  modalVibeChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  modalVibeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  modalVibeChipActive: {},
  modalVibeChipInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalVibeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalVibeChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalInput: {
    marginBottom: 12,
  },
  createSubmitButton: {
    marginTop: 8,
    borderRadius: 10,
  },
});

export default PartyScreen;

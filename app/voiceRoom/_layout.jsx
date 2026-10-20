import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  BackHandler,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-expo';
import { socket } from '@/configs/socket';
import LoadingIndicator from '@/components/LoadingIndicator';
import DJPanel from './DJPanel';
import PartyTransport from './PartyTransport';
import { useFriends } from '@/hooks/friends.hooks';
import { setRoom, setMinimised, resetParty, setJoinError } from '@/state/slices/party.slice';
import { usePartyPresence, REACTIONS } from '@/hooks/partyPresence.hooks';
import {
  setAudioOutputMode,
  setMuteIncomingSound,
  getAvailableAudioRoutes,
  resetAudioOutput,
} from '@/utils/audioRoute.utils';

const { width: SCREEN_W } = Dimensions.get('window');
const AVATAR = 44;

/**
 * Party room SCREEN — a pure view.
 *
 * The runtime (socket membership, WebRTC voice, shared-listening sync, chat
 * buffer) lives at the app root in components/PartyHost.jsx, which is what
 * lets the hardware back button MINIMISE this screen instead of leaving the
 * room. Leaving is now an explicit action (the power button in the header).
 *
 * The vertical budget is streamlined:
 *   header | now-playing card | participant strip | FLEX stage | compact control bar
 * Only the stage flexes, giving maximum screen real estate to chat and queue.
 */
const PartyRoom = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { roomId } = useLocalSearchParams();
  const party = useSelector((s) => s.party);
  const { isSignedIn } = useAuth();
  const { muted, toggleMute, react } = usePartyPresence();
  const audioOutput = party.audioOutput || 'speaker';
  const muteIncoming = party.muteIncoming || false;

  const [showReactions, setShowReactions] = useState(false);
  const [showAudioDropdown, setShowAudioDropdown] = useState(false);

  // Register this room as ours — PartyHost does the actual joining.
  // Never join when logged out; if we get signed out while inside, leave
  // immediately (stops audio + clears UI) and bounce to the Party tab.
  useEffect(() => {
    if (!isSignedIn) {
      if (roomId || party?.roomId) {
        resetAudioOutput().catch(() => {});
        dispatch(resetParty());
        router.replace('/(tabs)/party');
      }
      return undefined;
    }
    if (roomId) dispatch(setRoom(roomId));
    dispatch(setMinimised(false));
    return undefined;
  }, [dispatch, roomId, isSignedIn]);

  // Hardware back minimises the room; leaving is an explicit action.
  const minimize = () => {
    dispatch(setMinimised(true));
    if (router.canGoBack()) {
      router.back();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/(tabs)/party');
    }
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      minimize();
      return true;
    });
    return () => sub.remove();
  }, [dispatch, navigation]);

  const leave = () => {
    // Explicit leave: drop socket membership FIRST so the server removes us
    // even if redux teardown races; then stop audio + wipe UI state.
    try {
      socket.emit('leave-room', party?.roomId ? { roomId: party.roomId } : {});
    } catch (e) {}
    try {
      import('@/utils/partyPlayback.utils').then(({ teardownPartyPlayer }) => {
        teardownPartyPlayer(dispatch).catch(() => {});
      });
    } catch (e) {}
    resetAudioOutput().catch(() => {});
    dispatch(resetParty());
    if (router.canGoBack()) {
      router.back();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/(tabs)/party');
    }
  };

  const onSelectReaction = (emoji) => {
    react(emoji);
    setShowReactions(false);
  };

  const participants = party.participants || [];
  const count = participants.length;

  const { friends, sendInvite } = useFriends();
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [invitedIds, setInvitedIds] = useState([]);

  const handleMemberPress = (p) => {
    if (!p.id) {
      console.log(p)
      Alert.alert(p.name || 'Room Member', 'This user is listening anonymously.');
      return;
    }
    Alert.alert(
      `Connect with ${p.name || 'Member'}`,
      'Send a friend request to unlock mutual synergy points and stay connected!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Friend 🤝',
          onPress: () => {
            socket.emit('friend:add-in-room', { targetClerkId: p.clerkId, roomId }, (res) => {
              if (res?.success) {
                Alert.alert('Friend Request Sent! 🎉', 'You will earn mutual synergy points when accepted.');
              } else {
                Alert.alert('Notice', res?.message || 'Friend request already sent');
              }
            });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* ---------------- header ---------------- */}
      <View style={styles.header}>
        <View style={[styles.livePill, !party.connected && styles.livePillOff]}>
          <View style={[styles.liveDot, !party.connected && styles.liveDotOff]} />
          <Text style={[styles.liveText, !party.connected && styles.liveTextOff]}>
            {party.connected ? 'LIVE' : party.joining ? 'JOINING' : 'RECONNECTING'}
          </Text>
        </View>
        <View style={styles.headerMeta}>
          <View style={styles.roomNameContainer}>
            <Text style={styles.roomName}>{party.title || `Room ${roomId}`}</Text>
          </View>
          <Text style={styles.headerSub}>
            {party.joining
              ? 'joining the party…'
              : `${count} ${count === 1 ? 'person' : 'people'} in the party`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setInviteModalVisible(true)}
          style={[styles.headerBtn, styles.inviteHeaderBtn]}
          hitSlop={10}
        >
          <Icon name="account-plus" size={18} color="#FFD700" />
        </TouchableOpacity>
        <TouchableOpacity onPress={minimize} style={styles.headerBtn} hitSlop={10}>
          <Icon name="chevron-down" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={leave} style={[styles.headerBtn, styles.leaveBtn]} hitSlop={10}>
          <Icon name="power" size={17} color="#ff6b81" />
        </TouchableOpacity>
      </View>

      {party.joinError ? (
        <TouchableOpacity style={styles.errBanner} onPress={() => dispatch(setJoinError(null))}>
          <Icon name="wifi-off" size={14} color="#ffca28" />
          <Text style={styles.errText} numberOfLines={2}>
            {party.joinError} — tap to dismiss
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* ---------------- now playing ---------------- */}
      <PartyTransport roomId={roomId} />

      {/* ---------------- PARTICIPANT STRIP ----------------- */}
      <ParticipantStrip
        participants={participants}
        presence={party.presence || {}}
        meId={socket.id}
        djId={party.djSocketId}
        muted={muted}
        onPressMember={handleMemberPress}
        onPressInvite={() => setInviteModalVisible(true)}
      />

      {/* ---------------- the ONE flexible region (chat / queue) ---------------- */}
      <View style={styles.stage}>
        {party.joining && !count ? (
          <View style={styles.stageLoading}>
            <LoadingIndicator />
            <Text style={styles.stageLoadingText}>Pulling up a chair…</Text>
          </View>
        ) : (
          <DJPanel roomId={roomId} />
        )}
      </View>

      {/* ---------------- Quick Reaction Shelf (Party Vibe) ---------------- */}
      {showReactions ? (
        <View style={styles.reactionShelf}>
          {REACTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.reactionBtn}
              onPress={() => onSelectReaction(emoji)}
              activeOpacity={0.7}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* ---------------- Audio Output & Sound Dropdown Menu ---------------- */}
      {showAudioDropdown ? (
        <View style={styles.audioDropdownOverlay}>
          <TouchableOpacity
            style={styles.dropdownBackdrop}
            activeOpacity={1}
            onPress={() => setShowAudioDropdown(false)}
          />
          <View style={styles.audioDropdown}>
            <View style={styles.dropdownHeader}>
              <View style={styles.dropdownTitleRow}>
                <Icon name="tune-variant" size={16} color="#a78bfa" />
                <Text style={styles.dropdownTitle}>Playback & Audio Options</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAudioDropdown(false)}
                hitSlop={8}
                style={styles.dropdownCloseBtn}
              >
                <Icon name="close" size={16} color="#8f86b3" />
              </TouchableOpacity>
            </View>

            {/* Output Destination Options */}
            <View style={styles.routesList}>
              <TouchableOpacity
                style={[
                  styles.routeItem,
                  audioOutput === 'speaker' && styles.routeItemActive,
                ]}
                onPress={() => {
                  setAudioOutputMode('speaker', dispatch);
                  setShowAudioDropdown(false);
                }}
                activeOpacity={0.75}
              >
                <View style={styles.routeIconWrap}>
                  <Icon
                    name="volume-high"
                    size={18}
                    color={audioOutput === 'speaker' ? '#a78bfa' : '#8f86b3'}
                  />
                </View>
                <View style={styles.routeMeta}>
                  <Text
                    style={[
                      styles.routeLabel,
                      audioOutput === 'speaker' && styles.routeLabelActive,
                    ]}
                  >
                    Speaker
                  </Text>
                  <Text style={styles.routeSub}>Phone loudspeaker</Text>
                </View>
                {audioOutput === 'speaker' ? (
                  <Icon name="check" size={18} color="#a78bfa" />
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.routeItem,
                  (audioOutput === 'bluetooth' || audioOutput === 'bluetooth_hq') && styles.routeItemActive,
                ]}
                onPress={() => {
                  setAudioOutputMode('bluetooth', dispatch);
                  setShowAudioDropdown(false);
                }}
                activeOpacity={0.75}
              >
                <View style={styles.routeIconWrap}>
                  <Icon
                    name="headphones"
                    size={18}
                    color={(audioOutput === 'bluetooth' || audioOutput === 'bluetooth_hq') ? '#38bdf8' : '#8f86b3'}
                  />
                </View>
                <View style={styles.routeMeta}>
                  <Text
                    style={[
                      styles.routeLabel,
                      (audioOutput === 'bluetooth' || audioOutput === 'bluetooth_hq') && styles.routeLabelActive,
                    ]}
                  >
                    Bluetooth (HQ Audio)
                  </Text>
                  <Text style={styles.routeSub}>HD music(uses phone mic)</Text>
                </View>
                {(audioOutput === 'bluetooth' || audioOutput === 'bluetooth_hq') ? (
                  <Icon name="check" size={18} color="#38bdf8" />
                ) : null}
              </TouchableOpacity>
            </View>

            <View style={styles.dropdownDivider} />

            {/* Mute Incoming Sound (Voice + Music) */}
            <TouchableOpacity
              style={[
                styles.muteIncomingRow,
                muteIncoming && styles.muteIncomingRowActive,
              ]}
              onPress={() => setMuteIncomingSound(!muteIncoming, dispatch)}
              activeOpacity={0.75}
            >
              <View style={styles.routeIconWrap}>
                <Icon
                  name={muteIncoming ? 'volume-off' : 'volume-high'}
                  size={18}
                  color={muteIncoming ? '#ef4444' : '#8f86b3'}
                />
              </View>
              <View style={styles.routeMeta}>
                <Text
                  style={[
                    styles.routeLabel,
                    muteIncoming && styles.muteIncomingLabelActive,
                  ]}
                >
                  Mute Room Audio
                </Text>
                <Text style={styles.routeSub}>Silence music & incoming voices</Text>
              </View>
              <View style={[styles.togglePill, muteIncoming && styles.togglePillActive]}>
                <Text
                  style={[
                    styles.togglePillText,
                    muteIncoming && styles.togglePillTextActive,
                  ]}
                >
                  {muteIncoming ? 'MUTED' : 'OFF'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* ---------------- COMPACT CONTROL BAR ---------------- */}
      <View style={styles.controls}>
        <ControlButton
          label={muted ? 'Muted' : 'Mic On'}
          onPress={toggleMute}
          icon={muted ? 'microphone-off' : 'microphone'}
          variant={muted ? 'danger' : 'success'}
        />

        <ControlButton
          label={
            muteIncoming
              ? 'Sound Off'
              : audioOutput === 'bluetooth' || audioOutput === 'bluetooth_hq'
              ? 'Bluetooth'
              : 'Speaker'
          }
          onPress={() => {
            setShowAudioDropdown((prev) => !prev);
            setShowReactions(false);
          }}
          icon={
            muteIncoming
              ? 'volume-off'
              : audioOutput === 'bluetooth' || audioOutput === 'bluetooth_hq'
              ? 'headphones'
              : 'volume-high'
          }
          variant={
            muteIncoming
              ? 'danger'
              : audioOutput === 'bluetooth' || audioOutput === 'bluetooth_hq'
              ? 'bluetooth'
              : 'audio'
          }
          active={showAudioDropdown}
        />

        <ControlButton
          label="React"
          onPress={() => {
            setShowReactions((prev) => !prev);
            setShowAudioDropdown(false);
          }}
          icon="party-popper"
          active={showReactions}
          variant="party"
        />
      </View>

      {/* ---------------- INVITE FRIENDS MODAL ---------------- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={inviteModalVisible}
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.inviteModalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="account-multiple-plus" size={20} color="#FFD700" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Invite Friends to Party 🎧</Text>
              </View>
              <TouchableOpacity onPress={() => setInviteModalVisible(false)}>
                <Icon name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320, marginVertical: 10 }}>
              {friends.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <Text style={{ color: '#888888', fontSize: 13 }}>No friends connected yet.</Text>
                </View>
              ) : (
                friends.map((f) => {
                  const fid = f.friendId || f.id;
                  const isInvited = invitedIds.includes(fid);
                  return (
                    <View key={fid} style={styles.inviteFriendRow}>
                      {f.picture ? (
                        <Image source={{ uri: f.picture }} style={styles.inviteFriendAvatar} />
                      ) : (
                        <View style={[styles.inviteFriendAvatar, styles.avatarFallback]}>
                          <Icon name="account" size={18} color="#FFFFFF" />
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.inviteFriendName} numberOfLines={1}>
                          {f.name}
                        </Text>
                        <Text style={styles.inviteFriendSynergy}>
                          {f.synergyPoints || 10} Mutual Synergy
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.sendInviteBtn, isInvited && styles.sendInviteBtnSent]}
                        disabled={isInvited}
                        onPress={async () => {
                          setInvitedIds((prev) => [...prev, fid]);
                          await sendInvite({
                            recipientId: fid,
                            roomId,
                            roomTitle: party.title || `Party Room #${roomId}`,
                          });
                        }}
                      >
                        <Icon
                          name={isInvited ? 'check' : 'send'}
                          size={14}
                          color="#FFFFFF"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.sendInviteBtnText}>
                          {isInvited ? 'Invited' : 'Invite'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default PartyRoom;

/* ------------------------------------------------------------------ */
/* Participant strip — horizontal, compact height, never squeezes out  */
/* ------------------------------------------------------------------ */
function ParticipantStrip({ participants, presence, meId, djId, muted, onPressMember, onPressInvite }) {
  return (
    <View style={styles.stripWrap}>
      <View style={styles.stripHead}>
        <Icon name="account-group" size={14} color="#a99ce0" />
        <Text style={styles.stripTitle}>In the party</Text>
        <View style={styles.countChip}>
          <Text style={styles.countChipText}>{participants.length}</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripScroll}
      >
        <TouchableOpacity style={styles.stripInviteBtn} onPress={onPressInvite} activeOpacity={0.8}>
          <View style={styles.stripInviteIconBox}>
            <Icon name="account-plus" size={16} color="#FFD700" />
          </View>
          <Text style={styles.stripInviteText}>Invite</Text>
        </TouchableOpacity>
        {participants.length === 0 ? (
          <Text style={styles.stripEmpty}>Waiting for friends to pull up…</Text>
        ) : (
          participants.map((p) => {
            const isMe = p.id === meId;
            const isDj = p.id === djId;
            const pr = presence[p.id] || {};
            const isMuted = isMe ? muted : !!pr.muted;
            const name = p.name || p.userName || 'Guest';
            const initial = String(name).trim().charAt(0).toUpperCase() || '?';
            return (
              <TouchableOpacity
                key={String(p.id)}
                style={styles.person}
                onPress={() => !isMe && onPressMember && onPressMember(p)}
                activeOpacity={isMe ? 1 : 0.75}
              >
                <View
                  style={[
                    styles.avatarRing,
                    isDj && styles.ringDj,
                    isMe && styles.ringMe,
                    !isMuted && styles.ringSpeaking,
                  ]}
                >
                  {p.picture ? (
                    <Image source={{ uri: p.picture }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatarImg, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>{initial}</Text>
                    </View>
                  )}
                  {isMuted ? (
                    <View style={styles.muteBadge}>
                      <Icon name="microphone-off" size={9} color="#fff" />
                    </View>
                  ) : (
                    <View style={styles.speakingBadge}>
                      <Icon name="volume-high" size={8} color="#22c55e" />
                    </View>
                  )}
                  {isDj ? (
                    <View style={styles.crown}>
                      <Icon name="crown" size={10} color="#141018" />
                    </View>
                  ) : null}
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.personName, isMe && styles.personNameMe]}
                >
                  {isMe ? 'You' : name}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Compact Bottom control button                                      */
/* ------------------------------------------------------------------ */
function ControlButton({ label, onPress, icon, variant, active }) {
  const getStyle = () => {
    if (variant === 'danger') return styles.btnDanger;
    if (variant === 'success') return styles.btnSuccess;
    if (variant === 'bluetooth') return styles.btnBluetooth;
    if (variant === 'audio') return styles.btnAudio;
    if (variant === 'party') return styles.btnParty;
    return styles.btnDefault;
  };

  const getIconColor = () => {
    if (variant === 'danger') return '#ef4444';
    if (variant === 'success') return '#22c55e';
    if (variant === 'bluetooth') return '#38bdf8';
    if (variant === 'audio') return '#a78bfa';
    if (variant === 'party') return '#f472b6';
    return '#fff';
  };

  return (
    <TouchableOpacity style={styles.control} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.controlBtn, getStyle(), active && styles.btnActive]}>
        <Icon name={icon} size={18} color={getIconColor()} />
      </View>
      <Text style={[styles.controlLabel, active && styles.controlLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0d0a14' },

  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 6,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,45,85,0.14)',
    borderColor: 'rgba(255,45,85,0.45)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  livePillOff: {
    backgroundColor: 'rgba(120,113,108,0.14)',
    borderColor: 'rgba(120,113,108,0.4)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff2d55' },
  liveDotOff: { backgroundColor: '#888' },
  liveText: { color: '#ff6b81', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  liveTextOff: { color: '#aaa' },
  headerMeta: { flex: 1 },
  roomName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  headerSub: { color: '#8f86b3', fontSize: 10, marginTop: 1 },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtn: { backgroundColor: 'rgba(255,60,90,0.14)' },
  errBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 12,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,202,40,0.10)',
  },
  errText: { color: '#ffca28', fontSize: 11, flex: 1 },

  /* participant strip */
  stripWrap: { paddingTop: 4, paddingBottom: 2 },
  stripHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    marginBottom: 5,
  },
  stripTitle: { color: '#cfc6f5', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  countChip: {
    minWidth: 18,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: '#6200ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChipText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  stripScroll: { paddingHorizontal: 12, alignItems: 'flex-start' },
  stripEmpty: { color: '#6d6590', fontSize: 11, paddingVertical: 10, paddingHorizontal: 4 },
  person: { width: 54, alignItems: 'center', marginRight: 6 },
  avatarRing: {
    width: AVATAR + 6,
    height: AVATAR + 6,
    borderRadius: (AVATAR + 6) / 2,
    borderWidth: 1.5,
    borderColor: '#3a3155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringMe: { borderColor: '#8b5cf6' },
  ringDj: { borderColor: '#ffca28', borderWidth: 2 },
  ringSpeaking: { borderColor: '#22c55e', borderWidth: 2 },
  avatarImg: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: '#2a2340',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#c9b6ff', fontSize: 18, fontWeight: '700' },
  muteBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#c62828',
    borderWidth: 1.5,
    borderColor: '#0d0a14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakingBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#14532d',
    borderWidth: 1.5,
    borderColor: '#0d0a14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crown: {
    position: 'absolute',
    top: -7,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffca28',
    borderWidth: 1.5,
    borderColor: '#0d0a14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personName: {
    color: '#9a90bd',
    fontSize: 9,
    marginTop: 3,
    maxWidth: 54,
    textAlign: 'center',
  },
  personNameMe: { color: '#fff', fontWeight: '700' },

  /* the single flexible region (flex: 1 maximized) */
  stage: { flex: 1, minHeight: 0, marginTop: 4, paddingHorizontal: 10 },
  stageLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stageLoadingText: { color: '#7d74a3', fontSize: 12 },

  /* Quick Reaction Shelf */
  reactionShelf: {
    position: 'absolute',
    bottom: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(21, 16, 34, 0.96)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#3b2d5c',
    gap: 8,
    shadowColor: '#f472b6',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 20,
  },
  reactionBtn: { padding: 4 },
  reactionEmoji: { fontSize: 22 },

  /* Audio Output & Sound Dropdown */
  audioDropdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  audioDropdown: {
    backgroundColor: '#171128',
    marginHorizontal: 12,
    marginBottom: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#302450',
    padding: 14,
    shadowColor: '#a78bfa',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2b214a',
  },
  dropdownTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dropdownTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dropdownCloseBtn: {
    padding: 2,
  },
  routesList: {
    gap: 6,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  routeItemActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    borderColor: 'rgba(167, 139, 250, 0.4)',
  },
  routeIconWrap: {
    width: 28,
    alignItems: 'center',
    marginRight: 8,
  },
  routeMeta: {
    flex: 1,
  },
  routeLabel: {
    color: '#cfc6f5',
    fontSize: 12,
    fontWeight: '700',
  },
  routeLabelActive: {
    color: '#fff',
  },
  routeSub: {
    color: '#7f75a6',
    fontSize: 10,
    marginTop: 1,
  },
  dropdownDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#2b214a',
    marginVertical: 8,
  },
  muteIncomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  muteIncomingRowActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  muteIncomingLabelActive: {
    color: '#f87171',
  },
  togglePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  togglePillActive: {
    backgroundColor: '#ef4444',
  },
  togglePillText: {
    color: '#8f86b3',
    fontSize: 9,
    fontWeight: '800',
  },
  togglePillTextActive: {
    color: '#fff',
  },

  /* compact control bar */
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#241d33',
    backgroundColor: '#120e1c',
  },
  control: { alignItems: 'center', gap: 2, minWidth: 64 },
  controlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  btnDefault: { backgroundColor: 'rgba(255,255,255,0.06)' },
  btnSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  btnDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  btnAudio: {
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  btnBluetooth: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  btnParty: {
    backgroundColor: 'rgba(236, 72, 153, 0.16)',
    borderColor: 'rgba(236, 72, 153, 0.4)',
  },
  btnActive: {
    shadowColor: '#fff',
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  controlLabel: { color: '#8f86b3', fontSize: 9.5, fontWeight: '600' },
  controlLabelActive: { color: '#f472b6' },

  /* Invite Friends Modal & Strip Styles */
  inviteHeaderBtn: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
  },
  stripInviteBtn: {
    width: 54,
    alignItems: 'center',
    marginRight: 6,
  },
  stripInviteIconBox: {
    width: AVATAR + 6,
    height: AVATAR + 6,
    borderRadius: (AVATAR + 6) / 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 215, 0, 0.6)',
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripInviteText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  inviteModalContent: {
    backgroundColor: '#18122B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#3b2d5c',
    padding: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  inviteFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#251b3d',
  },
  inviteFriendAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 12,
  },
  inviteFriendName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inviteFriendSynergy: {
    fontSize: 11,
    color: '#a78bfa',
    marginTop: 2,
  },
  sendInviteBtn: {
    backgroundColor: '#6200ee',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sendInviteBtnSent: {
    backgroundColor: '#2e244d',
    borderWidth: 1,
    borderColor: '#4d3a7d',
  },
  sendInviteBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

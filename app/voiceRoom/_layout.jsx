import React, { useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  BackHandler,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { socket } from '@/configs/socket';
import LoadingIndicator from '@/components/LoadingIndicator';
import DJPanel from './DJPanel';
import PartyTransport from './PartyTransport';
import { setRoom, setMinimised, resetParty, setJoinError } from '@/state/slices/party.slice';
import { usePartyPresence, REACTIONS } from '@/hooks/partyPresence.hooks';

const { width: SCREEN_W } = Dimensions.get('window');
const AVATAR = 58;

/**
 * Party room SCREEN — a pure view.
 *
 * The runtime (socket membership, WebRTC voice, shared-listening sync, chat
 * buffer) lives at the app root in components/PartyHost.jsx, which is what
 * lets the hardware back button MINIMISE this screen instead of leaving the
 * room. Leaving is now an explicit action (the power button in the header).
 *
 * The vertical budget is fixed so nothing can ever be pushed off-screen:
 *   header | now-playing card | participant strip | FLEX stage | control bar
 * Only the stage flexes, and every list inside it scrolls internally — a long
 * queue or a long chat can no longer shove the participants out the window.
 */
const PartyRoom = () => {
  const dispatch = useDispatch();
  const { roomId } = useLocalSearchParams();
  const party = useSelector((s) => s.party);
  const { muted, raisedHand, toggleMute, toggleHand, react } = usePartyPresence();

  // Register this room as ours — PartyHost does the actual joining.
  useEffect(() => {
    if (roomId) dispatch(setRoom(roomId));
    dispatch(setMinimised(false));
    return undefined;
  }, [dispatch, roomId]);

  // Hardware back minimises the room; leaving is an explicit action.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dispatch(setMinimised(true));
      router.back();
      return true;
    });
    return () => sub.remove();
  }, [dispatch]);

    const minimize = () => {
      dispatch(setMinimised(true));
      router.back();
    };

    const leave = () => {
      dispatch(resetParty());
      router.back();
    };

    const throwConfetti = () => {
      react(REACTIONS[Math.floor(Math.random() * REACTIONS.length)]);
    };

    const participants = party.participants || [];
    const count = participants.length;

    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* ---------------- header ---------------- */}
        <View style={styles.header}>
          <View style={styles.livePill}>
            <View style={[styles.liveDot, !party.connected && styles.liveDotOff]} />
            <Text style={styles.liveText}>{party.connected ? 'LIVE' : 'OFF'}</Text>
          </View>
          <View style={styles.headerMeta}>
            <View style={styles.roomNameContainer}>
              <Text style={styles.roomName}>Room {roomId}</Text>
            </View>
            <Text style={styles.headerSub}>
              {party.joining
                ? 'joining the party…'
                : `${count} ${count === 1 ? 'person' : 'people'} in the party`}
            </Text>
          </View>
          <TouchableOpacity onPress={minimize} style={styles.headerBtn} hitSlop={10}>
            <Icon name="chevron-down" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={leave} style={[styles.headerBtn, styles.leaveBtn]} hitSlop={10}>
            <Icon name="power" size={18} color="#ff6b81" />
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

        {/* ---------------- PARTICIPANT STRIP - IMPROVED ----------------- */}
        <ParticipantStrip
          participants={participants}
          presence={party.presence || {}}
          meId={socket.id}
          djId={party.djSocketId}
          muted={muted}
          raisedHand={raisedHand}
        />

        {/* ---------------- the ONE flexible region ---------------- */}
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

        {/* ---------------- CONTROL BAR ---------------- */}
        <View style={styles.controls}>
          <ControlButton
            label={muted ? 'Unmute' : 'Mute'}
            onPress={toggleMute}
            icon={muted ? 'microphone-off' : 'microphone'}
            fab
            danger={muted}
          />
          <ControlButton
            label={raisedHand ? 'Lower hand' : 'Raise hand'}
            onPress={toggleHand}
            icon="hand-back-right"
            active={raisedHand}
          />
          <ControlButton label="React" onPress={throwConfetti} icon="party-popper" />
        </View>
      </SafeAreaView>
    );
  };

export default PartyRoom;

/* ------------------------------------------------------------------ */
/* Participant strip — horizontal, fixed height, never squeezes out    */
/* ------------------------------------------------------------------ */
function ParticipantStrip({ participants, presence, meId, djId, muted, raisedHand }) {
  return (
    <View style={styles.stripWrap}>
      <View style={styles.stripHead}>
        <Icon name="account-group" size={15} color="#a99ce0" />
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
        {participants.length === 0 ? (
          <Text style={styles.stripEmpty}>Waiting for friends to pull up…</Text>
        ) : (
          participants.map((p) => {
            const isMe = p.id === meId;
            const isDj = p.id === djId;
            const pr = presence[p.id] || {};
            const isMuted = isMe ? muted : !!pr.muted;
            const isHand = isMe ? raisedHand : !!pr.raisedHand;
            const name = p.name || p.userName || 'Guest';
            const initial = String(name).trim().charAt(0).toUpperCase() || '?';
            return (
              <View key={String(p.id)} style={styles.person}>
                <View
                  style={[
                    styles.avatarRing,
                    isDj && styles.ringDj,
                    isMe && styles.ringMe,
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
                      <Icon name="microphone-off" size={10} color="#fff" />
                    </View>
                  ) : null}
                  {isHand ? (
                    <View style={styles.handBadge}>
                      <Text style={styles.handEmoji}>✋</Text>
                    </View>
                  ) : null}
                  {isDj ? (
                    <View style={styles.crown}>
                      <Icon name="crown" size={11} color="#141018" />
                    </View>
                  ) : null}
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.personName, isMe && styles.personNameMe]}
                >
                  {isMe ? 'You' : name}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom control                                                      */
/* ------------------------------------------------------------------ */
function ControlButton({ label, onPress, icon, fab, active, danger }) {
  return (
    <TouchableOpacity style={styles.control} onPress={onPress} activeOpacity={0.8}>
      <View
        style={[
          styles.controlFab,
          fab && styles.controlFabBig,
          active && styles.controlActive,
          danger && styles.controlDanger,
        ]}
      >
        <Icon name={icon} size={fab ? 26 : 22} color="#fff" />
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
    paddingTop: 6,
    paddingBottom: 8,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,45,85,0.14)',
    borderColor: 'rgba(255,45,85,0.45)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ff2d55' },
  liveDotOff: { backgroundColor: '#666' },
  liveText: { color: '#ff6b81', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  headerMeta: { flex: 1 },
  roomName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  headerSub: { color: '#8f86b3', fontSize: 11, marginTop: 1 },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtn: { backgroundColor: 'rgba(255,60,90,0.14)' },
  errBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 14,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,202,40,0.10)',
  },
  errText: { color: '#ffca28', fontSize: 11, flex: 1 },

  /* participant strip */
  stripWrap: { paddingTop: 6, paddingBottom: 4 },
  stripHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 8 },
  stripTitle: { color: '#cfc6f5', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  countChip: {
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: '#6200ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChipText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  stripScroll: { paddingHorizontal: 14, alignItems: 'flex-start' },
  stripEmpty: { color: '#6d6590', fontSize: 12, paddingVertical: 16, paddingHorizontal: 4 },
  person: { width: 64, alignItems: 'center', marginRight: 8 },
  avatarRing: {
    width: AVATAR + 8,
    height: AVATAR + 8,
    borderRadius: (AVATAR + 8) / 2,
    borderWidth: 2,
    borderColor: '#3a3155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringMe: { borderColor: '#8b5cf6' },
  ringDj: { borderColor: '#ffca28' },
  avatarImg: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: '#2a2340' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#c9b6ff', fontSize: 22, fontWeight: '700' },
  muteBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#c62828',
    borderWidth: 2,
    borderColor: '#0d0a14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2c2140',
    borderWidth: 1,
    borderColor: '#ffca28',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handEmoji: { fontSize: 11, lineHeight: 13 },
  crown: {
    position: 'absolute',
    top: -9,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffca28',
    borderWidth: 2,
    borderColor: '#0d0a14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personName: { color: '#9a90bd', fontSize: 10, marginTop: 5, maxWidth: 64, textAlign: 'center' },
  personNameMe: { color: '#fff', fontWeight: '700' },

  /* the single flexible region */
  stage: { flex: 1, minHeight: 0, marginTop: 6, paddingHorizontal: 10 },
  stageLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stageLoadingText: { color: '#7d74a3', fontSize: 12 },

  /* control bar */
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#241d33',
    backgroundColor: '#120e1c',
  },
  control: { alignItems: 'center', gap: 4, minWidth: 78 },
  controlFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2c2140',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlFabBig: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1f7a4d' },
  controlActive: { backgroundColor: '#c98a00' },
  controlDanger: { backgroundColor: '#c62828' },
  controlLabel: { color: '#8f86b3', fontSize: 10, fontWeight: '600' },
  controlLabelActive: { color: '#ffca28' },
});

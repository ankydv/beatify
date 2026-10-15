import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  BackHandler,
  AppState,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { socket, ensureSocketConnected, emitWithAck } from '@/configs/socket';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import ChatComponent from './chat';
import WebRTCClient from './webRTC';
import LoadingIndicator from '@/components/LoadingIndicator';
import DJPanel from './DJPanel';
import { usePartyPlayback, restorePersonalTrack } from '@/services/party.service';
import { usePartyRekey } from '@/hooks/partyRekey.hooks';
import { useDispatch } from 'react-redux';
import { resetParty, setRoom } from '@/state/slices/party.slice';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const AVATAR_SIZE = Math.min(76, (SCREEN_WIDTH - 64) / NUM_COLUMNS - 16);

const PartyRoom = ({ onToggleMic= () =>{} }) => {
  const [isMuted, setIsMuted] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [participantsList, setParticipantsList] = useState([]);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isJoining, setIsJoining] = useState(true);
  const [joinError, setJoinError] = useState(null);
  const [isRejoining, setIsRejoining] = useState(false);
  const { roomId } = useLocalSearchParams();
  const reduxDispatch = useDispatch();
  const joinedParty = !isJoining && !joinError && roomId;
  usePartyPlayback({ roomId, enabled: !!joinedParty });
  usePartyRekey({ roomId, enabled: !!joinedParty });
  useEffect(() => {
    if (roomId) reduxDispatch(setRoom(roomId));
    return () => {
      // Restore the user's own PlayerScreen / bottom-bar track; the room
      // only ever mirrored into audio.currentTrack, personal queue untouched.
      restorePersonalTrack(reduxDispatch);
      reduxDispatch(resetParty());
    };
  }, [roomId, reduxDispatch]);
  const peerConnectionRef = useRef(null);
  const mountedRef = useRef(true);
  const joinAttemptRef = useRef(0);
  const leavingRef = useRef(false);
  // Idempotent-join tracking: which room the server already has us in,
  // and on which exact connection (socket.id changes on every reconnect).
  const joinedRoomRef = useRef(null);
  const joinedSocketIdRef = useRef(null);
  const joinInFlightRef = useRef(false);
  const initialJoinDoneRef = useRef(false);
  // getToken identity isn't guaranteed stable — keep it in a ref so
  // joinRoom stays referentially stable and effects don't re-fire.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  // Toggle mute/unmute (wired to WebRTC local tracks via `muted` prop)
  const handleMicToggle = () => {
    setIsMuted((prev) => {
      const next = !prev;
      onToggleMic(next);
      return next;
    });
  };

  const handleLeaveRoom = useCallback(() =>{
    leavingRef.current = true;
    joinAttemptRef.current++; // invalidate any in-flight join
    joinedRoomRef.current = null;
    joinedSocketIdRef.current = null;
    try {
      if (socket.connected) {
        socket.emit('leave-room', {roomId: roomId});
      }
    } catch (e) {
      console.warn('[room] leave-room emit failed:', e?.message ?? e);
    }
    router.back();
  }, [roomId, router]);

  const onBackPress = useCallback(() => {
    handleLeaveRoom();
    return true;
  }, [handleLeaveRoom]);

    useFocusEffect(
      useCallback(() => {
        mountedRef.current = true;
        leavingRef.current = false;
        const backHandler = BackHandler.addEventListener(
          "hardwareBackPress",
          onBackPress
        );

        return () => backHandler.remove();
      }, [onBackPress])
    );

  const joinRoom = useCallback(async (reason = 'manual') => {
    if (leavingRef.current || !mountedRef.current) return;
    // Idempotency guard: already joined this room on this exact
    // connection — re-emitting would make the server answer
    // "user is already in room".
    if (
      joinedRoomRef.current === roomId &&
      joinedSocketIdRef.current === socket.id &&
      socket.connected
    ) {
      return;
    }
    // Don't stack concurrent joins (StrictMode / foreground / connect
    // can all fire at once) — the in-flight attempt covers them.
    if (joinInFlightRef.current) return;
    // Count the attempt AFTER the guards so no-op calls don't
    // invalidate a real in-flight attempt's staleness checks.
    const attempt = ++joinAttemptRef.current;
    joinInFlightRef.current = true;
    console.log(`[room] joining (${reason}):`, roomId);
    const firstJoin = !initialJoinDoneRef.current;
    initialJoinDoneRef.current = true;
    if (firstJoin) {
      setJoinError(null);
    } else {
      setIsRejoining(true);
    }
    try {
      // Reconnect (fresh Clerk token) then join with ack + timeout.
      // Fixes the "minimised app, came back, stuck on room page" bug:
      // the old code only joined on the first `connect` event and never
      // retried if the socket died while backgrounded.
      await ensureSocketConnected(() => getTokenRef.current());
      if (!mountedRef.current || leavingRef.current || attempt !== joinAttemptRef.current) return;
      const response = await emitWithAck('join-room', { roomId });
      if (!mountedRef.current || leavingRef.current || attempt !== joinAttemptRef.current) return;
      // Idempotent join: the server may answer "user is already in room"
      // if a previous emit already landed (retry, StrictMode, race).
      // That means we're IN — accept it instead of erroring/looping.
      const alreadyIn =
        !response?.success && /already in/i.test(response?.message ?? '');
      if (response?.success || alreadyIn) {
        if (alreadyIn) {
          console.log('[room] already in room — treating as joined:', roomId);
        } else {
          console.log('Successfully joined room:', roomId);
        }
        joinedRoomRef.current = roomId;
        joinedSocketIdRef.current = socket.id;
        setParticipantsList((prev) => response.roomParticipants ?? prev);
        setJoinError(null);
        setIsJoining(false);
      } else {
        throw new Error(response?.message || 'Failed to join room');
      }
    } catch (err) {
      if (!mountedRef.current || leavingRef.current || attempt !== joinAttemptRef.current) return;
      console.warn('[room] join failed:', err?.message ?? err);
      setJoinError(err?.message ?? 'Failed to join room');
      setIsJoining(false);
    } finally {
      joinInFlightRef.current = false;
      if (mountedRef.current && attempt === joinAttemptRef.current) {
        setIsRejoining(false);
      }
    }
  }, [roomId]);

  // Reset join state when switching rooms in a reused screen instance.
  useEffect(() => {
    joinAttemptRef.current++; // cancel any in-flight join for the old room
    joinInFlightRef.current = false;
    joinedRoomRef.current = null;
    joinedSocketIdRef.current = null;
    initialJoinDoneRef.current = false;
    setParticipantsList([]);
    setJoinError(null);
    setIsJoining(true);
    setIsRejoining(false);
  }, [roomId]);

  // Rejoin when the app returns to foreground (socket was killed in bg).
  // joinRoom() is idempotent — a no-op when already joined on this
  // connection — so this is safe to call on every foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && mountedRef.current && !leavingRef.current) {
        joinRoom('foreground');
      }
    });
    return () => sub.remove();
  }, [joinRoom]);

  useEffect(() => {
    mountedRef.current = true;
    joinRoom('initial');

    function onConnect() {
      if (!mountedRef.current || leavingRef.current) return;
      console.log('[room] socket connected');
      setIsConnected(true);
      // Re-join ONLY when the underlying connection actually changed
      // (new socket.id after a drop — the server tracks membership per
      // connection). Re-emitting on the same connection just yields
      // "user is already in room" and used to spin forever.
      if (
        joinedRoomRef.current === roomId &&
        joinedSocketIdRef.current !== socket.id
      ) {
        console.log('[room] connection changed — rejoining room');
        joinRoom('reconnect');
      }
    }

    function onDisconnect() {
      console.log('[room] socket disconnected');
      if (mountedRef.current) setIsConnected(false);
    }

    function onJoined(data){
      console.log(data.userId+" joined");
      setParticipantsList(data.roomParticipants ?? []);
    }

    function onLeft(data){
      console.log(data.userId+" left");
      setParticipantsList(data.roomParticipants ?? []);
    }

    function onError(error) {
      const msg = error?.message ?? error;
      console.log(msg);
      if (!mountedRef.current) return;
      // Benign: an idempotent re-join raced with the in-flight one and
      // the server already had us in the room. Mark joined, don't error.
      if (/already in/i.test(String(msg ?? ''))) {
        joinedRoomRef.current = roomId;
        joinedSocketIdRef.current = socket.id;
        setJoinError(null);
        setIsJoining(false);
        return;
      }
      setJoinError(String(msg ?? 'Room error'));
      setIsJoining(false);
    }
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('user-joined', onJoined);
    socket.on('user-left', onLeft);
    socket.on('error', onError);

    return () => {
      mountedRef.current = false;
      joinInFlightRef.current = false;
      // Safety net: leaving via gesture (swipe-back) or a roomId change
      // bypasses handleLeaveRoom — don't leave ghost membership behind.
      if (
        !leavingRef.current &&
        joinedRoomRef.current === roomId &&
        socket.connected
      ) {
        try {
          socket.emit('leave-room', { roomId });
        } catch (e) {}
      }
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('user-joined', onJoined);
      socket.off('user-left', onLeft);
      socket.off('error', onError);
    };
  }, [joinRoom]);

  
  if(isJoining){
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <LoadingIndicator />
      </SafeAreaView>
    );
  }

  if (joinError && participantsList.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.errorWrap}>
          <Icon name="wifi-off" size={44} color="#f44" />
          <Text style={styles.errorTitle}>Couldn't join room</Text>
          <Text style={styles.errorMsg}>{joinError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={joinRoom}>
            <Icon name="refresh" size={18} color="#fff" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {/* Room Header */}
      <View style={styles.header}>
        <View style={styles.roomTitleWrap}>
          <Text style={styles.roomName} numberOfLines={1}>{roomId}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, isConnected ? styles.dotOn : styles.dotOff]} />
            <Text style={styles.participantCount}>
              {participantsList?.length ?? 0} Participants{!isConnected ? ' • reconnecting…' : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveRoom} hitSlop={8}>
          <Icon name="exit-to-app" size={18} color="#fff" />
          <Text style={styles.leaveText}>Leave</Text>
        </TouchableOpacity>
      </View>

      {isRejoining && (
        <View style={styles.rejoinBanner}>
          <ActivityIndicator size="small" color="#ffca28" />
          <Text style={styles.rejoinText}>Reconnecting…</Text>
          {joinError ? <Text style={styles.rejoinErr} numberOfLines={1}>{joinError}</Text> : null}
        </View>
      )}
      {!isRejoining && joinError ? (
        <TouchableOpacity style={styles.inlineRetry} onPress={joinRoom}>
          <Icon name="refresh" size={14} color="#ffca28" />
          <Text style={styles.inlineRetryText}>Tap to retry ({joinError})</Text>
        </TouchableOpacity>
      ) : null}

      {/* User Grid - flex:1 fills all leftover space so Chat + Controls
          are always pushed to the bottom, never floating in the middle. */}
      <FlatList
        data={participantsList}
        numColumns={NUM_COLUMNS}
        keyExtractor={(item, index) => (item?.id ?? index).toString()}
        contentContainerStyle={styles.gridContainer}
        style={styles.grid}
        renderItem={({ item }) => (
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: item.picture || 'https://plus.unsplash.com/premium_vector-1731922571927-ac1d331d87e3?q=80&w=2360&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }}
              style={[
                styles.avatar,
                item.isSpeaking && styles.speakingBorder,
              ]}
            />
            <Text style={styles.username} numberOfLines={1}>{item.userName}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyGrid}>No one here yet — invite friends!</Text>
        }
      />
      {/* Bottom block: Chat + Voice Controls pinned to bottom */}
      <View style={styles.bottomSection}>
      {/* Shared listening (DJ queue + requests + search) */}
      {!isJoining && roomId ? <DJPanel roomId={roomId} /> : null}
      {/* Chat */}
      <ChatComponent roomId={roomId}/>
      {/* Voice Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={handleMicToggle} style={styles.controlButton} hitSlop={8}>
          <View style={[styles.micFab, isMuted && styles.micFabMuted]}>
            <Icon
              name={isMuted ? 'microphone-off' : 'microphone'}
              size={24}
              color="#fff"
            />
          </View>
          <Text style={styles.controlText}>
            {isMuted ? 'Unmute' : 'Mute'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} hitSlop={8}>
          <View style={styles.handFab}>
            <Icon name="hand-front-right" size={24} color="#fff" />
          </View>
          <Text style={styles.controlText}>Raise Hand</Text>
        </TouchableOpacity>
      </View>
      </View>
      {/* Voice (WebRTC mesh, audio-only). Mounted only after join so
          roomId + participants are ready. Hidden 1x1 views play audio;
          mute is wired to local mic tracks. */}
      {!isJoining && roomId ? (
        <WebRTCClient
          roomId={roomId}
          participantsList={participantsList}
          muted={isMuted}
        />
      ) : null}
      </View>
    </SafeAreaView>
  );
};

export default PartyRoom;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  roomTitleWrap: {
    flex: 1,
    marginRight: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: '#4caf50' },
  dotOff: { backgroundColor: '#f44' },
  roomName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  participantCount: {
    fontSize: 12,
    color: '#aaa',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e53935',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  leaveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  rejoinBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2a2200',
    borderColor: '#ffca28',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  rejoinText: { color: '#ffca28', fontSize: 12, fontWeight: '600' },
  rejoinErr: { color: '#ffca28', fontSize: 11, flex: 1, opacity: 0.8 },
  inlineRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    marginBottom: 4,
  },
  inlineRetryText: { color: '#ffca28', fontSize: 12 },
  grid: { flex: 1, flexShrink: 1 },
  gridContainer: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  bottomSection: {
    flexShrink: 0,
    flexGrow: 0,
  },
  avatarContainer: {
    flex: 1,
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
    maxWidth: `${100 / NUM_COLUMNS}%`,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: '#444',
  },
  speakingBorder: {
    borderColor: '#4caf50',
  },
  username: {
    marginTop: 6,
    fontSize: 11,
    color: '#fff',
    textAlign: 'center',
    maxWidth: '100%',
  },
  emptyGrid: {
    textAlign: 'center',
    color: '#777',
    fontSize: 13,
    paddingVertical: 12,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a2a',
  },
  controlButton: {
    alignItems: 'center',
    gap: 4,
    minWidth: 80,
  },
  micFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2e7d32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micFabMuted: {
    backgroundColor: '#c62828',
  },
  handFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ef6c00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlText: {
    fontSize: 11,
    color: '#ddd',
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  errorTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  errorMsg: { color: '#aaa', fontSize: 13, textAlign: 'center' },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6200ee',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    marginTop: 8,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  backButton: { padding: 10 },
  backText: { color: '#aaa', fontSize: 13 },
});

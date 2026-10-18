import React, { useEffect, useRef, memo } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  PanResponder,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { resetParty, setMinimised } from '@/state/slices/party.slice';
import { usePartyPresence } from '@/hooks/partyPresence.hooks';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PILL_WIDTH = 200;
const PILL_HEIGHT = 44;

/**
 * Compact, movable floating pill shown while the voice room is minimised.
 * Optimized for lag-free 60fps dragging and zero redundant re-renders.
 */
function PartyMiniBar() {
  const dispatch = useDispatch();

  // Fine-grained selectors prevent re-rendering on party chat/audio sync packets
  const roomId = useSelector((s) => s.party.roomId);
  const minimised = useSelector((s) => s.party.minimised);
  const connected = useSelector((s) => s.party.connected);
  const currentSong = useSelector((s) =>
    s.party.currentIndex >= 0 ? s.party.queue[s.party.currentIndex] : null
  );
  const participantCount = useSelector((s) => s.party.participants?.length ?? 0);
  const { muted, toggleMute } = usePartyPresence();

  // ---- Floating position (drag state lives entirely in refs: zero re-renders) ----
  const DEFAULT_POS = {
    x: SCREEN_WIDTH - PILL_WIDTH - 16,
    y: 110,
  };
  // useState initializer = guaranteed single creation, never null (unlike
  // useRef(null) + render-time assignment which leaves a null window).
  const [pan] = React.useState(() => new Animated.ValueXY({ ...DEFAULT_POS }));
  const panRef = useRef(null);
  panRef.current = pan;
  // Plain-object ref with a REAL initial value so `.current.x` can never throw.
  const basePosRef = useRef({ ...DEFAULT_POS });

  // Fresh window metrics per call => rotation-safe, no extra re-renders.
  const clampPos = (x, y) => {
    const { width: w, height: h } = Dimensions.get('window');
    return {
      x: Math.min(Math.max(x, 8), Math.max(8, w - PILL_WIDTH - 8)),
      y: Math.min(Math.max(y, 50), Math.max(50, h - 120)),
    };
  };

  // Pulse animation for LIVE indicator
  const [pulse] = React.useState(() => new Animated.Value(0.45));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const settleDrag = (gestureState) => {
    const base = basePosRef.current ?? DEFAULT_POS;
    const pv = panRef.current ?? pan;
    const raw = {
      x: base.x + (gestureState?.dx ?? 0),
      y: base.y + (gestureState?.dy ?? 0),
    };
    const dropped = clampPos(raw.x, raw.y);
    basePosRef.current = dropped; // commit first: survives interruptions
    pv.setValue(raw); // restart spring from finger-lift spot
    Animated.spring(pv, {
      toValue: dropped,
      useNativeDriver: false,
      friction: 7,
      tension: 40,
    }).start();
  };
  const panResponderRef = useRef(null);
  if (panResponderRef.current == null) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      // Capture drag movement before inner TouchableOpacity handles it
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState?.dx ?? 0) > 3 || Math.abs(gestureState?.dy ?? 0) > 3
        );
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return (
          Math.abs(gestureState?.dx ?? 0) > 3 || Math.abs(gestureState?.dy ?? 0) > 3
        );
      },

      onPanResponderGrant: () => {
        // Kill any in-flight edge-snap spring, then anchor the new drag at
        // the last COMMITTED drop point. No offsets, no listener values.
        const pv = panRef.current ?? pan;
        const base = basePosRef.current ?? DEFAULT_POS;
        pv.stopAnimation();
        pv.setValue({ x: base.x, y: base.y });
      },

      // Manual setValue (not Animated.event) so the drop point can be derived
      // from the same live gestureState deltas on release.
      onPanResponderMove: (_, gestureState) => {
        const pv = panRef.current ?? pan;
        const base = basePosRef.current ?? DEFAULT_POS;
        pv.setValue({
          x: base.x + (gestureState?.dx ?? 0),
          y: base.y + (gestureState?.dy ?? 0),
        });
      },

      onPanResponderRelease: (_, gestureState) => {
        settleDrag(gestureState);
      },

      onPanResponderTerminate: (_, gestureState) => {
        // OS interruption (e.g. incoming call gesture) — settle, don't snap back.
        settleDrag(gestureState);
      },

      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    });
  }
  const panResponder = panResponderRef.current;

  if (!roomId || !minimised) return null;

  const expand = () => {
    dispatch(setMinimised(false));
    router.push({ pathname: 'voiceRoom', params: { roomId } });
  };

  const leave = () => {
    dispatch(resetParty());
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      renderToHardwareTextureAndroid
      style={[
        styles.floatingContainer,
        {
          transform: pan.getTranslateTransform(),
        },
      ]}
    >
      <View style={styles.pillCard}>
        {/* Drag handle */}
        <View style={styles.dragGrip}>
          <Icon name="drag-vertical" size={16} color="rgba(255,255,255,0.5)" />
        </View>

        {/* Tap area to expand */}
        <TouchableOpacity style={styles.expandArea} onPress={expand} activeOpacity={0.8}>
          <Animated.View
            style={[
              styles.liveDot,
              { opacity: connected ? pulse : 0.4 },
              !connected && styles.liveDotOff,
            ]}
          />
          <View style={styles.textWrap}>
            <Text style={styles.roomText} numberOfLines={1}>
              {currentSong?.title || `Room #${roomId}`}
            </Text>
            <Text style={styles.subText} numberOfLines={1}>
              {participantCount} {participantCount === 1 ? 'peer' : 'peers'} · Live
            </Text>
          </View>
        </TouchableOpacity>

        {/* Quick controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            onPress={toggleMute}
            style={[styles.actionBtn, muted && styles.actionBtnDanger]}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Icon name={muted ? 'microphone-off' : 'microphone'} size={14} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={leave}
            style={[styles.actionBtn, styles.actionBtnClose]}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Icon name="close" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

export default memo(PartyMiniBar);

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    zIndex: 99998,
    elevation: 10,
  },
  pillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141020',
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: '#8A2387',
    paddingVertical: 5,
    paddingLeft: 4,
    paddingRight: 6,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    shadowColor: '#8A2387',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  dragGrip: {
    paddingHorizontal: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#00E5FF',
    marginRight: 6,
    marginLeft: 2,
  },
  liveDotOff: {
    backgroundColor: '#888888',
  },
  textWrap: {
    flex: 1,
  },
  roomText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  subText: {
    color: '#B0A8D0',
    fontSize: 9,
    fontWeight: '500',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnDanger: {
    backgroundColor: '#E94057',
  },
  actionBtnClose: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});

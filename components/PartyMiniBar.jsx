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

  // Position animated value
  const initialX = SCREEN_WIDTH - PILL_WIDTH - 16;
  const initialY = 110;
  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;
  const currentPos = useRef({ x: initialX, y: initialY });

  // Sync listener to guarantee exact coordinates without accessing private internals
  useEffect(() => {
    const id = pan.addListener((value) => {
      currentPos.current = value;
    });
    return () => {
      pan.removeListener(id);
    };
  }, [pan]);

  // Pulse animation for LIVE indicator
  const pulse = useRef(new Animated.Value(0.45)).current;
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

  // High-performance PanResponder with capture-phase drag negotiation
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      // Capture drag movement before inner TouchableOpacity handles it
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },

      onPanResponderGrant: () => {
        pan.stopAnimation();
        pan.setOffset({
          x: currentPos.current.x,
          y: currentPos.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },

      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),

      onPanResponderRelease: () => {
        pan.flattenOffset();
        const minX = 8;
        const maxX = SCREEN_WIDTH - PILL_WIDTH - 8;
        const minY = 50;
        const maxY = SCREEN_HEIGHT - 120;

        let curX = currentPos.current.x;
        let curY = currentPos.current.y;

        if (curX < minX) curX = minX;
        if (curX > maxX) curX = maxX;
        if (curY < minY) curY = minY;
        if (curY > maxY) curY = maxY;

        Animated.spring(pan, {
          toValue: { x: curX, y: curY },
          useNativeDriver: false,
          friction: 7,
          tension: 40,
        }).start();
      },

      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    })
  ).current;

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

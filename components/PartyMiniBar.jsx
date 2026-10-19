import React, { useEffect, useCallback, memo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { resetParty, setMinimised, setMuted } from '@/state/slices/party.slice';
import { socket } from '@/configs/socket';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const PILL_WIDTH = 200;
const PILL_HEIGHT = 44;

/**
 * Compact, movable floating pill shown while the voice room is minimised.
 * 100% UI-thread dragging via react-native-gesture-handler + react-native-reanimated:
 * runs at full 60/120fps regardless of JS thread load (e.g. heavy chat screens).
 */
function PartyMiniBar() {
  const dispatch = useDispatch();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Fine-grained selectors to prevent re-rendering on unneeded state changes
  const roomId = useSelector((s) => s.party.roomId);
  const minimised = useSelector((s) => s.party.minimised);
  const connected = useSelector((s) => s.party.connected);
  const songTitle = useSelector((s) =>
    s.party.currentIndex >= 0 ? s.party.queue[s.party.currentIndex]?.title : null
  );
  const participantCount = useSelector((s) => s.party.participants?.length ?? 0);
  const muted = useSelector((s) => s.party.muted);

  // Position shared values on UI thread
  const initialX = Math.max(8, screenWidth - PILL_WIDTH - 16);
  const initialY = 110;
  const translateX = useSharedValue(initialX);
  const translateY = useSharedValue(initialY);
  const startX = useSharedValue(initialX);
  const startY = useSharedValue(initialY);

  // Pulse animation for LIVE indicator - running 100% on the UI thread
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.45, { duration: 750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [pulse]);

  const liveDotAnimatedStyle = useAnimatedStyle(() => ({
    opacity: connected ? pulse.value : 0.4,
  }));

  // Re-clamp positions if screen dimensions change (e.g., orientation change)
  useEffect(() => {
    const minX = 8;
    const maxX = Math.max(8, screenWidth - PILL_WIDTH - 8);
    const minY = 50;
    const maxY = Math.max(50, screenHeight - 120);

    if (translateX.value > maxX || translateX.value < minX) {
      translateX.value = withSpring(Math.min(Math.max(translateX.value, minX), maxX));
    }
    if (translateY.value > maxY || translateY.value < minY) {
      translateY.value = withSpring(Math.min(Math.max(translateY.value, minY), maxY));
    }
  }, [screenWidth, screenHeight, translateX, translateY]);

  // UI-thread Pan gesture (worklets only: zero JS thread interaction during movement)
  const panGesture = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      'worklet';
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      translateX.value = startX.value + e.translationX;
      translateY.value = startY.value + e.translationY;
    })
    .onEnd((e) => {
      'worklet';
      const minX = 8;
      const maxX = Math.max(8, screenWidth - PILL_WIDTH - 8);
      const minY = 50;
      const maxY = Math.max(50, screenHeight - 120);

      // Project slightly with velocity for natural momentum feel, then clamp
      const targetRawX = translateX.value + e.velocityX * 0.05;
      const targetRawY = translateY.value + e.velocityY * 0.05;

      const clampedX = Math.min(Math.max(targetRawX, minX), maxX);
      const clampedY = Math.min(Math.max(targetRawY, minY), maxY);

      translateX.value = withSpring(clampedX, {
        damping: 18,
        stiffness: 160,
        mass: 0.8,
      });
      translateY.value = withSpring(clampedY, {
        damping: 18,
        stiffness: 160,
        mass: 0.8,
      });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const toggleMute = useCallback(() => {
    const next = !muted;
    dispatch(setMuted(next));
    if (roomId && socket?.connected) {
      try {
        socket.emit('party:reaction', {
          roomId,
          kind: 'presence',
          value: { muted: next },
        });
      } catch (e) {}
    }
  }, [dispatch, roomId, muted]);

  const expand = useCallback(() => {
    dispatch(setMinimised(false));
    router.push({ pathname: 'voiceRoom', params: { roomId } });
  }, [dispatch, roomId]);

  const leave = useCallback(() => {
    dispatch(resetParty());
  }, [dispatch]);

  if (!roomId || !minimised) return null;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.floatingContainer, animatedStyle]}>
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
                liveDotAnimatedStyle,
                !connected && styles.liveDotOff,
              ]}
            />
            <View style={styles.textWrap}>
              <Text style={styles.roomText} numberOfLines={1}>
                {songTitle || `Room #${roomId}`}
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
    </GestureDetector>
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

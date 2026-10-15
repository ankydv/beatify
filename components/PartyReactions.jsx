import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { socket } from '@/configs/socket';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const LIFETIME = 2200;
const MAX_BURSTS = 10;

function Burst({ emoji, x }) {
  const rise = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 5, tension: 120 }),
      Animated.timing(rise, { toValue: 1, duration: LIFETIME, useNativeDriver: true }),
    ]).start();
  }, [pop, rise]);

  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [0, -SCREEN_H * 0.45] });
  const opacity = rise.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Animated.Text
      style={[
        styles.emoji,
        { left: x, transform: [{ translateY }, { scale }], opacity },
      ]}
    >
      {emoji}
    </Animated.Text>
  );
}

/**
 * Floating reaction bursts — the visual payoff for `party:reaction`.
 * Purely decorative: `pointerEvents="none"` so it never blocks the UI.
 */
export default function PartyReactions() {
  const [bursts, setBursts] = useState([]);

  useEffect(() => {
    const onReaction = (p) => {
      if (!p || p.kind !== 'emoji' || !p.value) return;
      const id = `${p.from || 'x'}-${p.serverNowMs || Date.now()}-${Math.random()}`;
      const x = 30 + Math.random() * Math.max(40, SCREEN_W - 90);
      setBursts((prev) => [...prev.slice(-(MAX_BURSTS - 1)), { id, emoji: String(p.value), x }]);
      setTimeout(() => {
        setBursts((prev) => prev.filter((b) => b.id !== id));
      }, LIFETIME + 60);
    };
    socket.on('party:reaction', onReaction);
    return () => {
      socket.off('party:reaction', onReaction);
      setBursts([]);
    };
  }, []);

  if (!bursts.length) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {bursts.map((b) => (
        <Burst key={b.id} emoji={b.emoji} x={b.x} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  emoji: {
    position: 'absolute',
    bottom: SCREEN_H * 0.3,
    fontSize: 34,
    textAlign: 'center',
  },
});

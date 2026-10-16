import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { resetParty, setMinimised } from '@/state/slices/party.slice';
import { usePartyPresence } from '@/hooks/partyPresence.hooks';

/**
 * Floating "still in the party" pill shown while the room screen is minimised.
 * Tap anywhere on it to jump back into the room; the mic + leave controls work
 * without re-opening it, because the room runtime lives at the app root.
 *
 * NOTE: uses the imperative `router` API (not usePathname) so it can render
 * from the root layout without depending on navigator context. Visibility is
 * driven purely by `party.minimised`.
 */
export default function PartyMiniBar() {
  const dispatch = useDispatch();
  const party = useSelector((s) => s.party);
  const hasTrack = !!useSelector((s) => s.audio.currentTrack);
  const { muted, toggleMute } = usePartyPresence();

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

  if (!party.roomId || !party.minimised) return null;

  const current = party.currentIndex >= 0 ? party.queue[party.currentIndex] : null;
  const count = party.participants?.length ?? 0;

  const expand = () => {
    dispatch(setMinimised(false));
    router.push({ pathname: 'voiceRoom', params: { roomId: party.roomId } });
  };

  const leave = () => {
    dispatch(resetParty());
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: 78 }]}
    >
      <View style={styles.bar}>
        <TouchableOpacity style={styles.main} onPress={expand} activeOpacity={0.85}>
          <View style={styles.liveCol}>
            <Animated.View
              style={[
                styles.liveDot,
                { opacity: party.connected ? pulse : 0.4 },
                !party.connected && styles.liveDotOff,
              ]}
            />
            <Text style={[styles.liveText, !party.connected && styles.liveTextOff]}>
              {party.connected ? 'LIVE' : 'SYNC'}
            </Text>
          </View>
          <View style={styles.meta}>
            <Text style={styles.title} numberOfLines={1}>
              {current ? current.title : 'In the party'}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              Room {party.roomId} · {count} {count === 1 ? 'person' : 'people'}
              {current ? ` · ${current.artists}` : ''}
            </Text>
          </View>
          <Icon name="chevron-up" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleMute}
          style={[styles.round, muted && styles.roundDanger]}
          hitSlop={8}
        >
          <Icon name={muted ? 'microphone-off' : 'microphone'} size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={leave} style={[styles.round, styles.roundLeave]} hitSlop={8}>
          <Icon name="close" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 10, right: 10 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(22,16,38,0.97)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#6200ee',
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
    shadowColor: '#6200ee',
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveCol: { alignItems: 'center', width: 34 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff2d55' },
  liveDotOff: { backgroundColor: '#888' },
  liveText: { color: '#ff2d55', fontSize: 8, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },
  liveTextOff: { color: '#aaa' },
  meta: { flex: 1 },
  title: { color: '#fff', fontSize: 13, fontWeight: '700' },
  sub: { color: '#a99ce0', fontSize: 11, marginTop: 1 },
  round: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2c2140',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundDanger: { backgroundColor: '#c62828' },
  roundLeave: { backgroundColor: '#4a1420' },
});

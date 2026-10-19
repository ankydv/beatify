import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import TrackPlayer from 'react-native-track-player';
import { usePartyDj } from '@/hooks/partyDj.hooks';

const fmt = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${`${s % 60}`.padStart(2, '0')}`;
};

/** Cheap, crash-proof read of the shared player's head (never rejects).
 *  1s tick is plenty for a mm:ss label + % bar; halves re-renders vs 500ms. */
function usePlayhead() {
  const [head, setHead] = useState({ pos: 0, dur: 0 });
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const p = await TrackPlayer.getPosition();
        const d = await TrackPlayer.getDuration();
        if (!alive) return;
        const pos = Number.isFinite(p) ? p : 0;
        const dur = Number.isFinite(d) ? d : 0;
        setHead((prev) => {
          // Skip re-render when nothing visible changed (<1s / same second).
          if (Math.abs(prev.pos - pos) < 0.9 && prev.dur === dur) return prev;
          return { pos, dur };
        });
      } catch (e) {}
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return head;
}

/** Animated dancing equalizer visualizer bars for party ambiance.
 *  Uses scaleY (transform, UI-thread) instead of height (layout, JS-thread)
 *  so it never janks drags / scrolls while playing. */
function Equalizer({ playing }) {
  const h1 = useRef(new Animated.Value(0.35)).current;
  const h2 = useRef(new Animated.Value(0.7)).current;
  const h3 = useRef(new Animated.Value(0.5)).current;
  const h4 = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!playing) return;
    const createAnim = (val, min, max, duration) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: max, duration, useNativeDriver: true }),
          Animated.timing(val, { toValue: min, duration, useNativeDriver: true }),
        ])
      );
    const a1 = createAnim(h1, 0.25, 1, 300);
    const a2 = createAnim(h2, 0.35, 1, 220);
    const a3 = createAnim(h3, 0.25, 0.95, 260);
    const a4 = createAnim(h4, 0.3, 0.8, 340);
    a1.start();
    a2.start();
    a3.start();
    a4.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
      a4.stop();
    };
  }, [playing, h1, h2, h3, h4]);

  if (!playing) return null;

  return (
    <View style={styles.eqWrap}>
      <Animated.View style={[styles.eqBar, { transform: [{ scaleY: h1 }] }]} />
      <Animated.View style={[styles.eqBar, { transform: [{ scaleY: h2 }] }]} />
      <Animated.View style={[styles.eqBar, { transform: [{ scaleY: h3 }] }]} />
      <Animated.View style={[styles.eqBar, { transform: [{ scaleY: h4 }] }]} />
    </View>
  );
}

/**
 * Now-playing card: artwork + track + role badge + live progress + transport.
 * Fixed height so it can never push the participant strip out of the window.
 */
export default function PartyTransport({ roomId }) {
  // Fine-grained selectors: presence/chat/audio packets must NOT re-render
  // this whole card (was `useSelector(s => s.party)` + Playhead setState 2Hz).
  const current = useSelector((s) =>
    s.party.currentIndex >= 0 ? s.party.queue[s.party.currentIndex] : null
  );
  const queueFirst = useSelector((s) => s.party.queue[0]);
  const status = useSelector((s) => s.party.status);
  const anchorPosMs = useSelector((s) => s.party.anchorPosMs);
  const loadingQueueId = useSelector((s) => s.party.loadingQueueId);
  const dj = usePartyDj({ roomId });
  const { pos, dur } = usePlayhead();
  const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;
  const playing = status === 'playing';

  const resumeOrStart = () => {
    const cur = current || queueFirst;
    if (!cur) return;
    if (status === 'playing') {
      dj.pause();
    } else if (status === 'paused') {
      dj.play(cur.queueId, anchorPosMs != null ? anchorPosMs : 0);
    } else {
      dj.load(cur.queueId);
    }
  };

  return (
    <View style={[styles.card, playing && styles.cardPlaying]}>
      <View style={styles.topRow}>
        <View style={styles.artWrap}>
          {current?.thumb ? (
            <Image source={{ uri: current.thumb }} style={styles.art} />
          ) : (
            <View style={[styles.art, styles.artFallback]}>
              <Icon name="music" size={24} color="#6f6792" />
            </View>
          )}
          <View style={[styles.playingDot, !playing && styles.playingDotOff]} />
        </View>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {current ? current.title : 'Nothing playing yet'}
          </Text>
          <Text style={styles.artists} numberOfLines={1}>
            {current ? current.artists : 'DJ, drop the first track'}
          </Text>
          <View style={styles.badges}>
            <View style={[styles.badge, dj.isDj ? styles.badgeDj : styles.badgeListener]}>
              <Icon
                name={dj.isDj ? 'crown' : 'headphones'}
                size={10}
                color={dj.isDj ? '#141018' : '#c9b6ff'}
              />
              <Text style={[styles.badgeText, !dj.isDj && styles.badgeTextSoft]}>
                {dj.isDj ? 'You are the DJ' : 'Listening along'}
              </Text>
            </View>
            {loadingQueueId ? (
              <View style={[styles.badge, styles.badgeSync]}>
                <Text style={styles.badgeTextSync}>Syncing audio…</Text>
              </View>
            ) : null}
          </View>
        </View>

        {playing ? <Equalizer playing={playing} /> : null}
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{fmt(pos)}</Text>
          <Text style={styles.time}>{dur > 0 ? fmt(dur) : '--:--'}</Text>
        </View>
      </View>

      {dj.isDj ? (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.ctl} onPress={() => dj.prev()} hitSlop={8}>
            <Icon name="skip-previous" size={24} color="#cfc6f5" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={resumeOrStart} hitSlop={8}>
            <Icon name={playing ? 'pause' : 'play'} size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctl} onPress={() => dj.next()} hitSlop={8}>
            <Icon name="skip-next" size={24} color="#cfc6f5" />
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.hint}>Controlled by the DJ — sit back and enjoy 🎧</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 4,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#1a1330',
    borderWidth: 1,
    borderColor: '#2b2150',
    shadowColor: '#6200ee',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardPlaying: {
    borderColor: 'rgba(139, 92, 246, 0.55)',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  artWrap: { position: 'relative' },
  art: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#2a2340',
  },
  artFallback: { alignItems: 'center', justifyContent: 'center' },
  playingDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#1a1330',
  },
  playingDotOff: { backgroundColor: '#666' },
  info: { flex: 1, minWidth: 0 },
  title: { color: '#fff', fontSize: 14, fontWeight: '700' },
  artists: { color: '#a99ce0', fontSize: 11, marginTop: 1 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 5, flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeDj: { backgroundColor: '#ffca28' },
  badgeListener: { backgroundColor: '#2c2140' },
  badgeSync: { backgroundColor: 'rgba(255,202,40,0.15)' },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#141018' },
  badgeTextSoft: { color: '#c9b6ff' },
  badgeTextSync: { fontSize: 9, fontWeight: '700', color: '#ffca28' },

  /* Equalizer visualizer — fixed height; bars scale from the bottom via scaleY */
  eqWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2.5,
    height: 20,
    paddingHorizontal: 4,
  },
  eqBar: {
    width: 3,
    height: 20,
    backgroundColor: '#a78bfa',
    borderRadius: 1.5,
  },

  progressWrap: { marginTop: 10 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: '#8b5cf6' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  time: { color: '#7d74a3', fontSize: 10, fontVariant: ['tabular-nums'] },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
  },
  ctl: { padding: 4 },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6200ee',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6200ee',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  hint: {
    color: '#7d74a3',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

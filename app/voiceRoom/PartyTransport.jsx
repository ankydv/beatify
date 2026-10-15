import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import TrackPlayer from 'react-native-track-player';
import { usePartyDj } from '@/hooks/partyDj.hooks';

const fmt = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${`${s % 60}`.padStart(2, '0')}`;
};

/** Cheap, crash-proof read of the shared player's head (never rejects). */
function usePlayhead() {
  const [head, setHead] = useState({ pos: 0, dur: 0 });
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const p = await TrackPlayer.getPosition();
        const d = await TrackPlayer.getDuration();
        if (!alive) return;
        setHead({
          pos: Number.isFinite(p) ? p : 0,
          dur: Number.isFinite(d) ? d : 0,
        });
      } catch (e) {}
    };
    tick();
    const id = setInterval(tick, 500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return head;
}

/**
 * Now-playing card: artwork + track + role badge + live progress + transport.
 * Fixed height so it can never push the participant strip out of the window.
 */
export default function PartyTransport({ roomId }) {
  const party = useSelector((s) => s.party);
  const dj = usePartyDj({ roomId });
  const current = party.currentIndex >= 0 ? party.queue[party.currentIndex] : null;
  const { pos, dur } = usePlayhead();
  const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;
  const playing = party.status === 'playing';

  const resumeOrStart = () => {
    const cur = current || party.queue[0];
    if (!cur) return;
    if (party.status === 'playing') {
      dj.pause();
    } else if (party.status === 'paused') {
      dj.play(cur.queueId, party.anchorPosMs != null ? party.anchorPosMs : 0);
    } else {
      dj.load(cur.queueId);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.artWrap}>
        {current?.thumb ? (
          <Image source={{ uri: current.thumb }} style={styles.art} />
        ) : (
          <View style={[styles.art, styles.artFallback]}>
            <Icon name="music" size={26} color="#6f6792" />
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
          {party.loadingQueueId ? (
            <View style={[styles.badge, styles.badgeSync]}>
              <Text style={styles.badgeTextSync}>Syncing audio…</Text>
            </View>
          ) : null}
        </View>
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
            <Icon name="skip-previous" size={26} color="#cfc6f5" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={resumeOrStart} hitSlop={8}>
            <Icon name={playing ? 'pause' : 'play'} size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctl} onPress={() => dj.next()} hitSlop={8}>
            <Icon name="skip-next" size={26} color="#cfc6f5" />
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
  artWrap: { position: 'relative' },
  art: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#2a2340',
  },
  artFallback: { alignItems: 'center', justifyContent: 'center' },
  playingDot: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1db954',
    borderWidth: 2,
    borderColor: '#1a1330',
  },
  playingDotOff: { backgroundColor: '#666' },
  info: { flex: 1 },
  title: { color: '#fff', fontSize: 15, fontWeight: '700' },
  artists: { color: '#a99ce0', fontSize: 12, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 7, flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeDj: { backgroundColor: '#ffca28' },
  badgeListener: { backgroundColor: '#2c2140' },
  badgeSync: { backgroundColor: 'rgba(255,202,40,0.15)' },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#141018' },
  badgeTextSoft: { color: '#c9b6ff' },
  badgeTextSync: { fontSize: 10, fontWeight: '700', color: '#ffca28' },
  progressWrap: { marginTop: 12 },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: '#8b5cf6' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  time: { color: '#7d74a3', fontSize: 10, fontVariant: ['tabular-nums'] },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    marginTop: 10,
  },
  ctl: { padding: 6 },
  playBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#6200ee',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6200ee',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  hint: {
    color: '#7d74a3',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
});

/* The card lays out as: [art][info] row, then progress, then controls. */
const rowBase = { flexDirection: 'row', alignItems: 'center' };
styles.art = [styles.art];
styles.info = [styles.info, { position: 'absolute', left: 66, right: 0, top: 0 }];

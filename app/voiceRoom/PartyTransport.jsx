import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { usePartyDj } from '@/hooks/partyDj.hooks';

export default function PartyTransport({ roomId }) {
  const party = useSelector((s) => s.party);
  const dj = usePartyDj({ roomId });
  const current = party.currentIndex >= 0 ? party.queue[party.currentIndex] : null;

  const resumeOrStart = () => {
    const cur = current || party.queue[0];
    if (!cur) return;
    if (party.status === 'paused') dj.play(cur.queueId, party.anchorPosMs || 0);
    else dj.load(cur.queueId);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.nowRow}>
        <Icon name="disc" size={18} color={party.status === 'playing' ? '#4caf50' : '#888'} />
        <Text style={styles.nowText} numberOfLines={1}>
          {current ? `${current.title} — ${current.artists}` : 'Nothing playing yet'}
        </Text>
        <Text style={styles.roleBadge}>{dj.isDj ? 'DJ' : 'Listener'}</Text>
      </View>
      {dj.isDj && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.ctl} onPress={() => dj.prev()} hitSlop={8}>
            <Icon name="skip-previous" size={26} color="#fff" />
          </TouchableOpacity>
          {party.status === 'playing' ? (
            <TouchableOpacity style={[styles.ctl, styles.playBtn]} onPress={() => dj.pause()} hitSlop={8}>
              <Icon name="pause" size={26} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.ctl, styles.playBtn]} onPress={resumeOrStart} hitSlop={8}>
              <Icon name="play" size={26} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.ctl} onPress={() => dj.next()} hitSlop={8}>
            <Icon name="skip-next" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      {party.loadingQueueId ? <Text style={styles.sync}>Syncing audio…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  nowText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  roleBadge: { color: '#bb86fc', fontSize: 11, fontWeight: '700', backgroundColor: '#2c2140', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 4 },
  ctl: { padding: 8 },
  playBtn: { backgroundColor: '#6200ee', borderRadius: 24, paddingHorizontal: 12 },
  sync: { color: '#ffca28', fontSize: 11, textAlign: 'center' },
});

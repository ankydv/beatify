import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { usePartyDj } from '@/hooks/partyDj.hooks';

export default function PartyQueue({ roomId }) {
  const party = useSelector((s) => s.party);
  const dj = usePartyDj({ roomId });
  if (!party.queue.length) return <Text style={styles.empty}>Queue is empty — DJ, add the first track.</Text>;
  return (
    <View>
      {party.queue.map((q, i) => {
        const active = i === party.currentIndex;
        return (
          <View key={q.queueId} style={[styles.row, active && styles.rowActive]}>
            <Text style={styles.idx}>{i + 1}</Text>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, active && styles.rowTitleActive]} numberOfLines={1}>{q.title}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>{q.artists}</Text>
            </View>
            {dj.isDj && !active && (
              <View style={styles.qActions}>
                <TouchableOpacity onPress={() => dj.load(q.queueId)} hitSlop={6}>
                  <Icon name="play-circle-outline" size={22} color="#4caf50" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => dj.queueRemove(q.queueId)} hitSlop={6}>
                  <Icon name="close" size={20} color="#888" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 8 },
  rowActive: { backgroundColor: '#241d33', borderRadius: 8, paddingHorizontal: 6 },
  idx: { color: '#666', fontSize: 12, width: 20 },
  rowText: { flex: 1 },
  rowTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },
  rowTitleActive: { color: '#bb86fc' },
  rowSub: { color: '#888', fontSize: 11 },
  qActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  empty: { color: '#666', fontSize: 12, textAlign: 'center', paddingVertical: 10 },
});

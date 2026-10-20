import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { usePartyDj } from '@/hooks/partyDj.hooks';

export default function RequestInbox({ roomId }) {
  const party = useSelector((s) => s.party);
  const dj = usePartyDj({ roomId });
  const list = [...(party.pendingRequests || [])].reverse();
  if (!list.length) return <Text style={styles.empty}>No requests yet.</Text>;
  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={list}
      keyExtractor={(r) => String(r.requestId)}
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={false}
      renderItem={({ item: r }) => (
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={1}>{r.title}</Text>
            <Text style={styles.rowSub} numberOfLines={1}>
              {r.artists} • by {r.requestedByName} • {r.status}
            </Text>
          </View>
          {dj.isDj && r.status === 'pending' && (
            <View style={styles.qActions}>
              <TouchableOpacity onPress={() => dj.approve(r.requestId)} hitSlop={6}>
                <Icon name="check" size={22} color="#4caf50" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => dj.rejectReq(r.requestId)} hitSlop={6}>
                <Icon name="close" size={22} color="#f44" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, minHeight: 0 },
  listContent: { paddingHorizontal: 10, paddingVertical: 6, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 8 },
  rowText: { flex: 1 },
  rowTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },
  rowSub: { color: '#888', fontSize: 11 },
  qActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  empty: { color: '#666', fontSize: 12, textAlign: 'center', paddingVertical: 10 },
});

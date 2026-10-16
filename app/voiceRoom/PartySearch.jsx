import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import { usePartyDj } from '@/hooks/partyDj.hooks';

const API_URL = process.env.EXPO_PUBLIC_API_URL2;

export default function PartySearch({ roomId }) {
  const dj = usePartyDj({ roomId });
  const party = useSelector((s) => s.party);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(null);
  const [addError, setAddError] = useState(null);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await axios.get(`${API_URL}/api/search/${encodeURIComponent(q)}`);
      const flat = [];
      for (const item of res.data || []) {
        if (item?.category === 'Profiles') continue;
        if (Array.isArray(item?.data)) {
          for (const s of item.data) {
            if (s?.videoId) flat.push(s);
            if (flat.length >= 20) break;
          }
        } else if (item?.videoId) flat.push(item);
        if (flat.length >= 20) break;
      }
      setResults(flat);
    } catch (e) {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const resolveAddedQueueId = async (res, song) => {
    if (res?.queueId) return res.queueId;
    if (res?.item?.queueId) return res.item.queueId;
    if (res?.track?.queueId) return res.track.queueId;
    if (Array.isArray(res?.queue) && res.queue.length > 0) {
      const match = res.queue.find((q) => q.videoId === song.videoId) || res.queue[0];
      if (match?.queueId) return match.queueId;
    }
    // Poll Redux store briefly in case server pushed dj:queue-updated with queue items
    try {
      const { store } = await import('@/state/store');
      for (let attempt = 0; attempt < 12; attempt++) {
        const currentQueue = store.getState()?.party?.queue;
        if (Array.isArray(currentQueue) && currentQueue.length > 0) {
          const match = currentQueue.find((item) => item.videoId === song.videoId) || currentQueue[0];
          if (match?.queueId) return match.queueId;
        }
        await new Promise((r) => setTimeout(r, 60));
      }
    } catch (_) {}
    return null;
  };

  const onTap = async (song) => {
    setBusy(song.videoId);
    setAddError(null);
    try {
      const wasEmpty =
        !party.queue ||
        party.queue.length === 0 ||
        (party.status === 'idle' && party.currentIndex === -1);

      if (dj.isDj) {
        const res = await dj.queueAdd(song);
        if (wasEmpty) {
          const queueId = await resolveAddedQueueId(res, song);
          if (queueId) {
            await dj.load(queueId);
          }
        }
      } else {
        await dj.requestSong(song);
      }
    } catch (e) {
      // queueAdd/requestSong already put the message in party.error via
      // fail(); mirror it locally so it's visible next to the tapped row.
      setAddError(e?.message || 'Could not add this song');
    }
    setBusy(null);
  };

  return (
    <ScrollView>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search songs…"
          placeholderTextColor="#777"
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <TouchableOpacity style={styles.goBtn} onPress={search}>
          {searching ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="magnify" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
      {results.map((item, i) => {
        const title = item.title || item.name || item.videoId;
        const sub = Array.isArray(item.artists) ? item.artists.map((a) => a?.name).join(', ') : item.artists || '';
        return (
          <View key={(item.videoId || '') + i} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>
            </View>
            {busy === item.videoId ? (
              <ActivityIndicator size="small" color="#bb86fc" />
            ) : dj.isDj ? (
              <TouchableOpacity style={styles.addBtn} onPress={() => onTap(item)}>
                <Icon name="plus" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.reqBtn} onPress={() => onTap(item)}>
                <Text style={styles.reqText}>Request</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
      {!searching && !results.length ? <Text style={styles.empty}>Search to add or request songs</Text> : null}
      {addError ? <Text style={styles.err}>{addError}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { flex: 1, backgroundColor: '#2c2c2c', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, color: '#fff', fontSize: 13 },
  goBtn: { backgroundColor: '#6200ee', width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 8 },
  rowText: { flex: 1 },
  rowTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },
  rowSub: { color: '#888', fontSize: 11 },
  addBtn: { backgroundColor: '#6200ee', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  reqBtn: { backgroundColor: '#2c2c2c', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  reqText: { color: '#bb86fc', fontSize: 12, fontWeight: '700' },
  empty: { color: '#666', fontSize: 12, textAlign: 'center', paddingVertical: 10 },
  err: { color: '#f44', fontSize: 11, marginTop: 6 },
});

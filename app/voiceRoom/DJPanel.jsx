import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import PartyTransport from './PartyTransport';
import PartyQueue from './PartyQueue';
import RequestInbox from './RequestInbox';
import PartySearch from './PartySearch';

export default function DJPanel({ roomId }) {
  const party = useSelector((s) => s.party);
  const [tab, setTab] = useState('queue');
  const pending = (party.pendingRequests || []).filter((r) => r.status === 'pending');

  return (
    <View style={styles.wrap}>
      <PartyTransport roomId={roomId} />
      <View style={styles.tabs}>
        <Tab label="Queue" active={tab === 'queue'} onPress={() => setTab('queue')} />
        <Tab label={`Requests${pending.length ? ` (${pending.length})` : ''}`} active={tab === 'requests'} onPress={() => setTab('requests')} />
        <Tab label="Search" active={tab === 'search'} onPress={() => setTab('search')} />
      </View>
      {tab === 'queue' && <PartyQueue roomId={roomId} />}
      {tab === 'requests' && <RequestInbox roomId={roomId} />}
      {tab === 'search' && <PartySearch roomId={roomId} />}
      {party.error ? <Text style={styles.err}>{party.error}</Text> : null}
    </View>
  );
}

function Tab({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tab, active && styles.tabOn]}>
      <Text style={[styles.tabText, active && styles.tabTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  tabs: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#2c2c2c' },
  tabOn: { backgroundColor: '#6200ee' },
  tabText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  tabTextOn: { color: '#fff' },
  err: { color: '#f44', fontSize: 11, marginTop: 6 },
});

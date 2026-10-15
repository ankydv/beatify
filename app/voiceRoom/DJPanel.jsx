import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSelector } from 'react-redux';
import PartyQueue from './PartyQueue';
import RequestInbox from './RequestInbox';
import PartySearch from './PartySearch';
import ChatComponent from './chat';

/**
 * The room STAGE — the only flexible region in the room screen.
 *
 * Chat / Queue / Requests / Search share one bounded, scrollable pane, so a
 * huge queue or a huge chat can never grow the layout and push the participant
 * strip (or anything else) off the screen. Chat leads because this is a social
 * room first; the DJ tooling sits right next to it.
 */
export default function DJPanel({ roomId }) {
  const party = useSelector((s) => s.party);
  const [tab, setTab] = useState('chat');
  const pending = (party.pendingRequests || []).filter((r) => r.status === 'pending').length;

  const tabs = [
    { key: 'chat', label: 'Chat' },
    { key: 'queue', label: party.queue.length ? `Queue ${party.queue.length}` : 'Queue' },
    { key: 'requests', label: pending ? `Requests ${pending}` : 'Requests' },
    { key: 'search', label: 'Add music' },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.tabsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}
        >
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, tab === t.key && styles.tabOn]}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.body}>
        {tab === 'chat' ? <ChatComponent roomId={roomId} /> : null}
        {tab === 'queue' ? <PartyQueue roomId={roomId} /> : null}
        {tab === 'requests' ? <RequestInbox roomId={roomId} /> : null}
        {tab === 'search' ? <PartySearch roomId={roomId} /> : null}
      </View>

      {party.error ? <Text style={styles.err}>{party.error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#151022',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#271f3d',
    overflow: 'hidden',
  },
  tabsBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#271f3d',
    backgroundColor: '#191230',
  },
  tabsScroll: { paddingHorizontal: 8, paddingVertical: 8, gap: 6 },
  tab: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 6,
  },
  tabOn: { backgroundColor: '#6200ee' },
  tabText: { color: '#9d94c4', fontSize: 12, fontWeight: '700' },
  tabTextOn: { color: '#fff' },
  body: { flex: 1, minHeight: 0 },
  err: {
    color: '#ff7675',
    fontSize: 11,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,80,80,0.08)',
  },
});

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
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
    { key: 'chat', label: 'Chat', icon: 'chat-processing-outline' },
    {
      key: 'queue',
      label: 'Queue',
      count: party.queue.length || null,
      icon: 'playlist-music-outline',
    },
    {
      key: 'requests',
      label: 'Requests',
      count: pending || null,
      icon: 'bell-badge-outline',
    },
    { key: 'search', label: 'Add music', icon: 'music-box-multiple-outline' },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.tabsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}
        >
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tab, active && styles.tabOn]}
                activeOpacity={0.8}
              >
                <Icon
                  name={t.icon}
                  size={14}
                  color={active ? '#fff' : '#8f86b3'}
                  style={styles.tabIcon}
                />
                <Text style={[styles.tabText, active && styles.tabTextOn]}>{t.label}</Text>
                {t.count != null ? (
                  <View style={[styles.badge, active && styles.badgeOn]}>
                    <Text style={[styles.badgeText, active && styles.badgeTextOn]}>{t.count}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
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
    backgroundColor: '#140e24',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#261c3d',
    overflow: 'hidden',
  },
  tabsBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#261c3d',
    backgroundColor: '#18112c',
  },
  tabsScroll: { paddingHorizontal: 8, paddingVertical: 6, gap: 5 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginRight: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabOn: {
    backgroundColor: '#7c3aed',
    borderColor: 'rgba(167, 139, 250, 0.4)',
    shadowColor: '#7c3aed',
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  tabIcon: { marginRight: 4 },
  tabText: { color: '#8f86b3', fontSize: 11.5, fontWeight: '700' },
  tabTextOn: { color: '#fff' },
  badge: {
    marginLeft: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  badgeOn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  badgeText: { color: '#a78bfa', fontSize: 10, fontWeight: '800' },
  badgeTextOn: { color: '#fff' },
  body: { flex: 1, minHeight: 0 },
  err: {
    color: '#ff7675',
    fontSize: 11,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,80,80,0.08)',
  },
});

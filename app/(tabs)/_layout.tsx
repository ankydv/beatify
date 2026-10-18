import React, { useState, useEffect, type ComponentProps } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { AntDesign, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import PlayerBar from '@/components/playerBar'
import { useSelector } from 'react-redux';
import { useTheme } from 'react-native-paper';
import { getUnreadCounts, subscribeToChatUpdates, subscribeToActiveChat, getActiveChatId } from '@/services/chatStorage.service';

function TabBarIcon(props: {
  name: ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const { currentTrack } = useSelector((state: any) => state.audio);
  const partyRoomId = useSelector((state: any) => state.party?.roomId);
  const { colors } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatConversationOpen, setIsChatConversationOpen] = useState(Boolean(getActiveChatId()));

  // Robust visibility check:
  // Show PlayerBar and its corresponding bottom padding ONLY when:
  // 1. Audio track is loaded
  // 2. Chat full-screen conversation is not open
  // 3. Not in a party/voice room (voice room floating capsule controls audio instead)
  const isPlayerBarVisible = Boolean(currentTrack && !isChatConversationOpen && !partyRoomId);

  useEffect(() => {
    let alive = true;
    const sync = async () => {
      const counts = await getUnreadCounts();
      if (alive) setUnreadCount(counts.total || 0);
    };
    sync();
    const unsub = subscribeToChatUpdates(sync);
    const unsubActive = subscribeToActiveChat((id) => {
      if (alive) setIsChatConversationOpen(Boolean(id));
    });
    return () => {
      alive = false;
      unsub();
      unsubActive();
    };
  }, []);

  return (
    <>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerShown: useClientOnlyValue(false, true),
        tabBarStyle: isChatConversationOpen
          ? { display: 'none', height: 0 }
          : {
              height: 70,
              marginTop: isPlayerBarVisible ? 5 : 0,
            },
        tabBarItemStyle: {
          paddingVertical: 10,
        },
      }}>
      <Tabs.Screen
        name="homeRoutes"
        options={{
          title: 'home',
          tabBarIcon: ({ color }) => <AntDesign name="home" color={color} size={24} />,
          tabBarShowLabel: false,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <AntDesign name="search1" color={color} size={24} />,
          tabBarShowLabel: false,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="party/index"
        options={{
          title: 'party',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="party-popper" size={24} color={color} />,
          tabBarShowLabel: false,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="chat" size={24} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarShowLabel: false,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color }) => <MaterialIcons name="library-music" color={color} size={24} />,
          tabBarShowLabel: false,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,  // This prevents the index route from appearing as a tab
        }}
      />
    </Tabs>
    {isPlayerBarVisible && <PlayerBar />}
    </>
  );
}

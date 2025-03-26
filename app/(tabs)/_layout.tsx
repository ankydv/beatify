import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { AntDesign, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import PlayerBar from '@/components/playerBar'
import { useSelector } from 'react-redux';
import { useTheme } from 'react-native-paper';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const { currentTrack } = useSelector((state: any) => state.audio);
  const { colors } = useTheme();

  return (
    <>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerShown: useClientOnlyValue(false, true),
        tabBarStyle: {
          height: 70,
          marginTop: currentTrack ? 50 : 0,
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
    {currentTrack && <PlayerBar />}
    </>
  );
}

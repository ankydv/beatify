import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import PlayerBar from '@/components/playerBar'
import { useSelector } from 'react-redux';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { currentTrack } = useSelector((state: any) => state.audio);

  return (
    <>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: useClientOnlyValue(false, true),
        tabBarStyle: {
          height: 70,
        },
      }}
      sceneContainerStyle={{marginBottom: currentTrack ? 60 : 0}}>
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

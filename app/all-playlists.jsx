import { useCallback } from "react";
import { FlatList, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useFocusEffect } from "expo-router";
import PlaylistRow from "@/components/UserPlaylistRow";
import { useUserPlaylists, usePlaylistNavigation } from "./library/playlists";

// Dedicated full-list route: the Library tab only shows a fixed preview of 5.
// This screen owns its own scroll + virtualization, so hundreds of playlists
// render only visible windows (initialNumToRender / windowSize) instead of
// mounting everything inside the tab's ScrollView (the old freeze).
const AllPlaylists = () => {
  const { playlists, isLoading, deletingId, fetchPlaylists, doDeletePlaylist } = useUserPlaylists();
  const { openPlaylist, confirmDeletePlaylist } = usePlaylistNavigation();

  // Single source of truth for fetching: useFocusEffect covers mount too,
  // so no separate useEffect (avoids the mount double-fetch).
  useFocusEffect(
    useCallback(() => {
      fetchPlaylists();
    }, [fetchPlaylists])
  );

  const openMenuFor = useCallback(
    (playlist) => confirmDeletePlaylist(playlist, doDeletePlaylist),
    [confirmDeletePlaylist, doDeletePlaylist]
  );

  const renderItem = useCallback(
    ({ item }) => (
      <PlaylistRow
        item={item}
        isDeleting={deletingId === item.id}
        onPress={openPlaylist}
        onMenuPress={openMenuFor}
      />
    ),
    [deletingId, openPlaylist, openMenuFor]
  );

  const keyFor = useCallback(
    (item, index) => item?.id ?? `${item?.name || 'playlist'}_${index}`,
    []
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: true, title: "All Playlists" }} />
      <View style={{ flex: 1, padding: 12 }}>
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" />
          </View>
        ) : playlists.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text variant="bodyLarge">No playlists yet</Text>
          </View>
        ) : (
          <FlatList
            data={playlists}
            renderItem={renderItem}
            keyExtractor={keyFor}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default AllPlaylists;

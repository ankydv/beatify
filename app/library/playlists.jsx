import { memo, useCallback, useEffect, useRef, useState } from "react";
import { View, Alert, ToastAndroid, Platform } from "react-native";
import { IconButton, Surface, Text, Divider, TouchableRipple, ActivityIndicator } from "react-native-paper";
import { usePlaylistApi } from "../../hooks/library.hooks/playlist.hooks";
import { useRouter, useFocusEffect } from "expo-router";

// Memo'd row: parent state (menu selection, deletion) must NOT re-render
// every row. Receives only primitives + stable callbacks.
const PlaylistRow = memo(function PlaylistRow({ item, isDeleting, onPress, onMenuPress }) {
  return (
    <Surface
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        paddingVertical: 16,
        marginBottom: 8,
        borderRadius: 12,
        elevation: 1,
        opacity: isDeleting ? 0.5 : 1,
      }}
    >
      <TouchableRipple style={{ flex: 1 }} onPress={() => onPress(item.id)}>
        <View>
          <Text variant="titleMedium">{item.name}</Text>
          <Text variant="bodyMedium" style={{ color: "#888" }}>
            {item.songCount} songs
          </Text>
        </View>
      </TouchableRipple>

      {isDeleting ? (
        <ActivityIndicator size="small" style={{ margin: 8 }} />
      ) : (
        <IconButton
          icon="dots-vertical"
          size={24}
          onPress={() => onMenuPress(item)}
          style={{ margin: 0 }}
        />
      )}
    </Surface>
  );
});

const keyFor = (item, index) => item?.id ?? `${item?.name || 'playlist'}_${index}`;

const Playlists = () => {
  const [playlists, setPlaylists] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const { getPlaylists, deletePlaylist } = usePlaylistApi();
  const router = useRouter();
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const deletingRef = useRef(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchPlaylists = useCallback(async () => {
    // In-flight guard: useFocusEffect + useEffect both fire on mount —
    // without this we double-fetch and double-setState every visit.
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const data = await getPlaylists();
      if (mountedRef.current) setPlaylists(data.playlists ?? []);
    } catch (error) {
      console.error("Error fetching playlists:", error);
    } finally {
      fetchingRef.current = false;
    }
  }, [getPlaylists]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  // Re-sync after returning from playlist page (e.g. deleted there).
  useFocusEffect(
    useCallback(() => {
      fetchPlaylists();
    }, [fetchPlaylists])
  );

  const notify = (msg) => {
    if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
    else Alert.alert('Beatify', msg);
  };

  const handlePress = useCallback((playlistId) => {
    router.push({
      pathname: "/playlist",
      params: { id: playlistId, isPlaylist: true, isUserPlaylist: true },
    });
  }, [router]);

  const doDeletePlaylist = useCallback(async (playlist) => {
    const id = playlist?.id;
    if (!id || deletingRef.current.has(id)) return;
    deletingRef.current.add(id);
    if (mountedRef.current) {
      setDeletingId(id);
      // Optimistic removal — instant UI, rollback on failure.
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
    }
    try {
      await deletePlaylist(id);
      notify(`Deleted "${playlist.name}"`);
    } catch (e) {
      // Rollback on failure.
      if (mountedRef.current) setPlaylists((prev) => [...prev, playlist]);
      notify(e?.message || 'Could not delete playlist');
    } finally {
      deletingRef.current.delete(id);
      if (mountedRef.current) setDeletingId((cur) => (cur === id ? null : cur));
    }
  }, [deletePlaylist]);

  const openMenuFor = useCallback((playlist) => {
    // One ActionSheet-style Alert per tap — no per-row Menu mounted,
    // so N rows cost zero hidden modal trees (the old freeze).
    Alert.alert(
      playlist?.name ?? 'Playlist',
      'What do you want to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete playlist',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete playlist?',
              `"${playlist?.name}" will be permanently deleted. Songs stay in your library.`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => doDeletePlaylist(playlist) },
              ],
              { cancelable: true }
            );
          },
        },
      ],
      { cancelable: true }
    );
  }, [doDeletePlaylist]);

  const renderPlaylistItem = useCallback(({ item }) => (
    <PlaylistRow
      item={item}
      isDeleting={deletingId === item.id}
      onPress={handlePress}
      onMenuPress={openMenuFor}
    />
  ), [deletingId, handlePress, openMenuFor]);

  return (
    <View>
      <Text variant="titleLarge" style={{marginTop: 20}} >My Playlists</Text>
      <View style={{ marginTop: 8 }}>
        {/* Plain .map: FlatList with scrollEnabled={false} inside the tab's
            ScrollView still mounts a full VirtualizedList (nested
            virtualization warning + cell overhead); for a small owned list
            a direct map is cheaper. Division of labour: big song lists keep
            FlatList, small owned lists use map. */}
        {playlists.map((item, index) => (
          <View key={keyFor(item, index)}>
            {renderPlaylistItem({ item })}
            {index < playlists.length - 1 && <Divider />}
          </View>
        ))}
      </View>
    </View>
  );
};
export default Playlists;

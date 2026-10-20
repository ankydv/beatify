import { useCallback, useEffect, useRef, useState } from "react";
import { View, Alert, ToastAndroid, Platform } from "react-native";
import { Text, Button } from "react-native-paper";
import { usePlaylistApi } from "../../hooks/library.hooks/playlist.hooks";
import { useRouter, useFocusEffect } from "expo-router";
import PlaylistRow from "@/components/UserPlaylistRow";

// Fixed preview size on the Library tab. The full collection lives on the
// dedicated "all-playlists" route (own FlatList + virtualization) so the tab
// never mounts an unbounded list inside its ScrollView.
export const PLAYLIST_PREVIEW_COUNT = 5;

const keyFor = (item, index) => item?.id ?? `${item?.name || 'playlist'}_${index}`;

export const useUserPlaylists = () => {
  const [playlists, setPlaylists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const { getPlaylists, deletePlaylist } = usePlaylistApi();
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const deletingRef = useRef(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchPlaylists = useCallback(async () => {
    // In-flight guard: useFocusEffect + useEffect both fire on mount.
    if (fetchingRef.current) return null;
    fetchingRef.current = true;
    try {
      const data = await getPlaylists();
      const list = data.playlists ?? [];
      if (mountedRef.current) setPlaylists(list);
      return list;
    } catch (error) {
      console.error("Error fetching playlists:", error);
      return null;
    } finally {
      if (mountedRef.current) setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [getPlaylists]);

  const notify = useCallback((msg) => {
    if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
    else Alert.alert('Beatify', msg);
  }, []);

  const doDeletePlaylist = useCallback(async (playlist) => {
    const id = playlist?.id;
    if (!id || deletingRef.current.has(id)) return false;
    deletingRef.current.add(id);
    if (mountedRef.current) {
      setDeletingId(id);
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
    }
    try {
      await deletePlaylist(id);
      notify(`Deleted "${playlist.name}"`);
      return true;
    } catch (e) {
      if (mountedRef.current) setPlaylists((prev) => [...prev, playlist]);
      notify(e?.message || 'Could not delete playlist');
      return false;
    } finally {
      deletingRef.current.delete(id);
      if (mountedRef.current) setDeletingId((cur) => (cur === id ? null : cur));
    }
  }, [deletePlaylist, notify]);

  return { playlists, isLoading, deletingId, fetchPlaylists, doDeletePlaylist };
};

export const usePlaylistNavigation = () => {
  const router = useRouter();

  const openPlaylist = useCallback((playlistId) => {
    router.push({
      pathname: "/playlist",
      params: { id: playlistId, isPlaylist: true, isUserPlaylist: true },
    });
  }, [router]);

  const openAllPlaylists = useCallback(() => {
    router.push("/all-playlists");
  }, [router]);

  const confirmDeletePlaylist = useCallback((playlist, doDelete) => {
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
              `"${playlist?.name}" will be deleted. Songs stay in library.`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => doDelete(playlist) },
              ],
              { cancelable: true }
            );
          },
        },
      ],
      { cancelable: true }
    );
  }, []);

  return { openPlaylist, openAllPlaylists, confirmDeletePlaylist };
};

const Playlists = () => {
  const { playlists, deletingId, fetchPlaylists, doDeletePlaylist } = useUserPlaylists();
  const { openPlaylist, openAllPlaylists, confirmDeletePlaylist } = usePlaylistNavigation();

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
  return (
    <View>
      <View style={{ marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="titleLarge">My Playlists</Text>
        {playlists.length > PLAYLIST_PREVIEW_COUNT && (
          <Button mode="text" compact onPress={openAllPlaylists}>
            View All ({playlists.length})
          </Button>
        )}
      </View>
      <View style={{ marginTop: 8 }}>
        {playlists.slice(0, PLAYLIST_PREVIEW_COUNT).map((item, index) => (
          <PlaylistRow
            key={keyFor(item, index)}
            item={item}
            isDeleting={deletingId === item.id}
            onPress={openPlaylist}
            onMenuPress={openMenuFor}
          />
        ))}
      </View>
    </View>
  );
};
export default Playlists;

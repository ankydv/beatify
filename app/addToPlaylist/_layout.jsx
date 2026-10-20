import { useState, useEffect, useMemo } from "react";
import { View, FlatList, ToastAndroid, Alert, Platform } from "react-native";
import {
  Text,
  Button,
  Surface,
  TextInput,
  Divider,
  Checkbox,
  useTheme,
} from "react-native-paper";
import {usePlaylistApi} from "../../hooks/library.hooks/playlist.hooks"; // import your playlist hooks here
import { useRoute } from "@react-navigation/native";
import { router } from "expo-router";

export default function AddToPlaylistScreen() {
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState([]);
  const [belongedPlaylists, setBelongedPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const theme = useTheme();
  const {colors} = theme;
  const {getPlaylists, addSongToMultiplePlaylists} = usePlaylistApi();
  const {song: songParam, songId: songIdParam} = useRoute().params;

  // SongActionModal passes song as a JSON string; normalize once here.
  // Backend matches `songId` against playlist song ObjectIds to flag
  // isSongPresent, and the bulk add/remove middleware requires a
  // { videoId, title } object — so resolve both up front.
  const song = useMemo(() => {
    if (!songParam) return null;
    if (typeof songParam === "object") return songParam;
    try {
      return JSON.parse(songParam);
    } catch {
      return null;
    }
  }, [songParam]);
  const videoId = song?.videoId || song?.id || (typeof songIdParam === "string" ? songIdParam : null);

  const [loadingLists, setLoadingLists] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchPlaylists = async () => {
      try {
        // Backend's isSongPresent check compares against Song ObjectIds,
        // not YouTube videoIds — only pass a 24-hex ObjectId.
        const lookupId = /^[0-9a-fA-F]{24}$/.test(videoId || "") ? videoId : undefined;
        const {playlists} = await getPlaylists(lookupId);
        if (cancelled) return;
        setPlaylists(playlists ?? []);
        const belonged = (playlists ?? []).filter(p => p.isSongPresent).map(p => p.id);
        setBelongedPlaylists(belonged);
        setSelectedPlaylists(belonged);
      } catch (e) {
        console.error("Failed to fetch playlists:", e);
      } finally {
        if (!cancelled) setLoadingLists(false);
      }
    };
    fetchPlaylists();
    return () => { cancelled = true; };
  }, [videoId]);

  const toggleSelection = (id) => {
    setSelectedPlaylists((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : [...prev, id]
    );
  };

  const handleAdd = async () => {
    if (saving) return;
    if (!song?.videoId || !song?.title) {
      const msg = "Could not save: song is missing videoId/title";
      if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
      else Alert.alert('Beatify', msg);
      return;
    }
    // Determine which playlists to add and remove
    const playlistsToAdd = selectedPlaylists.filter(
      (id) => !belongedPlaylists.includes(id)
    );
    const playlistsToRemove = belongedPlaylists.filter(
      (id) => !selectedPlaylists.includes(id)
    );
    const trimmedName = newPlaylistName.trim();
    if (playlistsToAdd.length === 0 && playlistsToRemove.length === 0 && !trimmedName) {
      router.back();
      return;
    }

    const payload = {
      song,
      add: [
        ...playlistsToAdd.map((id) => ({ playlistId: id })),
        ...(trimmedName ? [{ playlistName: trimmedName }] : []),
      ],
      remove: playlistsToRemove.map((id) => ({ playlistId: id })),
    };

    setSaving(true);
    try {
      const res = await addSongToMultiplePlaylists(payload);
      if (res.success) {
        ToastAndroid.show("Song updated in playlists successfully", ToastAndroid.SHORT);
        router.back();
      } else {
        console.error("Failed to update playlists:", res);
      }
    } catch (e) {
      console.error("Failed to update playlists:", e?.message || e);
    } finally {
      setSaving(false);
    }
  };

  const renderPlaylistItem = ({ item }) => (
    <Surface
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        marginBottom: 8,
        borderRadius: 12,
        elevation: 1,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="titleMedium">{item.name}</Text>
        <Text variant="bodySmall" style={{ color: "#888" }}>
          {item.songCount} songs
        </Text>
      </View>

      <Checkbox
        status={selectedPlaylists.includes(item.id) ? "checked" : "unchecked"}
        onPress={() => toggleSelection(item.id)}
      />
    </Surface>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <Text variant="headlineSmall" style={{ marginBottom: 16 }}>
        Existing Playlists
      </Text>

      {/* Existing playlists */}
      <FlatList
        data={playlists}
        renderItem={renderPlaylistItem}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <Divider />}
      />

      {/* Input for new playlist */}
      <TextInput
        label="Create a new playlist"
        mode="outlined"
        placeholder="Playlist Name"
        value={newPlaylistName}
        onChangeText={setNewPlaylistName}
        style={{ marginTop: 16 }}
      />

      {/* Submit Button */}
      <Button
        mode="contained"
        onPress={handleAdd}
        loading={saving}
        disabled={saving || loadingLists || (selectedPlaylists.length===0 && newPlaylistName.trim() === "" && belongedPlaylists.length===0)}
        style={{ marginTop: 20, borderRadius: 8 }}
      >
        Save
      </Button>
    </View>
  );
}

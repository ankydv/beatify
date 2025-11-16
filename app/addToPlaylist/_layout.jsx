import { useState, useEffect } from "react";
import { View, FlatList, ToastAndroid } from "react-native";
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
  const {song, songId} = useRoute().params; 

  useEffect(() => {
    const fetchPlaylists = async () => {
      const {playlists} = await getPlaylists(songId);
      setPlaylists(playlists);
      const belonged = playlists.filter(p => p.isSongPresent).map(p => p.id);
      setBelongedPlaylists(belonged);
      setSelectedPlaylists(belonged);
    };
    fetchPlaylists();
  }, []);

  const toggleSelection = (id) => {
    setSelectedPlaylists((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : [...prev, id]
    );
  };

  const handleAdd = async () => {
    // Determine which playlists to add and remove
    const playlistsToAdd = selectedPlaylists.filter(
      (id) => !belongedPlaylists.includes(id)
    );
    const playlistsToRemove = belongedPlaylists.filter(
      (id) => !selectedPlaylists.includes(id)
    );

    const payload = {
      song,
      add: [
        ...playlistsToAdd.map((id) => ({ playlistId: id })),
        ...(newPlaylistName ? [{ playlistName: newPlaylistName }] : []),
      ],
      remove: playlistsToRemove.map((id) => ({ playlistId: id })),
    };

    const res = await addSongToMultiplePlaylists(payload);
    if (res.success) {
      ToastAndroid.show("Song updated in playlists successfully", ToastAndroid.SHORT);
      router.back();
    } else {
      console.error("Failed to update playlists:", res);
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
        style={{ marginTop: 20, borderRadius: 8 }}
        disabled={selectedPlaylists.length===0 && newPlaylistName.trim() === "" && belongedPlaylists.length===0}
      >
        Save
      </Button>
    </View>
  );
}

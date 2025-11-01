import { useState, useEffect } from "react";
import { View, FlatList } from "react-native";
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

export default function AddToPlaylistScreen() {
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [visible, setVisible] = useState(true);
  const [snackText, setSnackText] = useState("");
  const theme = useTheme();
  const {colors} = theme;
  const {getPlaylists, addSongToMultiplePlaylists} = usePlaylistApi();
  const {song} = useRoute().params; 

  // Mock API data
  useEffect(() => {
    const fetchPlaylists = async () => {
      const {playlists} = await getPlaylists();
      console.log("Fetched playlists:", playlists);
      setPlaylists(playlists);
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
    const payload = {
      song,
      playlists: [
        ...selectedPlaylists.map((id) => ({ playlistId: id })),
        ...(newPlaylistName ? [{ playlistName: newPlaylistName }] : []),
      ],
    };

    // console.log("Add to playlist payload:", payload);
    const res = await addSongToMultiplePlaylists(payload);
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
        disabled={selectedPlaylists.length===0 && newPlaylistName.trim() === ""}
      >
        Save
      </Button>
    </View>
  );
}

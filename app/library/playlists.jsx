import { useEffect, useState } from "react";
import { View } from "react-native";
import { IconButton, Surface, Text, Divider, TouchableRipple } from "react-native-paper";
import { usePlaylistApi } from "../../hooks/library.hooks/playlist.hooks";
import { useRouter } from "expo-router";
const Playlists = () => {
  const [playlists, setPlaylists] = useState([]);
  const { getPlaylists } = usePlaylistApi();
  const router = useRouter();

  useEffect(() => {
    getPlaylists()
      .then((data) => {
        setPlaylists(data.playlists);
      })
      .catch((error) => {
        console.error("Error fetching playlists:", error);
      });
  }, []);

  const handlePress = (playlistId) => {
    router.push({
      pathname: "/playlist",
      params: { id: playlistId, isPlaylist: true, isUserPlaylist: true },
    });
  };

  const renderPlaylistItem = ({ item }) => (
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
      }}
    >
      <TouchableRipple style={{ flex: 1 }} onPress={() => handlePress(item.id)}>
        <View>
          <Text variant="titleMedium">{item.name}</Text>
          <Text variant="bodyMedium" style={{ color: "#888" }}>
            {item.songCount} songs
          </Text>
        </View>
      </TouchableRipple>

      <IconButton
        icon="dots-vertical" // MaterialCommunityIcons name
        size={24}
        onPress={() => console.log("Pressed menu")}
        style={{ margin: 0 }}
      />
    </Surface>
  );

  
  return (
    <View>
      <Text variant="titleLarge" style={{marginTop: 20}} >My Playlists</Text>
      <View style={{ marginTop: 8 }}>
        {playlists?.map((item, index) => (
          <View key={item.id ?? index}>
            {renderPlaylistItem({ item })}
            {index < playlists.length - 1 && <Divider />}
          </View>
        ))}
      </View>
    </View>
  );
};
export default Playlists;

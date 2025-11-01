import { View } from "react-native";
import { IconButton } from "react-native-paper";
import { usePlaylistApi } from "../../hooks/library.hooks/playlist.hooks";
import { useDispatch, useSelector } from "react-redux";
import { useState } from "react";
import { useNavigation } from "expo-router";

export const AddToButton = () => {
  const { addSongToPlaylist } = usePlaylistApi();
  const { metadata } = useSelector((state) => state.audio);
  const [isAdded, setAdded] = useState(false);
  const dispatch = useDispatch();
  const navation = useNavigation();

  const handleAddToPlaylist = async () => {
    try {
      const res = await addSongToPlaylist({
        song: metadata.videoDetails,
        playlistName: "favorites",
      });
      setAdded(res.success);
    } catch (error) {
      console.log(error);
    }
  };

  const openAddToPlaylistModal = () => {
    // dispatch(openModal(<AddToPlaylist />));
    navation.navigate("addToPlaylist", { song: metadata.videoDetails });
  }

  return (
    <View>
      <IconButton icon={isAdded ? `check-circle` : 'playlist-plus'} size={35} onPress={openAddToPlaylistModal} />
    </View>
  );
};

export default AddToButton;

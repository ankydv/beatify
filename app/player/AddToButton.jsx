import { View } from "react-native";
import { IconButton } from "react-native-paper";
import {  useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { useNavigation } from "expo-router";
import { usePlaylistApi } from "../../hooks/library.hooks/playlist.hooks";

export const AddToButton = () => {
  const { metadata, songId } = useSelector((state) => state.audio);
  const [isAdded, setAdded] = useState(false);
  const navation = useNavigation();
  const { getIsAddedAnyPlaylist } = usePlaylistApi();

  useEffect(() => {
    const checkIfAdded = async () => {
      if (!songId) return;
      const added = await getIsAddedAnyPlaylist(songId);
      setAdded(added);
    };
    checkIfAdded();
  }, [songId]);

  const openAddToPlaylistModal = () => {
    navation.navigate("addToPlaylist", { song: metadata.videoDetails, songId });
  }

  return (
    <View>
      <IconButton icon={isAdded ? `check-circle` : 'playlist-plus'} size={35} onPress={openAddToPlaylistModal} />
    </View>
  );
};

export default AddToButton;

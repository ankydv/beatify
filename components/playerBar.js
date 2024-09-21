import React, { useEffect, useState } from "react";
import { Image, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useTheme } from "@react-navigation/native";
import { useSelector } from "react-redux";
import TrackPlayer, {
  State,
  usePlaybackState,
} from "react-native-track-player";
import Track from "@/utils/track.utils";
import { Text, View } from "./Themed";

const PlayerBar = () => {
  const navigation = useNavigation();
  const { currentTrack } = useSelector((state) => state.audio);
  const track = new Track(currentTrack);
  const [artist, setArtist] = useState();

  const playback = usePlaybackState();
  const theme = useTheme();

  const handlePress = () => {
    navigation.navigate("player");
  };
  const togglePlayBack = async () => {
    const currentTrack = await TrackPlayer.getActiveTrackIndex();
    if (currentTrack >= 0) {
      if ((playback.state == State.Paused) | (playback.state == State.Ready)) {
        await TrackPlayer.play();
      } else {
        await TrackPlayer.pause();
      }
    }
  };

  useEffect(() => {
    const getArtist = () => {
      TrackPlayer.getActiveTrack().then(res=>setArtist(res.artist))
    }
    getArtist();
  })

  return (
    <TouchableOpacity onPress={handlePress} style={[styles.container, {borderColor: theme.colors.border}]}>
      <Image source={{ uri: track.getThumbUrl("mini") }} style={styles.image} />
      <View style={styles.textContainer}>
        <Text style={[styles.title]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={[styles.artist]} numberOfLines={1}>
          {track.artists || artist}
        </Text>
      </View>
      <TouchableOpacity onPress={togglePlayBack}>
        <MaterialIcons
          name={`${
            playback.state == State.Playing ? "pause" : "play"
          }-circle-filled`}
          size={40}
          color={theme.colors.text}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: 5,
    borderTopWidth: 1,
    bottom: 70,
    width: "100%",
  },
  image: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  textContainer: {
    flex: 1,
    marginLeft: 10,
    borderWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
  },
  artist: {
    fontSize: 14,
  },
});

export default PlayerBar;

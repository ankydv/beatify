import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import TrackPlayer, {
  State,
  usePlaybackState,
} from "react-native-track-player";
import Track from "@/utils/track.utils";

const PlayerBar = () => {
  const navigation = useNavigation();
  const { currentTrack } = useSelector((state) => state.audio);
  const track = new Track(currentTrack);

  const playback = usePlaybackState();

  const handlePress = () => {
    navigation.navigate("player");
  };
  const togglePlayBack = async () => {
    const currentTrack = await TrackPlayer.getActiveTrackIndex();
    if (currentTrack >= 0) {
      console.log(State.Paused);
      if ((playback.state == State.Paused) | (playback.state == State.Ready)) {
        await TrackPlayer.play();
      } else {
        await TrackPlayer.pause();
      }
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.container}>
      <Image source={{ uri: track.getThumbUrl("mini") }} style={styles.image} />
      <View style={styles.textContainer}>
        <Text style={[styles.title]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={[styles.artist]} numberOfLines={1}>
          {track.artists}
        </Text>
      </View>
      <TouchableOpacity onPress={togglePlayBack}>
        <MaterialIcons
          name={`${
            playback.state == State.Playing ? "pause" : "play"
          }-circle-filled`}
          size={40}
          color="black"
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
    backgroundColor: "#fff",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#e0e0e0",
    bottom: 50,
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

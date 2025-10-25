import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Pressable, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme, Text } from "react-native-paper";
import { useSelector } from "react-redux";
import TrackPlayer, {
  State,
  usePlaybackState,
} from "react-native-track-player";
import Track from "@/utils/track.utils";
import { useNavigation } from "expo-router";
import Metadata from "@/utils/metadata.utils";

const PlayerBar = () => {
  const navigation = useNavigation();
  const { currentTrack, metadata } = useSelector((state) => state.audio);
  const track = new Track(currentTrack);
  const md = new Metadata(metadata);
  const [artist, setArtist] = useState();
  const [thumbUrl, setThumbUrl] = useState();

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
      TrackPlayer.getActiveTrack().then(res=>{
        setArtist(res.artist)
        setThumbUrl(res.artwork)
      })
    }
    getArtist();
  })

  return (
    <Pressable onPress={handlePress} style={[styles.container, {borderColor: theme.colors.border, backgroundColor: theme.colors.surface}]}>
      <Image source={{ uri: md.getThumb("mini").url}} style={styles.image} />
      <View style={styles.textContainer}>
        <Text variant="titleMedium" style={[styles.title]} numberOfLines={1}>
          {md.getTitle()}
        </Text>
        <Text variant="bodyMedium" style={[styles.artist]} numberOfLines={1}>
          {md.getArtists()}
        </Text>
      </View>
      <Pressable onPress={togglePlayBack}>
        <MaterialIcons
          name={`${
            playback.state == State.Playing ? "pause" : "play"
          }-circle-filled`}
          size={40}
          color={theme.colors.primary}
        />
      </Pressable>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderTopWidth: 0.3,
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
    justifyContent: 'center',
    paddingVertical: 10,
  },
  title: {
    fontWeight: "bold",
  },
  artist: {
  },
});

export default PlayerBar;

import React, { useEffect, useState, useMemo } from "react";
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
import { partyTogglePlayback } from "@/utils/partyPlayback.utils";

const PlayerBar = () => {
  const navigation = useNavigation();
  const { currentTrack, metadata } = useSelector((state) => state.audio);
  const { minimised, roomId } = useSelector((s) => s.party);
  const track = useMemo(() => (currentTrack ? new Track(currentTrack) : null), [currentTrack]);
  const md = useMemo(() => (metadata ? new Metadata(metadata) : null), [metadata]);
  const [artist, setArtist] = useState();
  const [thumbUrl, setThumbUrl] = useState();

  const playback = usePlaybackState();
  const theme = useTheme();

  useEffect(() => {
    TrackPlayer.getActiveTrack().then((res) => {
      if (res) {
        setArtist(res.artist);
        setThumbUrl(res.artwork);
      }
    }).catch(() => {});
  }, [currentTrack]);

  // Hide the player bar when in a party room or when no track is loaded
  if (!currentTrack || roomId) {
    return null;
  }

  const handlePress = () => {
    navigation.navigate("player");
  };

  const togglePlayBack = async () => {
    if (await partyTogglePlayback()) return;
    try {
      const currentTrackIndex = await TrackPlayer.getActiveTrackIndex();
      if (currentTrackIndex != null && currentTrackIndex >= 0) {
        if (playback.state === State.Paused || playback.state === State.Ready) {
          await TrackPlayer.play();
        } else {
          await TrackPlayer.pause();
        }
      }
    } catch (e) {}
  };

  return (
    <Pressable onPress={handlePress} style={[styles.container, {borderColor: theme.colors.border, backgroundColor: theme.colors.surface}]}>
      <Image
        source={{ uri: md?.getThumb("mini")?.url || md?.getThumb("medium")?.url }}
        style={styles.image}
      />
      <View style={styles.textContainer}>
        <Text variant="titleMedium" style={[styles.title]} numberOfLines={1}>
          {md?.getTitle?.() || ""}
        </Text>
        <Text variant="bodyMedium" style={[styles.artist]} numberOfLines={1}>
          {md?.getArtists?.() || ""}
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

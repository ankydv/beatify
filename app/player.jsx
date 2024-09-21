import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
} from "react-native";
import Slider from "@react-native-community/slider";
import { MaterialIcons, AntDesign } from "@expo/vector-icons";
import Metadata from "@/utils/metadata.utils";
import { useSelector } from "react-redux";
import TrackPlayer, {
  State,
  usePlaybackState,
  useProgress,
} from "react-native-track-player";
import { useNavigation } from "expo-router";
import useAudioControls from "../hooks/audio.hooks";
import { BlurView } from "@react-native-community/blur";
import Lyrics from "../components/Lyrics";
import LyricsToggleButton from "../components/LyricsToggleButton";

const Player = () => {
  const [isFullScreen, setIsFullScreen] = useState(true);

  const { metadata, lyrics } = useSelector((state) => state.audio);
  const md = new Metadata(metadata);
  const progress = useProgress();
  const playback = usePlaybackState();
  const navigation = useNavigation();
  const { handleTogglePlayback } = useAudioControls();

  const [isLyricsVisible, setIsLyricsVisible] = useState(lyrics && true);


  const formatTime = (timeSeconds) => {
    const minutes = Math.floor(timeSeconds / 60);
    const seconds = Math.floor(timeSeconds % 60);
    const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;
    return `${minutes}:${formattedSeconds}`;
  };

  const handleSlidingComplete = async (value) => {
    try {
      await TrackPlayer.seekTo(value);
    } catch (error) {
      console.error("Error seeking audio:", error);
    }
  };

  const toggleLyricsVisibility = () => {
    setIsLyricsVisible(!isLyricsVisible);
  }

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: isFullScreen ? { display: "none" } : {},
    });
  }, [isFullScreen, navigation]);

  const toggleScreen = () => {
    setIsFullScreen(!isFullScreen);
    navigation.goBack();
  };

  return (
    <ImageBackground
      source={{ uri: md.getThumbUrl("large") }}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView
        style={styles.absolute}
        blurType={"dark"}
        blurAmount={100}
        reducedTransparencyFallbackColor="white"
      />
      <View style={[styles.fullScreenPlayer, {}]}>
        <TouchableOpacity onPress={toggleScreen} style={styles.minimizeButton}>
          <AntDesign name="down" size={15} color={"white"} />
        </TouchableOpacity>
        <View style={styles.albumArtContainer}>
          {!isLyricsVisible && <View style={styles.albumArtWrapper}>
            <Image
              source={{ uri: md.getThumbUrl("large") }}
              style={styles.albumArt}
            />
          </View>}
          {isLyricsVisible && lyrics && <Lyrics />}
        </View>
        <View style={styles.controlsContainer}>
          <View style={styles.infoContainer}>
            <View styele={styles.togglesContainer}>
              {lyrics && <LyricsToggleButton isLyricsVisible={isLyricsVisible} onToggle={toggleLyricsVisibility}/>}
            </View>
            <Text style={[styles.title, styles.shadowText]}>
              {md.getTitle()}
            </Text>
            <Text
              style={[
                styles.artist,
                styles.shadowText,
                { textShadowRadius: 1 },
              ]}
            >
              {md.getArtists()}
            </Text>
          </View>
          <Slider
            value={progress.position}
            step={1}
            style={styles.slider}
            minimumValue={0}
            maximumValue={progress.duration}
            minimumTrackTintColor={"white"}
            maximumTrackTintColor={"white"}
            thumbTintColor={"white"}
            onSlidingComplete={handleSlidingComplete}
          />
          <View style={styles.timeContainer}>
            <Text style={[styles.timeText]}>
              {formatTime(progress.position)}
            </Text>
            <Text style={[styles.timeText]}>
              {formatTime(progress.duration)}
            </Text>
          </View>
          <View style={styles.controls}>
            <TouchableOpacity>
              <MaterialIcons name="skip-previous" size={40} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ borderWidth: 0, borderRadius: 50, elevation: 10 }}
              activeOpacity={0.9}
              onPress={handleTogglePlayback}
            >
              <MaterialIcons
                style={{ padding: 0 }}
                name={`${
                  playback.state == State.Playing ? "pause" : "play"
                }-circle-filled`}
                size={60}
                color="white"
              />
            </TouchableOpacity>
            <TouchableOpacity>
              <MaterialIcons name="skip-next" size={40} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {/* </BlurView> */}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenPlayer: {
    flex: 1,
    alignItems: "center",
    width: "100%",
  },
  absolute: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  minimizeButton: {
    position: "absolute",
    top: 20,
    left: 20,
    borderRadius: 50,
    borderColor: "black",
    elevation: 5,
    backgroundColor: "rgba(247, 247, 247, 0.1)",
    padding: 15,
  },
  albumArtContainer: {
    flex: 3,
    justifyContent: "center",
  },
  albumArtWrapper: {
    elevation: 50,
    borderColor: "black",
    borderWidth: 1,
  },
  albumArt: {
    width: 300,
    height: 300,
    borderRadius: 8,
  },
  controlsContainer: {
    flex: 2,
    alignItems: "center",
    width: "100%",
  },
  infoContainer: {
    width: "100%",
    padding: 20,
  },
  togglesContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginVertical: 10,
    color: "white",
  },
  artist: {
    fontSize: 16,
    marginBottom: 20,
    color: "white",
  },
  slider: {
    width: "95%",
    height: 40,
  },
  shadowText: {
    textShadowColor: "black",
    textShadowRadius: 4,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "60%",
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "90%",
    opacity: 0.6,
  },
  timeText: {
    fontSize: 14,
    color: "white",
  },
});

export default Player;

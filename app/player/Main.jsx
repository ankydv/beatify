import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Image } from "react-native";
import Lyrics from "./Lyrics";
import LyricsToggleButton from "../../components/LyricsToggleButton";
import Slider from "@react-native-community/slider";
import useAudioControls from "../../hooks/audio.hooks";
import { MaterialIcons } from "@expo/vector-icons";
import Metadata from "@/utils/metadata.utils";
import TrackPlayer, {
  State,
  usePlaybackState,
  useProgress,
} from "react-native-track-player";
import { useDispatch, useSelector } from "react-redux";
import { playNextTrack, playPrevTrack } from "@/state/slices/audio.slice.js"
import BubbleIcon from "../../components/BubbleIcon";

const Main = ({setIsQueueVisible}) => {
  const progress = useProgress();
  const playback = usePlaybackState();
  const { handleTogglePlayback } = useAudioControls();
  const dispatch = useDispatch();

  const { metadata, lyrics } = useSelector((state) => state.audio);
  const [isLyricsVisible, setIsLyricsVisible] = useState(lyrics && true);
  const md = new Metadata(metadata);

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
  };
  const handlePrev = () => {
    dispatch(playPrevTrack());
  }

  const handleNext = () => {
    dispatch(playNextTrack());
  }
  const handleEnd = () => {
    dispatch(playNextTrack());
  }

  useEffect(() => {
    if(playback.state === State.Ended)
        handleEnd();
  }, [playback.state])
  return (
    <>
      <View style={styles.albumArtContainer}>
        {!(isLyricsVisible && lyrics) && (
          <View style={styles.albumArtWrapper}>
            <Image
              source={{ uri: md.getThumbUrl("large") }}
              style={styles.albumArt}
            />
          </View>
        )}
        {isLyricsVisible && lyrics && <Lyrics />}
      </View>
      <View style={styles.controlsContainer}>
        <View style={styles.infoContainer}>
          <View style={styles.togglesContainer}>
            {lyrics && (
              <LyricsToggleButton
                isLyricsVisible={isLyricsVisible}
                onToggle={toggleLyricsVisibility}
              />
            )
              }
          </View>
          <Text numberOfLines={1} style={[styles.title, styles.shadowText]}>{md.getTitle()}</Text>
          <Text
            numberOfLines={1} 
            style={[styles.artist, styles.shadowText, { textShadowRadius: 1 }]}
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
          <Text style={[styles.timeText]}>{formatTime(progress.position)}</Text>
          <Text style={[styles.timeText]}>{formatTime(progress.duration)}</Text>
        </View>
        <View style={styles.controls}>
          <TouchableOpacity onPress={handlePrev}>
            <MaterialIcons name="skip-previous" size={35} color="white" />
          </TouchableOpacity>
          <BubbleIcon name={playback.state == State.Playing ? "pause" : 'play-arrow'} size={45} onPress={handleTogglePlayback} />
          <TouchableOpacity onPress={handleNext}>
            <MaterialIcons name="skip-next" size={35} color="white" />
          </TouchableOpacity>
        </View>
        <View style={[styles.controls, {marginTop: 10}]}>
          {/* Share Button */}
          <BubbleIcon name={'share'} />

          {/* Sleep Timer Button */}
          <BubbleIcon name={'timer'} />

          {/* Queue Button */}
          <BubbleIcon name={'queue-music'} onPress={() => setIsQueueVisible(true)}/>

          {/* Menu Button */}
          <BubbleIcon name={'more-horiz'} />
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  albumArtContainer: {
    flex: 1,
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
    height: 350,
    alignItems: "center",
    width: "100%",
    paddingVertical: 20,
  },
  infoContainer: {
    width: "100%",
    paddingHorizontal: 20,
  },
  togglesContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    height: 29,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginVertical: 5,
    color: "white",
    fontFamily: 'Helvetica Neue Bold',
  },
  artist: {
    fontSize: 16,
    marginBottom: 20,
    color: "white",
  },
  slider: {
    width: "100%",
    height: 20,
  },
  shadowText: {
    textShadowColor: "black",
    textShadowRadius: 4,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "80%",
    maxWidth: 350,
    paddingTop: 20,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    opacity: 0.6,
    paddingHorizontal: 20,
  },
  timeText: {
    fontSize: 12,
    color: "white",
  },
});

export default Main;

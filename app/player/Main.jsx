import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Image, Dimensions } from "react-native";
import Lyrics from "./Lyrics";
import LyricsToggleButton from "../../components/LyricsToggleButton";
import SliderAndTime from './Slider';
import useAudioControls from "../../hooks/audio.hooks";
import { MaterialIcons } from "@expo/vector-icons";
import Metadata from "@/utils/metadata.utils";
import {
  State,
  usePlaybackState,
} from "react-native-track-player";
import { useDispatch, useSelector } from "react-redux";
import { playNextTrack, playPrevTrack } from "@/state/slices/audio.slice.js"
import BubbleIcon from "../../components/BubbleIcon";
import { ActivityIndicator } from "react-native-paper";
import { useTheme } from "react-native-paper";
import MarqueeText from "../../components/MarqueeText";
import LoadingIndicator from "../../components/LoadingIndicator";

const { width } = Dimensions.get("window");

const Main = ({setIsQueueVisible}) => {
  const playback = usePlaybackState();
  const { handleTogglePlayback } = useAudioControls();
  const dispatch = useDispatch();

  const { metadata, lyrics } = useSelector((state) => state.audio);
  const [isLyricsVisible, setIsLyricsVisible] = useState(true);
  const md = new Metadata(metadata);
  const title = md.getTitle();
  const theme = useTheme();

  const toggleLyricsVisibility = () => {
    setIsLyricsVisible(!isLyricsVisible);
  };
  const handlePrev = () => {
    dispatch(playPrevTrack());
  }

  const handleNext = () => {
    dispatch(playNextTrack());
  }
  const thumb = md.getThumb("large");

  return (
    <>
      <View style={styles.albumArtContainer}>
        {!(isLyricsVisible && lyrics) && (
          <View style={styles.albumArtWrapper}>
            {thumb && 
            <Image
              source={{ uri: thumb.url }}
              style={[styles.albumArt, {
                aspectRatio: thumb.width / thumb.height, 
                width: thumb.width <= width ? thumb.width : '95%',
              }]}
            />}
            {!thumb && <LoadingIndicator />}
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
          <MarqueeText style={[styles.title, styles.shadowText]}>{title}</MarqueeText>
          <MarqueeText
            style={[styles.artist, styles.shadowText, { textShadowRadius: 1 }]}
          >
            {md.getArtists()}
          </MarqueeText>
        </View>
        <SliderAndTime />
        <View style={styles.controls}>
          <TouchableOpacity onPress={handlePrev}>
            <MaterialIcons name="skip-previous" size={35} color="white" />
          </TouchableOpacity>
          <View>
            <BubbleIcon name={playback.state == State.Playing ? "pause" : 'play-arrow'}
              size={45}
              onPress={handleTogglePlayback}
               />
            {playback.state == State.Buffering && 
              <ActivityIndicator size={60} color={theme.colors.text} style={{position: 'absolute', opacity: 0.8}} />
            }
          </View>
          <TouchableOpacity onPress={handleNext}>
            <MaterialIcons name="skip-next" size={35} color="white" />
          </TouchableOpacity>
        </View>
        <View style={[styles.controls, {marginTop: 10}]}>
          {/* Share Button */}
          <BubbleIcon name={'share'} disabled={true} />

          {/* Sleep Timer Button */}
          <BubbleIcon name={'timer'} disabled={true} />

          {/* Queue Button */}
          <BubbleIcon name={'queue-music'} onPress={() => setIsQueueVisible(true)}/>

          {/* Menu Button */}
          <BubbleIcon name={'more-horiz'} disabled={true} />
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  albumArtContainer: {
    flex: 1,
    justifyContent: "center",
    width: "100%",
  },
  albumArtWrapper: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  albumArt: {
    elevation: 10,
  },
  controlsContainer: {
    height: 350,
    alignItems: "center",
    width: "100%",
    paddingVertical: 20,
  },
  infoContainer: {
    width: "100%",
    padding: 5,
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
    left: 15,
  },
  artist: {
    fontSize: 16,
    marginBottom: 20,
    color: "white",
    left: 15,
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

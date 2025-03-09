import Slider from "@react-native-community/slider";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import TrackPlayer from "react-native-track-player";
import useTrackProgress from "../../hooks/track.hooks";

const SliderAndTime = () => {
  const { position, duration, buffered, setProgress } = useTrackProgress();

  const formatTime = (timeSeconds) => {
    const minutes = Math.floor(timeSeconds / 60);
    const seconds = Math.floor(timeSeconds % 60);
    const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;
    return `${minutes}:${formattedSeconds}`;
  };

  const handleSlidingComplete = async (value) => {
    try {
      await TrackPlayer.seekTo(value);
      setProgress((prev) => ({ ...prev, position: value }));
    } catch (error) {
      console.error("Error seeking audio:", error);
    }
  };

  // Calculate progress percentages
  const bufferedPercentage = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <View style={styles.slider}>
      <View style={styles.bufferedTrackContainer}>
        <View
          style={[
            styles.bufferedTrack,
            { width: `${bufferedPercentage}%` },
          ]}
        />
      </View>
      <Slider
        value={position}
        step={0.1}
        minimumValue={0}
        maximumValue={duration}
        minimumTrackTintColor={"white"}
        maximumTrackTintColor={"white"}
        thumbTintColor={"white"}
        onSlidingComplete={handleSlidingComplete}
      />
      <View style={styles.timeContainer}>
        <Text style={[styles.timeText]}>{formatTime(position)}</Text>
        <Text style={[styles.timeText]}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
};

export default SliderAndTime;

const styles = StyleSheet.create({
    slider: {
        width: "100%",
        height: 19,
      },
      bufferedTrackContainer: {
        position: "absolute",
        height: "100%",
        width: "100%",
        justifyContent: "center",
        paddingHorizontal: 15,
      },
      bufferedTrack: {
        height: 3,
        backgroundColor: "white",
        opacity: 0.3,
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
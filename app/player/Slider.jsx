import Slider from "@react-native-community/slider";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import TrackPlayer, { useProgress } from "react-native-track-player";

const SliderAndTime = () => {
  const progress = useProgress();

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
  return (
    <>
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
    </>
  );
};

export default SliderAndTime;

const styles = StyleSheet.create({
    slider: {
        width: "100%",
        height: 20,
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
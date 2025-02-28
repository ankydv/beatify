import React, { useCallback } from "react";
import MusicList from "@/components/MusicList";
import { useSelector } from "react-redux";
import { Text } from "@/components/Themed";
import { Alert, BackHandler, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";

const Queue = ({ setIsQueueVisible }) => {
  const { queue } = useSelector((state) => state.audio);

  const onBackPress = () => {
    setIsQueueVisible(false);
    return true;
  };

  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );

      return () => backHandler.remove();
    }, [])
  );

  return (
    <ScrollView
      style={{ width: "90%", height: "100" }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10, color: "white" }}>
        Current Queue
      </Text>
      {queue?.tracks?.length > 0 ? (
        <MusicList dataset={queue.tracks} isQueue={true} />
      ) : (
        <Text>No songs in the queue.</Text>
      )}
    </ScrollView>
  );
};

export default Queue;

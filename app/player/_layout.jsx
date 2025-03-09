import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
} from "react-native";
import { AntDesign, Entypo } from "@expo/vector-icons";
import Metadata from "@/utils/metadata.utils";
import { useSelector } from "react-redux";
import { useNavigation } from "expo-router";
import Main from "./Main";
import Queue from "./Queue";
import { SafeAreaView } from "react-native-safe-area-context";
import BubbleIcon from "../../components/BubbleIcon";
import BlurImageBg from "../../components/BlurImageBg";

const Player = () => {
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [isQueueVisible, setIsQueueVisible] = useState(false);

  const { metadata } = useSelector((state) => state.audio);
  const md = new Metadata(metadata);
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: isFullScreen ? { display: "none" } : {},
    });
  }, [isFullScreen, navigation]);

  const toggleScreen = () => {
    if (isQueueVisible) {
      setIsQueueVisible(false);
    } else {
      setIsFullScreen(!isFullScreen);
      navigation.goBack();
    }
  };
  const img = md.getThumb("medium");

  return (
    <BlurImageBg uri={img?.url}>
      <SafeAreaView style={styles.topButtons}>
        <BubbleIcon
          onPress={toggleScreen}
          isMaterialIcon={false}
          style={{ padding: 15 }}
        >
          {isQueueVisible ? (
            <Entypo name="cross" size={15} color="white" />
          ) : (
            <AntDesign name="down" size={13} color={"white"} />
          )}
        </BubbleIcon>
      </SafeAreaView>
      <View style={[styles.fullScreenPlayer, {}]}>
        {isQueueVisible ? (
          <Queue setIsQueueVisible={setIsQueueVisible} />
        ) : (
          <Main setIsQueueVisible={setIsQueueVisible} />
        )}
      </View>
    </BlurImageBg>
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
  topButtons: {
    flexDirection: "row",
    position: "relative",
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 25,
  },
  minimizeButton: {
    borderRadius: 50,
    borderColor: "black",
    elevation: 5,
    backgroundColor: "rgba(247, 247, 247, 0.1)",
    padding: 15,
  },
});

export default Player;

import React, { useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
} from "react-native";
import { AntDesign, Entypo } from "@expo/vector-icons";
import Metadata from "@/utils/metadata.utils";
import { useSelector } from "react-redux";
import { useNavigation } from "expo-router";
import { BlurView } from "@react-native-community/blur";
import Main from "./Main";
import Queue from "./Queue";

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
      <TouchableOpacity onPress={toggleScreen} style={styles.minimizeButton}>
        {isQueueVisible ? <Entypo name="cross" size={15} color="white" /> : <AntDesign name="down" size={15} color={"white"} />}
      </TouchableOpacity>
      <View style={[styles.fullScreenPlayer, {}]}>
        {isQueueVisible ? (
          <Queue setIsQueueVisible={setIsQueueVisible}/>
        ) : (
          <Main setIsQueueVisible={setIsQueueVisible} />
        )}
      </View>
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
});

export default Player;

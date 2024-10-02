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
import { SafeAreaView } from "react-native-safe-area-context";
import BubbleIcon from "../../components/BubbleIcon";

const Player = () => {
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [isQueueVisible, setIsQueueVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [readyToRenderBlur, setReadyToRenderBlur] = useState(false);

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

  useEffect(() => {
    if (imageLoaded) {
      // Introduce a delay to ensure the image is fully rendered
      const delayTimeout = setTimeout(() => {
        setReadyToRenderBlur(true); // BlurView is rendered after the delay
      }, 90); // Adjust delay as needed

      return () => clearTimeout(delayTimeout); // Cleanup timeout on unmount
    }
  }, [imageLoaded]);

  return (
    <ImageBackground
      source={{ uri: md.getThumbUrl("large") }}
      style={styles.container}
      resizeMode="cover"
      onLoadEnd={() => setImageLoaded(true)}
    >
      {readyToRenderBlur && <BlurView
        style={styles.absolute}
        blurType={"dark"}
        blurAmount={32}
        reducedTransparencyFallbackColor="white"
        blurRadius={25}
        downsampleFactor={25}
        overlayColor="rgba(0, 0, 0, 0.52)"
      />}
      <SafeAreaView style={styles.topButtons}>
        <BubbleIcon onPress={toggleScreen} isMaterialIcon={false} style={{padding: 15}}>
          {isQueueVisible ? <Entypo name="cross" size={15} color="white" /> : <AntDesign name="down" size={13} color={"white"} />}
        </BubbleIcon>
      </SafeAreaView>
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
  topButtons: {
    flexDirection: 'row',
    position: 'relative',
    width: '100%',
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

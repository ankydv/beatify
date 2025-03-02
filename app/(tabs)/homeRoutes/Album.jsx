import React, { useEffect, useState } from "react";
import { View, Image, ScrollView, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MusicList from "@/components/MusicList";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { getAlbum } from "../../../services/album.service";
import BubbleIcon from "@/components/BubbleIcon";
import { Text } from "@/components/Themed";
import { useTheme } from "@react-navigation/native";
import BlurImageBg from "../../../components/BlurImageBg";
import { SafeAreaView } from "react-native-safe-area-context";

const Album = () => {
  const { id, isPlaylist } = useLocalSearchParams();
  const [album, setAlbum] = useState();
  const theme = useTheme();
  const [scrollY, setScrollY] = useState(new Animated.Value(0));
  const [isScrolled, setIsScrolled] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    getAlbum(id, isPlaylist).then((res) => setAlbum(res));
  }, [id]);

  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      if (value > 300) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    });
    return () => scrollY.removeListener(listener);
  }, [scrollY]);

  if (!album) return null;

  return (
    <View>
      <Animated.ScrollView
        contentContainerStyle={styles.container}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        <BlurImageBg uri={album.thumbnails[0]?.url}>
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,1)"]}
            style={styles.gradientOverlay}
          />
          <Image
            source={{ uri: album.thumbnails[album.thumbnails.length - 1].url }}
            style={styles.albumArt}
            height={200}
            width={200}
          />
          <Text style={styles.albumTitle}>{album.title}</Text>
          <View style={styles.buttonsContainer}>
            <BubbleIcon name={"download"} />
            <BubbleIcon name={"my-library-add"} />
            <BubbleIcon
              name={"play-arrow"}
              size={35}
              style={{
                backgroundColor: theme.dark ? "white" : "black",
                padding: 12,
              }}
              color={theme.colors.background}
            />
            <BubbleIcon name="share" />
            <BubbleIcon name={"more-vert"} />
          </View>
        </BlurImageBg>
        <View style={styles.musicListContainer}>
          <MusicList dataset={album.tracks} />
        </View>
      </Animated.ScrollView>
      <SafeAreaView
        style={[styles.topButtons, isScrolled && { backgroundColor: "black" }]}
      >
        <BubbleIcon
          name="arrow-back"
          size={24}
          onPress={() => navigation.goBack()}
        />
        {isScrolled && <Text>{album.title}</Text>}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  topButtons: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 10,
  },
  gradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "100%",
  },
  albumTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 10,
    textAlign: "center",
  },
  albumArt: {
    marginTop: 100,
  },
  buttonsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: 300,
    marginTop: 20,
  },
  musicListContainer: {
    flex: 1,
  },
});

export default Album;

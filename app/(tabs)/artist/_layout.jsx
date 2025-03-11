import { View, Text } from "@/components/Themed";
import MusicList from "@/components/MusicList";
import PlaylistRow from "@/components/PlaylistRow";
import { Animated, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import NavigationHeader from "../../../components/NavigationHeader";
import { useState, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import { getArtist } from "../../../services/artist.service";

export default function Artist() {
  const songList = artistInfo ? artistInfo.songs.results : [];
  const thumbUrl = artistInfo?.thumbnails[artistInfo.thumbnails.length - 1].url;
  const [scrollY, setScrollY] = useState(new Animated.Value(0));
  const [isScrolled, setIsScrolled] = useState(false);
  const { id } = useLocalSearchParams();
  const [artistInfo, setArtistInfo] = useState();

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

  useEffect(() => {
    getArtist(id).then((res) => setArtistInfo(res));
  }, [id]);

  if(!artistInfo) return null; 

  return (
    <View>
      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        <View style={styles.imageContainer}>
          <Image style={styles.image} source={{ uri: thumbUrl }} />
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,1)"]}
            style={styles.gradientOverlay}
          />
          <View style={styles.imageBottomContainer}>
            <Text style={[styles.title, {fontSize: 30}]}>{artistInfo?.name}</Text>
          </View>
        </View>
        <View style={styles.songContainer}>
          <Text style={styles.title}>Popular Songs</Text>
          <MusicList dataset={songList} />
        </View>
        {artistInfo && (
          <>
            {["videos", "albums", "singles", "related"].map(
              (category) =>
                artistInfo[category] && (
                  <View>
                    <Text style={styles.title}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </Text>
                    <PlaylistRow
                      key={category}
                      title={
                        category.charAt(0).toUpperCase() + category.slice(1)
                      }
                      items={artistInfo[category].results}
                    />
                  </View>
                )
            )}
          </>
        )}
      </Animated.ScrollView>
      <NavigationHeader title={artistInfo.name} isScrolled={isScrolled} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  imageContainer: {},
  image: {
    width: "100%",
    aspectRatio: 1,
  },
  imageBottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    backgroundColor: "transparent",
    width: "100%",
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "100%",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    padding: 10,
    opacity: 0.8,
  },
  songContainer: {
    paddingBottom: 10,
  },
});

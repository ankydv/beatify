import React, { useEffect, useState } from "react";
import { View, Image, StyleSheet, Animated, BackHandler } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MusicList from "@/components/MusicList";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { getAlbum } from "@/services/album.service";
import BubbleIcon from "@/components/BubbleIcon";
import { Text } from "@/components/Themed";
import { useTheme } from "react-native-paper";
import BlurImageBg from "@/components/BlurImageBg";
import { SafeAreaView } from "react-native-safe-area-context";
import LoadingIndicator from "@/components/LoadingIndicator";
import { usePlaylistApi } from "@/hooks/library.hooks/playlist.hooks";
import { useDispatch } from "react-redux";
import { loadAndPlayTrack } from "@/state/slices/audio.slice";
import { handleVoiceRoomSongTap } from "@/utils/partyPlayback.utils";

const AlbumScreen = () => {
  const { id, isPlaylist, isUserPlaylist } = useLocalSearchParams();
  const [album, setAlbum] = useState();
  const theme = useTheme();
  const [scrollY] = useState(new Animated.Value(0));
  const [isScrolled, setIsScrolled] = useState(false);
  const router = useRouter();
  const navigation = useNavigation();
  const { getPlaylistDetails } = usePlaylistApi();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!id) return;
    if (isUserPlaylist === 'true' || isUserPlaylist === true) {
      getPlaylistDetails(id).then((res) => setAlbum(res)).catch(console.error);
    } else {
      getAlbum(id, String(isPlaylist)).then((res) => setAlbum(res)).catch(console.error);
    }
  }, [id, isPlaylist, isUserPlaylist]);

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

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.back();
    }
  };

  useEffect(() => {
    const onHardwareBack = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [navigation]);

  if (!album) {
    return <LoadingIndicator />;
  }

  const onPressPlayAll = async () => {
    if (!album?.tracks || album.tracks.length === 0) return;
    const handled = await handleVoiceRoomSongTap(album.tracks[0]);
    if (handled) return;
    dispatch(
      loadAndPlayTrack({
        track: album.tracks[0],
        isQueueTrack: true,
        newQueue: { tracks: album.tracks },
      })
    ).unwrap();
  };

  const coverUrl =
    album.thumbnails?.[album.thumbnails.length - 1]?.url ||
    album.thumbnails?.[0]?.url ||
    album.thumbnail;

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        <BlurImageBg uri={album.thumbnails?.[0]?.url || coverUrl}>
          <LinearGradient
            colors={["rgba(255,255,255,0)", theme.colors.surface]}
            style={styles.gradientOverlay}
          />
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              style={styles.albumArt}
              height={200}
              width={200}
            />
          ) : null}
          <Text style={styles.albumTitle} numberOfLines={2}>
            {album.title}
          </Text>
          {album.description ? (
            <Text style={styles.albumSubtitle} numberOfLines={2}>
              {album.description}
            </Text>
          ) : null}
          <View style={styles.buttonsContainer}>
            <BubbleIcon style={styles.bubbleButton} color={theme.colors.text} name={"download"} />
            <BubbleIcon color={theme.colors.text} name={"my-library-add"} />
            <BubbleIcon
              name={"play-arrow"}
              size={35}
              style={{
                backgroundColor: theme.dark ? "white" : "black",
                padding: 12,
              }}
              color={theme.colors.background}
              onPress={onPressPlayAll}
            />
            <BubbleIcon color={theme.colors.text} name="share" />
            <BubbleIcon color={theme.colors.text} name={"more-vert"} />
          </View>
        </BlurImageBg>
        <View style={styles.musicListContainer}>
          <MusicList dataset={album.tracks} isQueue={true} />
        </View>
      </Animated.ScrollView>

      <SafeAreaView
        style={[styles.topButtons, isScrolled && { backgroundColor: theme.colors.surface }]}
        edges={['top']}
      >
        <BubbleIcon
          name="arrow-back"
          size={24}
          color={theme.colors.text}
          onPress={handleBack}
        />
        {isScrolled && (
          <Text style={styles.headerTitle} numberOfLines={1}>
            {album.title}
          </Text>
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  topButtons: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  gradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "100%",
  },
  albumTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 10,
    paddingHorizontal: 20,
    textAlign: "center",
  },
  albumSubtitle: {
    fontSize: 13,
    color: '#888888',
    marginTop: 4,
    paddingHorizontal: 20,
    textAlign: "center",
  },
  albumArt: {
    marginTop: 90,
    alignSelf: "center",
    borderRadius: 8,
  },
  buttonsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: 300,
    marginTop: 20,
    alignSelf: "center",
  },
  bubbleButton: {},
  musicListContainer: {
    flex: 1,
    marginTop: 10,
  },
});

export default AlbumScreen;

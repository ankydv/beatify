import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Image, StyleSheet, Animated, BackHandler, Alert, ToastAndroid, Platform, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MusicList from "@/components/MusicList";
import { resolvePlaylistSongId } from "@/utils/playlist.utils";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { getAlbum } from "@/services/album.service";
import BubbleIcon from "@/components/BubbleIcon";
import { Text } from "@/components/Themed";
import { useTheme, Menu } from "react-native-paper";
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
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const navigation = useNavigation();
  const { getPlaylistDetails, deletePlaylist } = usePlaylistApi();
  const dispatch = useDispatch();
  const deletingRef = useRef(false);
  const mountedRef = useRef(true);

  const userPlaylist = isUserPlaylist === 'true' || isUserPlaylist === true;
  const playlistId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!id) return;
    if (userPlaylist) {
      getPlaylistDetails(id).then((res) => mountedRef.current && setAlbum(res)).catch(console.error);
    } else {
      getAlbum(id, String(isPlaylist)).then((res) => mountedRef.current && setAlbum(res)).catch(console.error);
    }
  }, [id, isPlaylist, userPlaylist]);

  const notify = useCallback((msg) => {
    if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
    else Alert.alert('Beatify', msg);
  }, []);

  const goBackAfterDelete = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else router.back();
  }, [navigation, router]);

  const doDeletePlaylist = useCallback(async () => {
    if (!playlistId || deletingRef.current) return;
    deletingRef.current = true;
    if (mountedRef.current) {
      setDeleting(true);
      setHeaderMenuVisible(false);
    }
    try {
      await deletePlaylist(playlistId);
      notify(`Deleted "${album?.title || 'playlist'}"`);
      goBackAfterDelete();
    } catch (e) {
      notify(e?.message || 'Could not delete playlist');
      if (mountedRef.current) setDeleting(false);
    } finally {
      deletingRef.current = false;
    }
  }, [playlistId, deletePlaylist, notify, goBackAfterDelete, album?.title]);

  const confirmDeletePlaylist = useCallback(() => {
    setHeaderMenuVisible(false);
    // Delay so Menu dismiss animation doesn't clash with Alert.
    setTimeout(() => {
      Alert.alert(
        'Delete playlist?',
        `"${album?.title || 'This playlist'}" will be permanently deleted.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDeletePlaylist },
        ],
        { cancelable: true }
      );
    }, 150);
  }, [album?.title, doDeletePlaylist]);

  // Optimistic song removal — single source of truth update, no refetch.
  const handleSongRemoved = useCallback((removedSong) => {
    const removedId = resolvePlaylistSongId(removedSong);
    setAlbum((prev) => {
      if (!prev?.tracks) return prev;
      return {
        ...prev,
        tracks: prev.tracks.filter((t) => {
          if (removedId && resolvePlaylistSongId(t) === removedId) return false;
          // Fallback for tracks without _id: match videoId.
          const rv = removedSong?.videoId || removedSong?.id;
          const tv = t?.videoId || t?.id;
          if (rv && tv && rv === tv) return false;
          return true;
        }),
        trackCount: Math.max(0, (prev.trackCount ?? prev.tracks.length) - 1),
      };
    });
  }, []);

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
            {userPlaylist ? (
              deleting ? (
                <ActivityIndicator size="small" color={theme.colors.text} />
              ) : (
                <Menu
                  visible={headerMenuVisible}
                  onDismiss={() => setHeaderMenuVisible(false)}
                  anchorPosition="bottom"
                  anchor={
                    <BubbleIcon
                      color={theme.colors.text}
                      name="more-vert"
                      onPress={() => setHeaderMenuVisible(true)}
                    />
                  }
                >
                  <Menu.Item
                    leadingIcon="delete-outline"
                    title="Delete playlist"
                    titleStyle={{ color: '#E94057' }}
                    onPress={confirmDeletePlaylist}
                  />
                </Menu>
              )
            ) : (
              <BubbleIcon color={theme.colors.text} name="more-vert" />
            )}
          </View>
        </BlurImageBg>
        <View style={styles.musicListContainer}>
          <MusicList
            dataset={album.tracks}
            isQueue={true}
            playlistId={userPlaylist ? playlistId : null}
            isUserPlaylist={userPlaylist}
            onSongRemoved={handleSongRemoved}
          />
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

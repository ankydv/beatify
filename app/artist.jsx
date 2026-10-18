import React, { useEffect, useState } from "react";
import {
  View,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Text, useTheme, Button } from "react-native-paper";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useDispatch } from "react-redux";

import { getArtist } from "@/services/artist.service";
import MusicList from "@/components/MusicList";
import BubbleIcon from "@/components/BubbleIcon";
import BlurImageBg from "@/components/BlurImageBg";
import LoadingIndicator from "@/components/LoadingIndicator";
import { loadAndPlayTrack } from "@/state/slices/audio.slice";
import { handleVoiceRoomSongTap } from "@/utils/partyPlayback.utils";

const { width: SCREEN_W } = Dimensions.get("window");

const ArtistScreen = () => {
  const { id } = useLocalSearchParams();
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullBio, setShowFullBio] = useState(false);
  const [scrollY] = useState(new Animated.Value(0));
  const [isScrolled, setIsScrolled] = useState(false);

  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Artist information is not available");
      return;
    }
    setLoading(true);
    getArtist(id)
      .then((data) => {
        setArtist(data);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to load artist:", err);
        setError("Failed to load artist information");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      if (value > 250) {
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

  const playTopSongs = async () => {
    const songs = artist?.songs?.results;
    if (!songs || songs.length === 0) return;
    const handled = await handleVoiceRoomSongTap(songs[0]);
    if (handled) return;
    dispatch(
      loadAndPlayTrack({
        track: songs[0],
        isQueueTrack: true,
        newQueue: { tracks: songs },
      })
    ).unwrap();
  };

  if (loading) {
    return <LoadingIndicator />;
  }

  if (error || !artist) {
    return (
      <SafeAreaView style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
        <BubbleIcon name="arrow-back" size={24} color={theme.colors.text} onPress={handleBack} />
        <View style={styles.errorContent}>
          <Icon name="account-alert" size={50} color={theme.colors.error} />
          <Text variant="titleMedium" style={{ marginTop: 10 }}>
            {error || "Artist not found"}
          </Text>
          <Button mode="contained" onPress={handleBack} style={{ marginTop: 16 }}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const artistThumb =
    artist.thumbnails?.[artist.thumbnails.length - 1]?.url ||
    artist.thumbnails?.[0]?.url;

  const topSongs = artist.songs?.results || [];
  const albums = artist.albums?.results || [];
  const singles = artist.singles?.results || [];
  const related = artist.related?.results || [];

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        {/* ---------------- Hero Section with Artist Avatar & Bio ---------------- */}
        <BlurImageBg uri={artistThumb}>
          <LinearGradient
            colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.7)", theme.colors.background]}
            style={styles.gradientOverlay}
          />
          <View style={styles.heroContent}>
            {artistThumb ? (
              <Image source={{ uri: artistThumb }} style={styles.artistAvatar} />
            ) : (
              <View style={[styles.artistAvatar, styles.avatarFallback]}>
                <Icon name="account-music" size={60} color="#FFFFFF" />
              </View>
            )}

            <Text variant="headlineMedium" style={styles.artistName} numberOfLines={2}>
              {artist.name}
            </Text>

            <View style={styles.statsRow}>
              {artist.subscribers ? (
                <Text style={styles.statsText}>{artist.subscribers}</Text>
              ) : null}
              {artist.monthlyListeners ? (
                <Text style={styles.statsText}> • {artist.monthlyListeners}</Text>
              ) : null}
            </View>

            {/* Action buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.playAllBtn, { backgroundColor: theme.colors.primary }]}
                onPress={playTopSongs}
                activeOpacity={0.8}
              >
                <Icon name="play" size={22} color="#FFFFFF" />
                <Text style={styles.playAllText}>Play Top Songs</Text>
              </TouchableOpacity>

              {artist.radioId ? (
                <TouchableOpacity
                  style={[styles.radioBtn, { backgroundColor: theme.colors.elevation.level2 }]}
                  onPress={() => {
                    router.push({
                      pathname: "/album",
                      params: { id: artist.radioId, isPlaylist: true },
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Icon name="radio" size={20} color={theme.colors.primary} />
                  <Text style={[styles.radioText, { color: theme.colors.onSurface }]}>Artist Radio</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </BlurImageBg>

        {/* ---------------- Top Songs Section ---------------- */}
        {topSongs.length > 0 && (
          <View style={styles.section}>
            <Text variant="titleLarge" style={styles.sectionHeading}>
              Top Songs 🔥
            </Text>
            <MusicList dataset={topSongs} />
          </View>
        )}

        {/* ---------------- Albums Section ---------------- */}
        {albums.length > 0 && (
          <View style={styles.section}>
            <Text variant="titleLarge" style={styles.sectionHeading}>
              Albums 💿
            </Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={albums}
              keyExtractor={(item, idx) => item.browseId || `album_${idx}`}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => {
                const thumb = item.thumbnails?.[item.thumbnails.length - 1]?.url || item.thumbnails?.[0]?.url;
                return (
                  <TouchableOpacity
                    style={styles.cardItem}
                    onPress={() => {
                      router.push({
                        pathname: "/album",
                        params: { id: item.browseId, isPlaylist: false },
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: thumb }} style={styles.cardImage} />
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.year ? (
                      <Text style={styles.cardSubtitle}>{item.year}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        {/* ---------------- Singles & EPs Section ---------------- */}
        {singles.length > 0 && (
          <View style={styles.section}>
            <Text variant="titleLarge" style={styles.sectionHeading}>
              Singles & EPs 🎵
            </Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={singles}
              keyExtractor={(item, idx) => item.browseId || `single_${idx}`}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => {
                const thumb = item.thumbnails?.[item.thumbnails.length - 1]?.url || item.thumbnails?.[0]?.url;
                return (
                  <TouchableOpacity
                    style={styles.cardItem}
                    onPress={() => {
                      router.push({
                        pathname: "/album",
                        params: { id: item.browseId, isPlaylist: false },
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: thumb }} style={styles.cardImage} />
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.year ? (
                      <Text style={styles.cardSubtitle}>{item.year}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        {/* ---------------- Fans Also Like / Similar Artists ---------------- */}
        {related.length > 0 && (
          <View style={styles.section}>
            <Text variant="titleLarge" style={styles.sectionHeading}>
              Fans Also Like ✨
            </Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={related}
              keyExtractor={(item, idx) => item.browseId || `artist_${idx}`}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => {
                const thumb = item.thumbnails?.[item.thumbnails.length - 1]?.url || item.thumbnails?.[0]?.url;
                return (
                  <TouchableOpacity
                    style={styles.relatedArtistItem}
                    onPress={() => {
                      router.push({
                        pathname: "/artist",
                        params: { id: item.browseId },
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: thumb }} style={styles.relatedAvatar} />
                    <Text style={styles.relatedName} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.subscribers ? (
                      <Text style={styles.relatedSubscribers} numberOfLines={1}>
                        {item.subscribers}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        {/* ---------------- About / Description Section ---------------- */}
        {artist.description ? (
          <View style={styles.section}>
            <Text variant="titleLarge" style={styles.sectionHeading}>
              About
            </Text>
            <Text
              style={styles.descriptionText}
              numberOfLines={showFullBio ? undefined : 4}
            >
              {artist.description}
            </Text>
            <TouchableOpacity onPress={() => setShowFullBio(!showFullBio)}>
              <Text style={[styles.readMoreText, { color: theme.colors.primary }]}>
                {showFullBio ? "Read Less" : "Read More"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      {/* ---------------- Top Floating Navigation Bar ---------------- */}
      <SafeAreaView
        style={[styles.topBar, isScrolled && { backgroundColor: theme.colors.surface }]}
        edges={['top']}
      >
        <BubbleIcon
          name="arrow-back"
          size={24}
          color={theme.colors.text}
          onPress={handleBack}
        />
        {isScrolled && (
          <Text style={styles.headerArtistName} numberOfLines={1}>
            {artist.name}
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
    paddingBottom: 40,
  },
  topBar: {
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
  headerArtistName: {
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
  heroContent: {
    alignItems: "center",
    paddingTop: 100,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  artistAvatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.3)",
    marginBottom: 14,
  },
  avatarFallback: {
    backgroundColor: "#333333",
    alignItems: "center",
    justifyContent: "center",
  },
  artistName: {
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statsText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 13,
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    gap: 10,
  },
  playAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  playAllText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
    marginLeft: 6,
  },
  radioBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  radioText: {
    fontWeight: "700",
    fontSize: 14,
    marginLeft: 6,
  },
  section: {
    marginVertical: 14,
  },
  sectionHeading: {
    fontWeight: "800",
    paddingHorizontal: 16,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  horizontalList: {
    paddingHorizontal: 14,
    gap: 12,
  },
  cardItem: {
    width: 130,
    marginRight: 6,
  },
  cardImage: {
    width: 130,
    height: 130,
    borderRadius: 10,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  cardSubtitle: {
    fontSize: 11,
    color: "#888888",
    marginTop: 2,
  },
  relatedArtistItem: {
    width: 110,
    alignItems: "center",
    marginRight: 8,
  },
  relatedAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 6,
  },
  relatedName: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  relatedSubscribers: {
    fontSize: 10,
    color: "#888888",
    textAlign: "center",
    marginTop: 1,
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#888888",
    paddingHorizontal: 16,
  },
  readMoreText: {
    paddingHorizontal: 16,
    marginTop: 6,
    fontWeight: "700",
    fontSize: 13,
  },
  errorContainer: {
    flex: 1,
    padding: 16,
  },
  errorContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ArtistScreen;

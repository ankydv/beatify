import React from "react";
import MusicList from "./MusicList";
import { ScrollView, View, TouchableOpacity, StyleSheet } from "react-native";
import { useDispatch } from "react-redux";
import { loadAndPlayTrack } from "@/state/slices/audio.slice";
import { useRouter } from "expo-router";
import { showUnimplementedFeatureAlert } from "@/utils/alerts.utils";
import { useTheme, Text } from "react-native-paper";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const SearchResults = ({ results, onViewAll, activeFilter = "all" }) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const theme = useTheme();

  const handlePress = (item) => {
    const isAlbum = item.resultType === 'album';
    const isPlaylist = item.resultType === 'playlist';
    const isArtist = item.resultType === 'artist' || Boolean(item.subscribers);

    if (item.videoId) {
      dispatch(loadAndPlayTrack({ track: item }));
      router.push("/player");
    } else if (isArtist) {
      router.push({
        pathname: "/artist",
        params: { id: item.browseId || item.channelId || item.id },
      });
    } else if (isAlbum || isPlaylist) {
      router.push({
        pathname: "/album",
        params: { id: item.browseId || item.playlistId, isPlaylist: Boolean(isPlaylist) },
      });
    } else {
      showUnimplementedFeatureAlert();
    }
  };

  if (!results || results.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="music-box-outline" size={56} color="#888888" style={{ marginBottom: 12 }} />
        <Text variant="titleMedium" style={styles.emptyTitle}>
          Search for music, artists, albums & playlists
        </Text>
        <Text style={styles.emptySubtitle}>
          Try searching for your favorite artist, mood, or song title.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {results.map((group, index) => {
        if (!group.data || group.data.length === 0) return null;
        const categoryName = group.category || "Results";
        const canViewAll = activeFilter === "all" && onViewAll && group.data.length >= 3;

        return (
          <View key={`${categoryName}_${index}`} style={styles.groupContainer}>
            <View style={styles.headerRow}>
              <Text variant="titleMedium" style={styles.categoryTitle}>
                {categoryName}
              </Text>
              {canViewAll ? (
                <TouchableOpacity
                  onPress={() => onViewAll(categoryName)}
                  hitSlop={8}
                  style={styles.viewAllBtn}
                >
                  <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>
                    View All
                  </Text>
                  <Icon name="chevron-right" size={16} color={theme.colors.primary} />
                </TouchableOpacity>
              ) : null}
            </View>

            <MusicList dataset={group.data} onPress={handlePress} />
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  emptySubtitle: {
    color: "#888888",
    fontSize: 13,
    textAlign: "center",
  },
  groupContainer: {
    marginBottom: 16,
    marginTop: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  categoryTitle: {
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    fontWeight: "700",
    fontSize: 13,
  },
});

export default SearchResults;

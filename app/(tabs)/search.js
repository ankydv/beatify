import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, useTheme } from "react-native-paper";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

import SearchBox from "@/components/searchBox";
import SearchResults from "@/components/searchResults";
import musicApi from "@/configs/apiClient.config";

const SEARCH_FILTERS = [
  { id: "all", label: "All" },
  { id: "songs", label: "Songs" },
  { id: "artists", label: "Artists" },
  { id: "albums", label: "Albums" },
  { id: "playlists", label: "Playlists" },
  { id: "videos", label: "Videos" },
];

const Search = () => {
  const theme = useTheme();
  const [results, setResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  const fetchResults = useCallback(async (query, filter = "all") => {
    if (!query || !query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const params = {};
      if (filter && filter !== "all") {
        params.filter = filter;
      }

      const response = await musicApi.get(`/search/${encodeURIComponent(query.trim())}`, {
        params,
      });

      const raw = response.data || [];
      setResults(rearrangeResponse(raw, filter));
    } catch (error) {
      console.error("Error fetching search results:", error?.response?.data || error.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const rearrangeResponse = (res, currentFilter) => {
    if (!Array.isArray(res)) return [];

    // If a specific category filter was applied, group everything into that single category
    if (currentFilter && currentFilter !== "all") {
      const matchedFilter = SEARCH_FILTERS.find((f) => f.id === currentFilter);
      const categoryTitle = matchedFilter ? matchedFilter.label : "Results";
      return [{ category: categoryTitle, data: res }];
    }

    // Default mixed response grouping
    return res.reduce((acc, item) => {
      var { category, ...rest } = item;
      if (category === "Profiles") return acc;
      if (category == null) {
        const temp = item.resultType || "Other";
        category = temp.charAt(0).toUpperCase() + temp.slice(1) + "s";
      }
      const existingIndex = acc.findIndex((group) => group.category === category);

      if (existingIndex !== -1) {
        acc[existingIndex].data.push(rest);
      } else {
        acc.push({ category, data: [rest] });
      }

      return acc;
    }, []);
  };

  const onSubmit = (value) => {
    setSearchQuery(value);
    fetchResults(value, activeFilter);
  };

  const handleFilterChange = (filterId) => {
    setActiveFilter(filterId);
    if (searchQuery.trim()) {
      fetchResults(searchQuery, filterId);
    }
  };

  const handleViewAll = (categoryName) => {
    const catLower = (categoryName || "").toLowerCase();
    let targetFilter = "all";
    if (catLower.includes("song")) targetFilter = "songs";
    else if (catLower.includes("artist")) targetFilter = "artists";
    else if (catLower.includes("album")) targetFilter = "albums";
    else if (catLower.includes("playlist")) targetFilter = "playlists";
    else if (catLower.includes("video")) targetFilter = "videos";

    setActiveFilter(targetFilter);
    if (searchQuery.trim()) {
      fetchResults(searchQuery, targetFilter);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top"]}>
      {/* Search Input Box */}
      <SearchBox onSubmit={onSubmit} />

      {/* Filter Chips Bar */}
      <View style={styles.filterBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {SEARCH_FILTERS.map((f) => {
            const isActive = activeFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => handleFilterChange(f.id)}
                activeOpacity={0.75}
                style={[
                  styles.filterChip,
                  isActive
                    ? [styles.filterChipActive, { backgroundColor: theme.colors.primary }]
                    : [styles.filterChipInactive, { backgroundColor: theme.colors.elevation.level1 }],
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive
                      ? styles.filterChipTextActive
                      : { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Active Filter Pill / Reset Button */}
      {activeFilter !== "all" && (
        <View style={styles.activeFilterPillRow}>
          <Text style={styles.activeFilterPillText}>
            Showing all {SEARCH_FILTERS.find((f) => f.id === activeFilter)?.label}
          </Text>
          <TouchableOpacity
            onPress={() => handleFilterChange("all")}
            style={styles.resetFilterBtn}
          >
            <Icon name="close-circle" size={16} color={theme.colors.primary} />
            <Text style={[styles.resetFilterText, { color: theme.colors.primary }]}>
              Show All Categories
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results or Loading */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : (
        <SearchResults
          results={results}
          onViewAll={handleViewAll}
          activeFilter={activeFilter}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterBarWrapper: {
    paddingVertical: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 6,
  },
  filterChipActive: {},
  filterChipInactive: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  activeFilterPillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  activeFilterPillText: {
    fontSize: 12,
    color: "#888888",
    fontWeight: "600",
  },
  resetFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: "700",
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: "#888888",
  },
});

export default Search;

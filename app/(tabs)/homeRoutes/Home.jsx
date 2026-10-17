import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';

import {
  getHome,
  getMoodCategories,
  getMoodPlaylists,
  getCharts,
} from '@/services/explore.service';
import PlaylistRow from '@/components/PlaylistRow';
import QuickPicks from '@/components/QuickPicks';
import LoadingIndicator from '@/components/LoadingIndicator';

const { width: SCREEN_W } = Dimensions.get('window');

const DEFAULT_MOOD_FILTERS = [
  { id: 'all', title: '✨ All' },
  { id: 'chill', title: '☕ Chill', params: 'ggMPOg1uX1JOQWZFeDByc2Jm' },
  { id: 'party', title: '🎉 Party', params: 'ggMPOg1uX3VOQWxsblVZTFNE' },
  { id: 'energize', title: '⚡ Energize', params: 'ggMPOg1uX2lRZUZiMnNrQnJW' },
  { id: 'focus', title: '🎧 Focus', params: 'ggMPOg1uX044Z2o5WERLckpU' },
  { id: 'workout', title: '💪 Workout', params: 'ggMPOg1uX0UzWGxlRE5jMDVk' },
  { id: 'romance', title: '❤️ Romance', params: 'ggMPOg1uX1ZEZzBvYUp0TGNI' },
  { id: 'bollywood', title: '🪕 Bollywood', params: 'ggMPOg1uX3VOQWxsblVZTFNE' },
  { id: 'hiphop', title: '🎤 Hip-Hop', params: 'ggMPOg1uX2lRZUZiMnNrQnJW' },
  { id: 'electronic', title: '🎛️ EDM', params: 'ggMPOg1uX0UzWGxlRE5jMDVk' },
];

const HomeScreen = () => {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useUser();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMood, setSelectedMood] = useState('all');
  const [moodPlaylists, setMoodPlaylists] = useState(null);
  const [moodLoading, setMoodLoading] = useState(false);
  const [charts, setCharts] = useState(null);
  const [moodFilters, setMoodFilters] = useState(DEFAULT_MOOD_FILTERS);

  // Greeting based on time
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good Morning ☀️';
    if (hours < 18) return 'Good Afternoon 🌤️';
    return 'Good Evening 🌙';
  };

  const displayName = user?.firstName || user?.username || 'Vibe Seeker';

  // Fetch initial home data & moods
  const fetchData = useCallback(async (force = false) => {
    try {
      const [homeData, moodCategories, chartsData] = await Promise.allSettled([
        getHome(force),
        getMoodCategories(),
        getCharts('IN'),
      ]);

      if (homeData.status === 'fulfilled' && homeData.value) {
        setData(homeData.value);
      }

      if (moodCategories.status === 'fulfilled' && moodCategories.value) {
        const moodsAndMoments = moodCategories.value['Moods & moments'] || [];
        const genres = moodCategories.value['Genres'] || [];

        const dynamicFilters = [
          { id: 'all', title: '✨ All' },
          ...moodsAndMoments.slice(0, 6).map((m) => ({
            id: m.title.toLowerCase().replace(/\s+/g, '_'),
            title: m.title,
            params: m.params,
          })),
          ...genres.slice(0, 6).map((g) => ({
            id: g.title.toLowerCase().replace(/\s+/g, '_'),
            title: g.title,
            params: g.params,
          })),
        ];
        if (dynamicFilters.length > 1) {
          setMoodFilters(dynamicFilters);
        }
      }

      if (chartsData.status === 'fulfilled' && chartsData.value) {
        setCharts(chartsData.value);
      }
    } catch (err) {
      console.warn('Failed to load home data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(true);
    if (selectedMood !== 'all') {
      const current = moodFilters.find((m) => m.id === selectedMood);
      if (current?.params) {
        await handleMoodSelect(current);
      }
    }
    setRefreshing(false);
  }, [fetchData, selectedMood, moodFilters]);

  // Handle Mood/Genre Filter Select
  const handleMoodSelect = async (filter) => {
    setSelectedMood(filter.id);
    if (filter.id === 'all') {
      setMoodPlaylists(null);
      return;
    }

    if (filter.params) {
      setMoodLoading(true);
      try {
        const playlists = await getMoodPlaylists(filter.params, 25);
        setMoodPlaylists(playlists || []);
      } catch (err) {
        console.warn('Failed to fetch mood playlists:', err);
        setMoodPlaylists([]);
      } finally {
        setMoodLoading(false);
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* ----------------- Top Header ----------------- */}
      <View style={styles.topHeader}>
        <View style={styles.userSection}>
          <Text variant="titleMedium" style={styles.greetingText}>
            {getGreeting()}
          </Text>
          <Text variant="headlineSmall" style={styles.userNameText}>
            {displayName}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.partyIconBadge}
            onPress={() => router.push('/(tabs)/party')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#8A2387', '#E94057', '#F27121']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.partyBadgeGradient}
            >
              <Icon name="party-popper" size={18} color="#FFFFFF" />
              <Text style={styles.partyBadgeText}>Party</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* ----------------- Moods & Genres Interactive Bar ----------------- */}
      <View style={styles.moodBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.moodScrollContent}
        >
          {moodFilters.map((filter) => {
            const isActive = selectedMood === filter.id;
            return (
              <TouchableOpacity
                key={filter.id}
                onPress={() => handleMoodSelect(filter)}
                activeOpacity={0.7}
                style={[
                  styles.moodChip,
                  isActive
                    ? [styles.moodChipActive, { backgroundColor: theme.colors.primary }]
                    : [styles.moodChipInactive, { backgroundColor: theme.colors.elevation.level1 }],
                ]}
              >
                <Text
                  style={[
                    styles.moodChipText,
                    isActive ? styles.moodChipTextActive : { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {filter.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ----------------- Main Content Feed ----------------- */}
      {loading ? (
        <LoadingIndicator />
      ) : (
        <ScrollView
          style={styles.feedScroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        >
          {/* Spotlight Collaborative Party Banner */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push('/(tabs)/party')}
            style={styles.bannerWrapper}
          >
            <LinearGradient
              colors={['#1c0c2e', '#3a1c71', '#d76d77', '#ffaf7b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.partyBanner}
            >
              <View style={styles.bannerContent}>
                <View style={styles.liveTagRow}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.liveTagText}>LIVE COLLAB ROOMS</Text>
                </View>
                <Text style={styles.bannerTitle}>Sync the Vibe with Friends</Text>
                <Text style={styles.bannerSubtitle}>
                  Create a room, vote on queues, voice chat, and broadcast reactions in real-time.
                </Text>

                <View style={styles.bannerActionRow}>
                  <View style={styles.bannerButton}>
                    <Text style={styles.bannerButtonText}>Enter Party Hub</Text>
                    <Icon name="arrow-right" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  </View>
                </View>
              </View>
              <Icon name="radiobox-marked" size={120} color="rgba(255, 255, 255, 0.08)" style={styles.bannerBgIcon} />
            </LinearGradient>
          </TouchableOpacity>

          {/* Active Mood Category Content */}
          {selectedMood !== 'all' && (
            <View style={styles.moodSectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text variant="titleLarge" style={styles.sectionTitle}>
                  {moodFilters.find((m) => m.id === selectedMood)?.title} Playlists
                </Text>
                <TouchableOpacity onPress={() => handleMoodSelect({ id: 'all' })}>
                  <Text style={[styles.clearFilterText, { color: theme.colors.primary }]}>
                    Show All
                  </Text>
                </TouchableOpacity>
              </View>

              {moodLoading ? (
                <View style={styles.moodLoaderBox}>
                  <ActivityIndicator color={theme.colors.primary} size="small" />
                  <Text style={styles.loadingMoodText}>Curating your mood vibe...</Text>
                </View>
              ) : moodPlaylists && moodPlaylists.length > 0 ? (
                <PlaylistRow
                  items={moodPlaylists}
                  title={`${selectedMood} mood playlists`}
                />
              ) : (
                <Text style={styles.emptyMoodText}>No playlists found for this mood.</Text>
              )}
            </View>
          )}

          {/* Charts Preview Section */}
          {charts?.videos?.items && charts.videos.items.length > 0 && selectedMood === 'all' && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.titleWithIcon}>
                  <Icon name="chart-bell-curve-cumulative" size={20} color="#FF6584" style={{ marginRight: 6 }} />
                  <Text variant="titleLarge" style={styles.sectionTitle}>
                    Top Trending Charts
                  </Text>
                </View>
              </View>
              <PlaylistRow
                items={charts.videos.items.slice(0, 10).map((v) => ({
                  title: v.title,
                  videoId: v.videoId || v.id,
                  subtitle: v.artists?.map((a) => a.name).join(', ') || 'Trending',
                  thumbnails: v.thumbnails || [],
                }))}
                title="trending charts"
              />
            </View>
          )}

          {/* Regular Home Feed Sections */}
          {data?.map((section, index) => {
            if (!section.contents || section.contents.length === 0) return null;
            return (
              <View key={index} style={styles.section}>
                <Text variant="titleLarge" style={styles.sectionTitle}>
                  {section.title}
                </Text>
                {section.title !== 'Quick picks' ? (
                  <PlaylistRow
                    items={section.contents}
                    title={section.title.toLowerCase()}
                  />
                ) : (
                  <QuickPicks data={section.contents} />
                )}
              </View>
            );
          })}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  userSection: {
    flex: 1,
  },
  greetingText: {
    fontSize: 13,
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  userNameText: {
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partyIconBadge: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  partyBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  partyBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 5,
  },
  moodBarWrapper: {
    paddingVertical: 6,
  },
  moodScrollContent: {
    paddingHorizontal: 14,
    gap: 8,
  },
  moodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 6,
  },
  moodChipActive: {},
  moodChipInactive: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  moodChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  moodChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  feedScroll: {
    flex: 1,
  },
  bannerWrapper: {
    marginHorizontal: 14,
    marginVertical: 10,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  partyBanner: {
    padding: 18,
    position: 'relative',
    borderRadius: 16,
  },
  bannerContent: {
    zIndex: 2,
  },
  liveTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginRight: 6,
  },
  liveTagText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  bannerSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
    maxWidth: SCREEN_W - 80,
  },
  bannerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  bannerButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  bannerBgIcon: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    zIndex: 1,
  },
  section: {
    marginVertical: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: '800',
    marginLeft: 10,
    letterSpacing: 0.2,
  },
  clearFilterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  moodSectionContainer: {
    marginVertical: 8,
  },
  moodLoaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingMoodText: {
    fontSize: 13,
    color: '#888888',
  },
  emptyMoodText: {
    marginLeft: 14,
    color: '#888888',
    fontStyle: 'italic',
  },
});

export default HomeScreen;

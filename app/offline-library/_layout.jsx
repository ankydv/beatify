/**
 * Offline Library Management Screen Component
 * Shows all downloaded tracks and provides management options
 * 
 * Usage:
 * <Stack.Screen name="offline-library" component={OfflineLibraryScreen} />
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import { useNavigation, useRouter } from 'expo-router';
import useOfflineTrack from '@/hooks/offline.hooks';
import { loadAndPlayTrack } from '@/state/slices/audio.slice';
import {
  getOfflineStorageUsage,
  clearAllOfflineTracks,
  getOfflineLyrics,
} from '@/services/offline.service';
import { parseSyncedLyrics } from '@/utils/lyrics.utils';

const OfflineLibraryScreen = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const router = useRouter();
  const [offlineTracks, setOfflineTracks] = useState([]);
  const [storageUsage, setStorageUsage] = useState('0');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isPlayingIndex, setIsPlayingIndex] = useState(null);
  const navigate = useNavigation();

  const {
    getAllOfflineTracks,
    removeOfflineTrack,
    refreshOfflineTracksCount,
    getLyricsOffline,
  } = useOfflineTrack();

  // Fetch offline tracks and storage usage
  const loadOfflineData = useCallback(async () => {
    try {
      setIsLoading(true);
      const tracks = await getAllOfflineTracks();
      const usage = await getOfflineStorageUsage();
      
      setOfflineTracks(tracks || []);
      setStorageUsage(usage);
    } catch (error) {
      console.error('Error loading offline data:', error);
      Alert.alert('Error', 'Failed to load offline tracks');
    } finally {
      setIsLoading(false);
    }
  }, [getAllOfflineTracks]);

  // Initial load
  useEffect(() => {
    loadOfflineData();
  }, [loadOfflineData]);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadOfflineData();
    setIsRefreshing(false);
  }, [loadOfflineData]);

  // Handle delete single track
  const handleDeleteTrack = useCallback(
    (videoId, title) => {
      Alert.alert(
        'Remove Track',
        `Are you sure you want to remove "${title}" from offline storage?`,
        [
          {
            text: 'Cancel',
            onPress: () => {},
            style: 'cancel',
          },
          {
            text: 'Delete',
            onPress: async () => {
              try {
                await removeOfflineTrack(videoId);
                await loadOfflineData();
              } catch (error) {
                Alert.alert('Error', 'Failed to delete track');
              }
            },
            style: 'destructive',
          },
        ]
      );
    },
    [removeOfflineTrack, loadOfflineData]
  );

  // Handle play track
  const handlePlayTrack = useCallback(
    async (track, index) => {
      try {
        setIsPlayingIndex(index);

        // Get offline lyrics if available
        let offlineLyrics = null;
        try {
          offlineLyrics = await getLyricsOffline(track.videoId);
        } catch (error) {
          console.warn('Could not fetch offline lyrics:', error);
        }

        // Prepare track object for Redux
        const trackToPlay = {
          videoId: track.videoId,
          title: track.title,
          artist: track.artist,
          thumbnail: track.artwork,
        };

        // Dispatch play action
        const tracks = await getAllOfflineTracks();
        await dispatch(
          loadAndPlayTrack({ track: trackToPlay, isQueueTrack: true, newQueue: { tracks: tracks } })
        ).unwrap();
        navigate.navigate('player');
        // If offline lyrics exist, they'll be set by the slice
        // Otherwise the slice will fetch them

        // Navigate to player
        router.push('player');
      } catch (error) {
        console.error('Error playing track:', error);
        Alert.alert('Error', 'Failed to play track');
      } finally {
        setIsPlayingIndex(null);
      }
    },
    [dispatch, router, getLyricsOffline]
  );

  // Handle clear all
  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear All Offline Tracks',
      'This will remove all downloaded tracks and free up storage. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Delete All',
          onPress: async () => {
            try {
              setIsClearing(true);
              await clearAllOfflineTracks();
              await loadOfflineData();
              Alert.alert('Success', 'All offline tracks have been removed');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear offline tracks');
            } finally {
              setIsClearing(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  }, [loadOfflineData]);

  // Render empty state
  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
          style={styles.loader}
        />
      </View>
    );
  }

  if (offlineTracks.length === 0) {
    return (
      <View
        style={[
          styles.container,
          styles.emptyContainer,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Icon
          name="cloud-download-outline"
          size={64}
          color={theme.colors.primary}
          style={styles.emptyIcon}
        />
        <Text
          style={[
            styles.emptyText,
            { color: theme.colors.onBackground },
          ]}
        >
          No Offline Tracks
        </Text>
        <Text
          style={[
            styles.emptySubtext,
            { color: theme.colors.onBackground },
          ]}
        >
          Download tracks from the player to listen offline
        </Text>
      </View>
    );
  }

  // Render track item
  const renderTrackItem = ({ item, index }) => (
    <TouchableOpacity
      onPress={() => handlePlayTrack(item, index)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.trackItem,
          { borderBottomColor: theme.colors.surfaceVariant },
        ]}
      >
        <Image
          source={{ uri: item.artwork }}
          style={styles.trackArtwork}
        />
        <View style={styles.trackInfo}>
          <Text
            style={[
              styles.trackTitle,
              { color: theme.colors.onBackground },
            ]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text
            style={[
              styles.trackArtist,
              { color: theme.colors.onBackground },
            ]}
            numberOfLines={1}
          >
            {item.artist}
          </Text>
          <Text style={styles.downloadedDate}>
            Downloaded: {new Date(item.downloadedAt).toLocaleDateString()}
          </Text>
        </View>
        {isPlayingIndex === index ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <>
            <TouchableOpacity
              onPress={() => handlePlayTrack(item, index)}
              style={styles.playButton}
            >
              <Icon name="play" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteTrack(item.videoId, item.title)}
              style={styles.deleteButton}
            >
              <Icon name="delete" size={24} color="#FF6B6B" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background },
      ]}
    >
      {/* Header with Storage Info */}
      <View
        style={[
          styles.headerCard,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <View style={styles.storageInfo}>
          <Icon
            name="database"
            size={32}
            color={theme.colors.primary}
          />
          <View style={styles.storageDetails}>
            <Text
              style={[
                styles.storageLabel,
                { color: theme.colors.onBackground },
              ]}
            >
              Storage Used
            </Text>
            <Text
              style={[
                styles.storageValue,
                { color: theme.colors.primary },
              ]}
            >
              {storageUsage} MB
            </Text>
          </View>
        </View>
        <View style={styles.trackCount}>
          <Text
            style={[
              styles.countLabel,
              { color: theme.colors.onBackground },
            ]}
          >
            Tracks Downloaded
          </Text>
          <Text
            style={[
              styles.countValue,
              { color: theme.colors.primary },
            ]}
          >
            {offlineTracks.length}
          </Text>
        </View>
      </View>

      {/* Tracks List */}
      <FlatList
        data={offlineTracks}
        renderItem={renderTrackItem}
        keyExtractor={(item) => item.videoId}
        style={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        scrollEnabled={true}
      />

      {/* Clear All Button */}
      {offlineTracks.length > 0 && (
        <TouchableOpacity
          onPress={handleClearAll}
          disabled={isClearing}
          style={[
            styles.clearButton,
            {
              backgroundColor: isClearing
                ? theme.colors.surfaceVariant
                : '#FF6B6B',
            },
          ]}
        >
          {isClearing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Icon
                name="delete-sweep"
                size={20}
                color="white"
                style={styles.clearButtonIcon}
              />
              <Text style={styles.clearButtonText}>
                Clear All ({offlineTracks.length})
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 20,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    opacity: 0.7,
  },
  headerCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  storageDetails: {
    marginLeft: 12,
  },
  storageLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  storageValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  trackCount: {
    alignItems: 'flex-end',
  },
  countLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  countValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  list: {
    flex: 1,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  trackArtwork: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  trackArtist: {
    fontSize: 12,
    marginBottom: 4,
  },
  downloadedDate: {
    fontSize: 11,
    opacity: 0.6,
    color: '#888',
  },
  deleteButton: {
    padding: 8,
  },
  playButton: {
    padding: 8,
    marginRight: 4,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 14,
    borderRadius: 8,
  },
  clearButtonIcon: {
    marginRight: 8,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loader: {
    flex: 1,
  },
});

export default OfflineLibraryScreen;

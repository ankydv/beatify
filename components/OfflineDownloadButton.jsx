import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from 'react-native-paper';
import useOfflineTrack from '@/hooks/offline.hooks';

/**
 * Download Button Component - Add to track player UI
 * Usage:
 * <OfflineDownloadButton
 *   videoId={track.videoId}
 *   streamingUrl={streamingUrl}
 *   title={track.title}
 *   artist={track.artist}
 *   artwork={track.artwork}
 *   duration={track.duration}
 *   lyrics={lyrics}
 * />
 */
const OfflineDownloadButton = ({
  videoId,
  streamingUrl,
  streamHeaders = {},
  title,
  artist,
  artwork,
  duration,
  lyrics,
  onDownloadComplete = () => {},
}) => {
  const theme = useTheme();
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const {
    isDownloading,
    downloadProgress,
    checkIfDownloaded,
    downloadForOffline,
    removeOfflineTrack,
    saveLyricsOffline,
    deleteLyricsOffline,
  } = useOfflineTrack();

  // Check if track is already downloaded when component mounts
  useEffect(() => {
    const checkDownloadStatus = async () => {
      setIsChecking(true);
      try {
        const downloaded = await checkIfDownloaded(videoId);
        setIsDownloaded(downloaded);
      } catch (error) {
        console.error('Error checking download status:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkDownloadStatus();
  }, [videoId, checkIfDownloaded]);

  const handleDownload = async () => {
    try {
      if (isDownloaded) {
        // Remove offline track
        Alert.alert(
          'Remove Offline',
          'Are you sure you want to remove this track from offline storage?',
          [
            {
              text: 'Cancel',
              onPress: () => {},
              style: 'cancel',
            },
            {
              text: 'Remove',
              onPress: async () => {
                await removeOfflineTrack(videoId);
                await deleteLyricsOffline(videoId);
                setIsDownloaded(false);
              },
            },
          ]
        );
      } else {
        // Download for offline (fresh URL + browser headers so googlevideo
        // doesn't 403; downloadTrack re-fetches if the URL expired).
        await downloadForOffline(
          streamingUrl,
          videoId,
          title,
          artist,
          artwork,
          duration,
          streamHeaders
        );

        // Save lyrics offline if available
        if (lyrics) {
          try {
            await saveLyricsOffline(videoId, lyrics);
          } catch (error) {
            console.warn('Could not save lyrics offline:', error);
          }
        }

        setIsDownloaded(true);
        onDownloadComplete();
        Alert.alert('Success', 'Track saved for offline listening');
      }
    } catch (error) {
      console.error('Error handling download:', error);
      Alert.alert('Error', 'Failed to download track for offline');
    }
  };

  if (isChecking) {
    return (
      <ActivityIndicator
        size="medium"
        color={theme.colors.primary}
        style={styles.loader}
      />
    );
  }

  if (isDownloading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="medium" color={theme.colors.primary} />
        <Text style={[styles.progressText, { color: theme.colors.primary }]}>
          {downloadProgress}%
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleDownload}
      style={styles.button}
      disabled={isDownloading}
    >
      <Icon
        name={isDownloaded ? 'cloud-check' : 'cloud-download'}
        size={35}
        color={isDownloaded ? '#4CAF50' : 'white'}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    padding: 8,
  },
  loader: {
    padding: 8,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default OfflineDownloadButton;

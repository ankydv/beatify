import { useState, useCallback } from 'react';
import {
  downloadTrack,
  saveTrackMetadata,
  getTrackOfflineMetadata,
  isTrackDownloaded,
  deleteOfflineTrack,
  getOfflineTracksMetadata,
  saveOfflineLyrics,
  getOfflineLyrics,
  deleteOfflineLyrics,
} from '@/services/offline.service';

export const useOfflineTrack = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [offlineTracksCount, setOfflineTracksCount] = useState(0);

  // Initialize and fetch offline tracks count
  const refreshOfflineTracksCount = useCallback(async () => {
    try {
      const metadata = await getOfflineTracksMetadata();
      setOfflineTracksCount(metadata.length);
    } catch (error) {
      console.error('Error refreshing offline tracks count:', error);
    }
  }, []);

  // Download and save a track for offline use
  const downloadForOffline = useCallback(
    async (streamingUrl, videoId, title, artist, artwork, duration, streamHeaders = {}) => {
      setIsDownloading(true);
      setDownloadProgress(0);

      try {
        // Download the track
        const downloadResult = await downloadTrack(
          streamingUrl,
          videoId,
          title,
          (progress) => {
            setDownloadProgress(progress);
          },
          streamHeaders
        );

        // Save metadata
        await saveTrackMetadata(
          videoId,
          title,
          artist,
          artwork,
          downloadResult.localPath,
          duration
        );

        setIsDownloading(false);
        await refreshOfflineTracksCount();

        return downloadResult;
      } catch (error) {
        console.error('Error downloading track for offline:', error);
        setIsDownloading(false);
        throw error;
      }
    },
    [refreshOfflineTracksCount]
  );

  // Check if track is available offline
  const checkIfDownloaded = useCallback(async (videoId) => {
    try {
      return await isTrackDownloaded(videoId);
    } catch (error) {
      console.error('Error checking if track is downloaded:', error);
      return false;
    }
  }, []);

  // Get offline track metadata
  const getOfflineTrack = useCallback(async (videoId) => {
    try {
      return await getTrackOfflineMetadata(videoId);
    } catch (error) {
      console.error('Error getting offline track metadata:', error);
      return null;
    }
  }, []);

  // Remove offline track
  const removeOfflineTrack = useCallback(
    async (videoId) => {
      try {
        const result = await deleteOfflineTrack(videoId);
        await refreshOfflineTracksCount();
        return result;
      } catch (error) {
        console.error('Error removing offline track:', error);
        throw error;
      }
    },
    [refreshOfflineTracksCount]
  );

  // Get all offline tracks
  const getAllOfflineTracks = useCallback(async () => {
    try {
      return await getOfflineTracksMetadata();
    } catch (error) {
      console.error('Error getting all offline tracks:', error);
      return [];
    }
  }, []);

  // Save offline lyrics
  const saveLyricsOffline = useCallback(async (videoId, lyrics) => {
    try {
      return await saveOfflineLyrics(videoId, lyrics);
    } catch (error) {
      console.error('Error saving offline lyrics:', error);
      throw error;
    }
  }, []);

  // Get offline lyrics
  const getLyricsOffline = useCallback(async (videoId) => {
    try {
      return await getOfflineLyrics(videoId);
    } catch (error) {
      console.error('Error getting offline lyrics:', error);
      return null;
    }
  }, []);

  // Delete offline lyrics
  const deleteLyricsOffline = useCallback(async (videoId) => {
    try {
      return await deleteOfflineLyrics(videoId);
    } catch (error) {
      console.error('Error deleting offline lyrics:', error);
      throw error;
    }
  }, []);

  return {
    isDownloading,
    downloadProgress,
    offlineTracksCount,
    downloadForOffline,
    checkIfDownloaded,
    getOfflineTrack,
    removeOfflineTrack,
    getAllOfflineTracks,
    refreshOfflineTracksCount,
    saveLyricsOffline,
    getLyricsOffline,
    deleteLyricsOffline,
  };
};

export default useOfflineTrack;

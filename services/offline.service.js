import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Offline storage constants
const OFFLINE_STORAGE_DIR = FileSystem.documentDirectory + 'beatify_offline/';
const OFFLINE_TRACKS_METADATA_KEY = 'offline_tracks_metadata';
const OFFLINE_LYRICS_KEY = 'offline_lyrics';

// Ensure offline directory exists
export const ensureOfflineDirectoryExists = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(OFFLINE_STORAGE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(OFFLINE_STORAGE_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('Error creating offline directory:', error);
    throw error;
  }
};

// Generate unique filename for track
const generateTrackFilename = (videoId, title) => {
  // Sanitize title for filename
  const sanitizedTitle = title
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()
    .slice(0, 30);
  return `${videoId}_${sanitizedTitle}.m4a`;
};

// Download track from streaming URL
export const downloadTrack = async (
  streamingUrl,
  videoId,
  trackTitle,
  onProgress
) => {
  try {
    await ensureOfflineDirectoryExists();

    const filename = generateTrackFilename(videoId, trackTitle);
    const downloadDest = OFFLINE_STORAGE_DIR + filename;

    // Check if file already exists
    const fileInfo = await FileSystem.getInfoAsync(downloadDest);
    if (fileInfo.exists) {
      console.log('Track already downloaded:', filename);
      return {
        localPath: downloadDest,
        filename,
        isDownloaded: true,
      };
    }

    console.log('Starting download:', filename);

    // Create a download task with progress tracking
    const downloadTask = FileSystem.createDownloadResumable(
      streamingUrl,
      downloadDest,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        console.log(downloadProgress.totalBytesWritten, downloadProgress.totalBytesExpectedToWrite);
        if (onProgress) {
          onProgress(Math.round(progress * 100));
        }
      }
    );

    const downloadResult = await downloadTask.downloadAsync();

    if (downloadResult && downloadResult.uri) {
      console.log('Track downloaded successfully:', downloadResult.uri);
      return {
        localPath: downloadResult.uri,
        filename,
        isDownloaded: true,
      };
    }

    throw new Error('Download failed without error');
  } catch (error) {
    console.error('Error downloading track:', error);
    throw error;
  }
};

// Save track metadata for offline library
export const saveTrackMetadata = async (
  videoId,
  title,
  artist,
  artwork,
  localPath,
  duration
) => {
  try {
    const existingMetadata = await getOfflineTracksMetadata();

    const trackMetadata = {
      videoId,
      title,
      artist,
      artwork,
      localPath,
      duration,
      downloadedAt: new Date().toISOString(),
    };

    // Check if track already exists
    const existingTrackIndex = existingMetadata.findIndex(
      (track) => track.videoId === videoId
    );

    if (existingTrackIndex >= 0) {
      existingMetadata[existingTrackIndex] = trackMetadata;
    } else {
      existingMetadata.push(trackMetadata);
    }

    await AsyncStorage.setItem(
      OFFLINE_TRACKS_METADATA_KEY,
      JSON.stringify(existingMetadata)
    );

    return trackMetadata;
  } catch (error) {
    console.error('Error saving track metadata:', error);
    throw error;
  }
};

// Get all offline tracks metadata
export const getOfflineTracksMetadata = async () => {
  try {
    const metadata = await AsyncStorage.getItem(OFFLINE_TRACKS_METADATA_KEY);
    return metadata ? JSON.parse(metadata) : [];
  } catch (error) {
    console.error('Error retrieving offline tracks metadata:', error);
    return [];
  }
};

// Get specific track metadata
export const getTrackOfflineMetadata = async (videoId) => {
  try {
    const allMetadata = await getOfflineTracksMetadata();
    return allMetadata.find((track) => track.videoId === videoId);
  } catch (error) {
    console.error('Error retrieving track metadata:', error);
    return null;
  }
};

// Check if track is downloaded
export const isTrackDownloaded = async (videoId) => {
  try {
    const metadata = await getTrackOfflineMetadata(videoId);
    if (!metadata) return false;

    const fileInfo = await FileSystem.getInfoAsync(metadata.localPath);
    return fileInfo.exists;
  } catch (error) {
    console.error('Error checking if track is downloaded:', error);
    return false;
  }
};

// Delete offline track
export const deleteOfflineTrack = async (videoId) => {
  try {
    const metadata = await getTrackOfflineMetadata(videoId);
    if (!metadata) {
      console.warn('Track metadata not found:', videoId);
      return false;
    }

    // Delete file from storage
    await FileSystem.deleteAsync(metadata.localPath, { idempotent: true });

    // Remove from metadata
    const allMetadata = await getOfflineTracksMetadata();
    const updatedMetadata = allMetadata.filter(
      (track) => track.videoId !== videoId
    );

    await AsyncStorage.setItem(
      OFFLINE_TRACKS_METADATA_KEY,
      JSON.stringify(updatedMetadata)
    );

    // Also delete associated lyrics
    await deleteOfflineLyrics(videoId);

    console.log('Track deleted:', videoId);
    return true;
  } catch (error) {
    console.error('Error deleting offline track:', error);
    throw error;
  }
};

// Get offline storage usage in MB
export const getOfflineStorageUsage = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(OFFLINE_STORAGE_DIR);
    if (!dirInfo.exists) return 0;

    const files = await FileSystem.readDirectoryAsync(OFFLINE_STORAGE_DIR);
    let totalSize = 0;

    for (const file of files) {
      const fileInfo = await FileSystem.getInfoAsync(
        OFFLINE_STORAGE_DIR + file
      );
      if (fileInfo.size) {
        totalSize += fileInfo.size;
      }
    }

    return (totalSize / (1024 * 1024)).toFixed(2); // Convert to MB
  } catch (error) {
    console.error('Error getting storage usage:', error);
    return 0;
  }
};

// Clear all offline tracks
export const clearAllOfflineTracks = async () => {
  try {
    await FileSystem.deleteAsync(OFFLINE_STORAGE_DIR, { idempotent: true });
    await AsyncStorage.removeItem(OFFLINE_TRACKS_METADATA_KEY);
    await AsyncStorage.removeItem(OFFLINE_LYRICS_KEY);
    console.log('All offline tracks cleared');
    return true;
  } catch (error) {
    console.error('Error clearing offline tracks:', error);
    throw error;
  }
};

// Save lyrics for offline track
export const saveOfflineLyrics = async (videoId, lyrics) => {
  try {
    const allLyrics = await AsyncStorage.getItem(OFFLINE_LYRICS_KEY);
    const lyricsMap = allLyrics ? JSON.parse(allLyrics) : {};

    lyricsMap[videoId] = {
      syncedLyrics: lyrics?.syncedLyrics,
      plainLyrics: lyrics?.plainLyrics,
      savedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(OFFLINE_LYRICS_KEY, JSON.stringify(lyricsMap));
    return lyricsMap[videoId];
  } catch (error) {
    console.error('Error saving offline lyrics:', error);
    throw error;
  }
};

// Get offline lyrics
export const getOfflineLyrics = async (videoId) => {
  try {
    const allLyrics = await AsyncStorage.getItem(OFFLINE_LYRICS_KEY);
    const lyricsMap = allLyrics ? JSON.parse(allLyrics) : {};
    return lyricsMap[videoId] || null;
  } catch (error) {
    console.error('Error getting offline lyrics:', error);
    return null;
  }
};

// Delete offline lyrics
export const deleteOfflineLyrics = async (videoId) => {
  try {
    const allLyrics = await AsyncStorage.getItem(OFFLINE_LYRICS_KEY);
    if (!allLyrics) return true;

    const lyricsMap = JSON.parse(allLyrics);
    delete lyricsMap[videoId];

    await AsyncStorage.setItem(OFFLINE_LYRICS_KEY, JSON.stringify(lyricsMap));
    return true;
  } catch (error) {
    console.error('Error deleting offline lyrics:', error);
    throw error;
  }
};

// Export offline track storage directory for debugging
export const getOfflineStorageDirectory = () => {
  return OFFLINE_STORAGE_DIR;
};

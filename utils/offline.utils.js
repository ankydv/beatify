import TrackPlayer from 'react-native-track-player';
import { getTrackOfflineMetadata, isTrackDownloaded } from '@/services/offline.service';

/**
 * Prepare track for playback - uses offline path if available, otherwise uses streaming URL
 * @param {string} videoId - YouTube video ID
 * @param {string} streamingUrl - Streaming URL from YouTube
 * @param {string} title - Track title
 * @param {string} artist - Track artist
 * @param {string} artwork - Track artwork URL
 * @returns {Promise<Object>} Track object ready for rntp
 */
export const prepareTrackForPlayback = async (
  videoId,
  streamingUrl,
  title,
  artist,
  artwork
) => {
  let trackUrl = streamingUrl;
  let isOffline = false;

  try {
    // Check if track is available offline
    const isAvailableOffline = await isTrackDownloaded(videoId);
    
    if (isAvailableOffline) {
      const offlineMetadata = await getTrackOfflineMetadata(videoId);
      if (offlineMetadata && offlineMetadata.localPath) {
        trackUrl = offlineMetadata.localPath;
        isOffline = true;
      }
    }
  } catch (error) {
    console.warn('Error checking offline availability:', error);
    // Fall back to streaming URL
  }

  return {
    id: videoId,
    url: trackUrl,
    title,
    artist,
    artwork,
    isOffline, // Flag to indicate if this is offline playback
  };
};

/**
 * Add track to player with offline support
 * @param {string} videoId - YouTube video ID
 * @param {string} streamingUrl - Streaming URL
 * @param {string} title - Track title
 * @param {string} artist - Track artist
 * @param {string} artwork - Track artwork URL
 */
export const addTrackToPlayer = async (
  videoId,
  streamingUrl,
  title,
  artist,
  artwork
) => {
  const track = await prepareTrackForPlayback(
    videoId,
    streamingUrl,
    title,
    artist,
    artwork
  );

  await TrackPlayer.add([track]);
  return track;
};

/**
 * Replace current track with offline support
 * @param {string} videoId - YouTube video ID
 * @param {string} streamingUrl - Streaming URL
 * @param {string} title - Track title
 * @param {string} artist - Track artist
 * @param {string} artwork - Track artwork URL
 */
export const replaceTrackWithOfflineSupport = async (
  videoId,
  streamingUrl,
  title,
  artist,
  artwork
) => {
  const track = await prepareTrackForPlayback(
    videoId,
    streamingUrl,
    title,
    artist,
    artwork
  );

  const index = await TrackPlayer.getActiveTrackIndex();
  if (index !== null) {
    await TrackPlayer.removeUpcomingTracks();
    await TrackPlayer.add([track]);
  }

  return track;
};

/**
 * Get available track sources (both streaming and offline)
 * @param {string} videoId - YouTube video ID
 * @param {string} streamingUrl - Streaming URL
 * @returns {Promise<Object>} Object with both offline and online URL
 */
export const getTrackSources = async (videoId, streamingUrl) => {
  const offlineMetadata = await getTrackOfflineMetadata(videoId);

  return {
    streamingUrl,
    offlineUrl: offlineMetadata?.localPath || null,
    isAvailableOffline: !!offlineMetadata?.localPath,
  };
};

/**
 * Validate if offline track file exists and is accessible
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<boolean>} True if offline track exists and is valid
 */
export const validateOfflineTrack = async (videoId) => {
  try {
    const isAvailable = await isTrackDownloaded(videoId);
    const metadata = await getTrackOfflineMetadata(videoId);

    return isAvailable && metadata && metadata.localPath;
  } catch (error) {
    console.error('Error validating offline track:', error);
    return false;
  }
};

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Share,
  Platform,
  ToastAndroid,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'expo-router';
import TrackPlayer from 'react-native-track-player';
import { setQueue } from '@/state/slices/audio.slice';
import { handleVoiceRoomSongTap } from '@/utils/partyPlayback.utils';
import { toArtists, toThumb } from '@/utils/partyDj.utils';
import { usePlaylistApi } from '@/hooks/library.hooks/playlist.hooks';
import { resolvePlaylistSongId } from '@/utils/playlist.utils';

export default function SongActionModal({
  visible,
  song,
  onClose,
  playlistId = null,
  isUserPlaylist = false,
  onSongRemoved = null,
}) {
  const theme = useTheme();
  const router = useRouter();
  const dispatch = useDispatch();

  const party = useSelector((s) => s.party);
  const audio = useSelector((s) => s.audio);
  const { removeSongFromPlaylist } = usePlaylistApi();
  const [removing, setRemoving] = useState(false);

  if (!song) return null;

  const title = song.title || song.name || 'Song';
  const subtitle = toArtists(song);
  const thumbUrl = toThumb(song);
  const videoId = song.videoId || song.id;
  const inVoiceRoom = Boolean(party?.roomId);
  const isDj = party?.role === 'dj';
  const canRemoveFromPlaylist = Boolean(isUserPlaylist && playlistId);

  const notify = (msg) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      Alert.alert('Beatify', msg);
    }
  };

  const handleVoiceRoomAction = async () => {
    onClose();
    await handleVoiceRoomSongTap(song, true);
  };

  const handlePlayNext = async () => {
    onClose();
    if (!videoId) return;

    try {
      const currentQueueTracks = Array.isArray(audio?.queue?.tracks) ? [...audio.queue.tracks] : [];
      const currentTrackIndex = currentQueueTracks.findIndex(
        (t) => t.videoId === audio?.currentTrack?.videoId
      );
      const insertIndex = currentTrackIndex !== -1 ? currentTrackIndex + 1 : currentQueueTracks.length;

      const normalizedTrack = {
        ...song,
        videoId,
        title,
        artists: subtitle,
        thumbnail: thumbUrl ? [{ url: thumbUrl }] : undefined,
      };

      currentQueueTracks.splice(insertIndex, 0, normalizedTrack);
      dispatch(setQueue({ tracks: currentQueueTracks }));

      // Also register into native TrackPlayer queue if initialized
      try {
        const tpTrack = {
          id: videoId,
          url: song.url || `https://www.youtube.com/watch?v=${videoId}`,
          title,
          artist: subtitle,
          artwork: thumbUrl || undefined,
        };
        await TrackPlayer.add(tpTrack, insertIndex);
      } catch (_) {}

      notify(`"${title}" will play next ⏭️`);
    } catch (e) {
      notify('Could not add to queue');
    }
  };

  const handleAddToQueue = async () => {
    onClose();
    if (!videoId) return;

    try {
      const currentQueueTracks = Array.isArray(audio?.queue?.tracks) ? [...audio.queue.tracks] : [];
      const normalizedTrack = {
        ...song,
        videoId,
        title,
        artists: subtitle,
        thumbnail: thumbUrl ? [{ url: thumbUrl }] : undefined,
      };

      currentQueueTracks.push(normalizedTrack);
      dispatch(setQueue({ tracks: currentQueueTracks }));

      try {
        const tpTrack = {
          id: videoId,
          url: song.url || `https://www.youtube.com/watch?v=${videoId}`,
          title,
          artist: subtitle,
          artwork: thumbUrl || undefined,
        };
        await TrackPlayer.add(tpTrack);
      } catch (_) {}

      notify(`Added "${title}" to queue 🎶`);
    } catch (e) {
      notify('Could not add to queue');
    }
  };

  const handleAddToPlaylist = () => {
    onClose();
    if (!videoId) return;
    router.push({
      pathname: 'addToPlaylist',
      params: {
        songId: videoId,
        song: JSON.stringify(song),
      },
    });
  };

  const handleGoToArtist = () => {
    onClose();
    const artistId =
      song.browseId ||
      song.channelId ||
      (Array.isArray(song.artists) && song.artists[0]?.id) ||
      (song.artist && typeof song.artist === 'object' ? song.artist.id : null);

    if (artistId) {
      router.push({
        pathname: '/artist',
        params: { id: artistId },
      });
    } else {
      notify('Artist details not available for this song');
    }
  };

  const handleShare = async () => {
    onClose();
    try {
      const url = videoId ? `https://music.youtube.com/watch?v=${videoId}` : '';
      await Share.share({
        message: url ? `Listen to "${title}" on Beatify: ${url}` : `Listen to "${title}" on Beatify`,
      });
    } catch (_) {}
  };

  const doRemoveFromPlaylist = async () => {
    if (removing || !canRemoveFromPlaylist) return;
    const songId = resolvePlaylistSongId(song);
    if (!songId) {
      notify('Could not remove: missing song id');
      return;
    }
    setRemoving(true);
    // Optimistic: close + update list immediately, rollback not needed
    // since parent only removes on success.
    try {
      await removeSongFromPlaylist({ playlistId, songId });
      onClose();
      onSongRemoved?.(song);
      notify(`Removed "${title}" from playlist`);
    } catch (e) {
      notify(e?.message || 'Could not remove song');
    } finally {
      setRemoving(false);
    }
  };

  const handleRemoveFromPlaylist = () => {
    Alert.alert(
      'Remove from playlist?',
      `"${title}" will be removed from this playlist.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doRemoveFromPlaylist },
      ],
      { cancelable: true }
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.colors.elevation?.level3 || '#1C1A29' }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header Preview */}
          <View style={styles.header}>
            {thumbUrl ? (
              <Image source={{ uri: thumbUrl }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <Icon name="music" size={24} color="#FFF" />
              </View>
            )}
            <View style={styles.headerMeta}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Icon name="close" size={20} color="#AAA" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Action List */}
          <View style={styles.actionList}>
            {/* Voice Room Actions */}
            {inVoiceRoom && (
              <TouchableOpacity style={styles.actionRow} onPress={handleVoiceRoomAction} activeOpacity={0.7}>
                <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(233, 64, 87, 0.15)' }]}>
                  <Icon
                    name={isDj ? 'playlist-plus' : 'hand-wave'}
                    size={22}
                    color="#E94057"
                  />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={styles.actionTitle}>
                    {isDj ? 'Add to Room Queue' : 'Request in Voice Room'}
                  </Text>
                  <Text style={styles.actionSub}>
                    {isDj ? 'Add track directly into party room stream' : 'Send song request to room DJ'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Standard Queue Actions (when not in voice room) */}
            {!inVoiceRoom && (
              <>
                <TouchableOpacity style={styles.actionRow} onPress={handlePlayNext} activeOpacity={0.7}>
                  <View style={styles.actionIconWrap}>
                    <Icon name="play-speed" size={22} color="#FFF" />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <Text style={styles.actionTitle}>Play Next</Text>
                    <Text style={styles.actionSub}>Insert right after the current song</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionRow} onPress={handleAddToQueue} activeOpacity={0.7}>
                  <View style={styles.actionIconWrap}>
                    <Icon name="playlist-plus" size={22} color="#FFF" />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <Text style={styles.actionTitle}>Add to Queue</Text>
                    <Text style={styles.actionSub}>Append to the end of player queue</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {/* Add to Playlist */}
            <TouchableOpacity style={styles.actionRow} onPress={handleAddToPlaylist} activeOpacity={0.7}>
              <View style={styles.actionIconWrap}>
                <Icon name="playlist-music" size={22} color="#FFF" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Add to Playlist</Text>
                <Text style={styles.actionSub}>Save into your personal library playlists</Text>
              </View>
            </TouchableOpacity>

            {/* Remove from this playlist (user playlists only) */}
            {canRemoveFromPlaylist && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleRemoveFromPlaylist}
                activeOpacity={0.7}
                disabled={removing}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(233, 64, 87, 0.15)' }]}>
                  {removing ? (
                    <ActivityIndicator size="small" color="#E94057" />
                  ) : (
                    <Icon name="playlist-remove" size={22} color="#E94057" />
                  )}
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={[styles.actionTitle, { color: '#E94057' }]}>
                    {removing ? 'Removing…' : 'Remove from Playlist'}
                  </Text>
                  <Text style={styles.actionSub}>Delete this song from the current playlist</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Go to Artist */}
            <TouchableOpacity style={styles.actionRow} onPress={handleGoToArtist} activeOpacity={0.7}>
              <View style={styles.actionIconWrap}>
                <Icon name="account-music" size={22} color="#FFF" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Go to Artist</Text>
                <Text style={styles.actionSub}>View top songs, albums and biography</Text>
              </View>
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity style={styles.actionRow} onPress={handleShare} activeOpacity={0.7}>
              <View style={styles.actionIconWrap}>
                <Icon name="share-variant" size={22} color="#FFF" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Share</Text>
                <Text style={styles.actionSub}>Share song link with friends</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#2A2A38',
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMeta: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#AAA',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 8,
  },
  actionList: {
    gap: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  actionSub: {
    fontSize: 11,
    color: '#8E8E9F',
    marginTop: 2,
  },
});

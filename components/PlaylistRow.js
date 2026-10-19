import React, { useCallback } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import SongCard from './SongCard';
import { useNavigation, useRouter } from 'expo-router';
import { loadAndPlayTrack } from '@/state/slices/audio.slice';
import { showUnimplementedFeatureAlert } from "../utils/alerts.utils";
import { useDispatch } from 'react-redux';

import { handleVoiceRoomSongTap } from '@/utils/partyPlayback.utils';

const PlaylistRow = ({ items, title }) => {

  const navigation = useNavigation();
  const router = useRouter();
  const dispatch = useDispatch();

  const isArtistCategory = title.includes('artist');
  const handlePress = useCallback(async (item) => {
    const isVideo = Boolean(item.videoId);
    const isArtist = isArtistCategory || item.resultType === 'artist' || Boolean(item.subscribers);
    const isPlaylist = Boolean(item.playlistId);
    const isAlbum = title.includes('album') || Boolean(item.browseId);

    if (isVideo) {
      const handled = await handleVoiceRoomSongTap(item);
      if (handled) return;
      dispatch(loadAndPlayTrack({ track: item }));
    } else if (isArtist) {
      const artistId =
        item.browseId ||
        item.channelId ||
        item.id ||
        (Array.isArray(item.artists) && item.artists[0]?.id);
      if (artistId) {
        router.push({
          pathname: "/artist",
          params: { id: artistId },
        });
      }
    } else if (isAlbum || isPlaylist) {
      router.push({
        pathname: "/album",
        params: { id: isPlaylist ? item.playlistId : item.browseId, isPlaylist: Boolean(isPlaylist) },
      });
    } else {
      showUnimplementedFeatureAlert();
    }
  }, [dispatch, router, title, isArtistCategory]);

  const renderItem = useCallback(({ item }) => (
    <SongCard item={item} onPress={() => handlePress(item)} />
  ), [handlePress]);

  return (
    <FlatList
      horizontal
      data={items}
      renderItem={renderItem}
      keyExtractor={(item, index) =>
        item?.playlistId ||
        item?.browseId ||
        item?.videoId ||
        `${item?.title || 'item'}_${index}`
      }
      showsHorizontalScrollIndicator={false}
      initialNumToRender={6}
      maxToRenderPerBatch={8}
      windowSize={5}
    />
  );
};

export default PlaylistRow;

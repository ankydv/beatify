import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import SongCard from './SongCard';
import { useNavigation, useRouter } from 'expo-router';
import { loadAndPlayTrack } from '@/state/slices/audio.slice';
import { useDispatch } from 'react-redux';

const PlaylistRow = ({ items, title }) => {

  const navigation = useNavigation();
  const router = useRouter();
  const dispatch = useDispatch();

  const isArtist = title.includes('artist');
  const handlePress = (item) => {
    const isVideo = item.videoId;
    const isAlbum = title.includes('album');
    const isPlaylist = item.playlistId
    if(isVideo){
      dispatch(loadAndPlayTrack({track: item}))
    }
    else if(isArtist)
      console.log('artist')
    else if(isAlbum || isPlaylist){
      router.push({
        pathname: "/(tabs)/homeRoutes/Album",
        params: { id: isPlaylist?item.playlistId:item.browseId, isPlaylist: isPlaylist }, 
      });
    }
  }
  return (
    <FlatList
      horizontal
      data={items}
      renderItem={({ item }) => <SongCard item={item} onPress={() => handlePress(item)}/>}
      keyExtractor={(item) => item?.title}
      showsHorizontalScrollIndicator={false}
    />
  );
};

export default PlaylistRow;

import React from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import SongCard from './SongCard';
import { useNavigation, useRouter } from 'expo-router';
import { loadAndPlayTrack } from '@/state/slices/audio.slice';
import { showUnimplementedFeatureAlert } from "../utils/alerts.utils";
import { useDispatch } from 'react-redux';

const PlaylistRow = ({ items, title }) => {

  const navigation = useNavigation();
  const router = useRouter();
  const dispatch = useDispatch();

  const handlePress = (item) => {
    const isVideo = item.videoId;
    const isArtist = title.includes('artist') || item.subscribers;
    const isAlbum = title.includes('album') || Boolean(item.browseId);
    const isPlaylist = Boolean(item.playlistId)
    if(isVideo){
      dispatch(loadAndPlayTrack({track: item}))
    }
    else if(isArtist){
      console.log('artist clicked')
      router.push(
        {pathname: "/artist", params: {id: item.browseId}}
      );
    }
    else if(isAlbum || isPlaylist){
      router.push({
        pathname: "/(tabs)/homeRoutes/Album",
        params: { id: isPlaylist?item.playlistId:item.browseId, isPlaylist: isPlaylist }, 
      });
    }
    else{
      showUnimplementedFeatureAlert();
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

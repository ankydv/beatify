import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import SongCard from './SongCard';
import { useNavigation, useRouter } from 'expo-router';

const PlaylistRow = ({ items, title }) => {

  const navigation = useNavigation();
  const router = useRouter();

  const isAlbum = title.includes('album');
  const handlePress = (item) => {
    console.log(title)
    if(isAlbum){
      router.push({
        pathname: "/(tabs)/homeRoutes/Album",
        params: { id: item.browseId }, 
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

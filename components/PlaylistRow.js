import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import SongCard from './SongCard';

const PlaylistRow = ({ items }) => {
  return (
    <FlatList
      horizontal
      data={items}
      renderItem={({ item }) => <SongCard item={item}/>}
      keyExtractor={(item) => item?.title}
      showsHorizontalScrollIndicator={false}
    />
  );
};

export default PlaylistRow;

import { loadAndPlayTrack } from '@/state/slices/audio.slice';
import React from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useDispatch } from 'react-redux';
import { Text } from './Themed';

const SongCard = ({ item }) => {
    const artists = 'test artist'
    const dispatch = useDispatch();
  return (
    <TouchableOpacity style={styles.card} onPress={() => dispatch(loadAndPlayTrack(item))}>
      <Image source={{ uri: item.thumbnails[0].url }} style={styles.image} />
      <Text style={styles.title} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={artists} numberOfLines={1}>
        {item.subtitle}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 120,
    margin: 10,
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 10,
  },
  title: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
  },
});

export default SongCard;

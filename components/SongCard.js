import React from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './Themed';

const SongCard = ({ item, onPress }) => {
  return (
    <>{item && 
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Image source={{ uri: item.thumbnails[1]?.url || item.thumbnails[0].url }} 
        style={[styles.image, item.subscribers && {borderRadius: 100}]} />
      <Text style={styles.title} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.title} numberOfLines={1}>
        {item.subtitle}
      </Text>
    </TouchableOpacity>
    }
    </>
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

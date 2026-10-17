import React from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './Themed';

const SongCard = ({ item, onPress }) => {
  if (!item) return null;
  const thumbUri =
    item.thumbnails?.[1]?.url ||
    item.thumbnails?.[0]?.url ||
    (Array.isArray(item.thumbnail) ? item.thumbnail[0]?.url : item.thumbnail) ||
    null;
  const isArtist = Boolean(item.subscribers) || item.resultType === 'artist';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {thumbUri ? (
        <Image
          source={{ uri: thumbUri }}
          style={[styles.image, isArtist && { borderRadius: 60 }]}
        />
      ) : (
        <View style={[styles.image, isArtist && { borderRadius: 60 }, { backgroundColor: '#444' }]} />
      )}
      <Text style={styles.title} numberOfLines={1}>
        {item.title}
      </Text>
      {item.subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {item.subtitle}
        </Text>
      ) : null}
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

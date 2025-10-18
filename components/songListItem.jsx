import React from "react";
import { Dimensions, Image, Pressable, StyleSheet, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Text, useTheme } from "react-native-paper";

const textWidth = Dimensions.get('window').width - 100;

const MusicListItem = ({onPress, imageUrl, title, subtitle, onMorePress, isQueue, index, resultType }) => {

  const theme = useTheme();
  const isArtist = resultType === 'artist';
  return (
    <Pressable onPress={onPress} style={[styles.container,]}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={[styles.image, isArtist && {borderRadius: 100}]} /> : <Text style={styles.serialNumber}>{index+1}</Text>}
      <View style={styles.textContainer}>
        <Text variant="titleMedium" style={[styles.title, isQueue && {color: 'white'}]} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="bodyMedium" style={[styles.subtitle, isQueue && {color: 'white'}]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Pressable onPress={onMorePress} style={styles.moreButton}>
        <MaterialIcons name="more-vert" size={24} color={isQueue ? 'white' : theme.colors.text} />
      </Pressable>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical:5,
    paddingHorizontal: 15,
  },
  image: {
    width: 50,
    height: 50,
    borderRadius: 5,
    marginRight: 15,
  },
  serialNumber: {
    padding: 10,
    fontSize: 15,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontWeight: "bold",
    maxWidth: textWidth,
  },
  subtitle: {
    maxWidth: textWidth,
  },
  moreButton: {
    padding: 5,
  },
});

export default MusicListItem;

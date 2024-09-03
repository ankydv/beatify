import React from "react";
import { Image, Pressable, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "./Themed";

const MusicListItem = ({ imageUrl, title, subtitle, onPress, onMorePress }) => {
  return (
    <Pressable onPress={onPress} style={[styles.container]}>
      <Image source={{ uri: imageUrl }} style={styles.image} />
      <View style={styles.textContainer}>
        <Text style={[styles.title]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.subtitle]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Pressable onPress={onMorePress} style={styles.moreButton}>
        <MaterialIcons name="more-vert" size={24} />
      </Pressable>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  image: {
    width: 50,
    height: 50,
    borderRadius: 5,
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 14,
  },
  moreButton: {
    padding: 5,
  },
});

export default MusicListItem;

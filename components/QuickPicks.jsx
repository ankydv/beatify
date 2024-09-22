import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import MusicList from "./MusicList";

const QuickPics = ({ data }) => {
  // Function to split the dataset into chunks of 4 items
  const chunkData = (dataset, chunkSize) => {
    const chunks = [];
    for (let i = 0; i < dataset.length; i += chunkSize) {
      chunks.push(dataset.slice(i, i + chunkSize));
    }
    return chunks;
  };

  // Split the data into chunks of 4
  const chunkedData = chunkData(data, 4);

  return (
    <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
      {chunkedData.map((chunk, index) => (
        <View key={index} style={styles.column}>
          <MusicList dataset={chunk} />
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  column: {
    marginRight: 10, // Add spacing between columns
  },
});

export default QuickPics;

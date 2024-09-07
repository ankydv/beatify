import React from "react";
import MusicList from "./MusicList";
import { ScrollView } from "react-native";
import { Text, View } from "./Themed";

const SearchResults = ({ results }) => {
  return (
    <ScrollView>
      {results?.map((item, index) => (
        <View key={index}>
          <Text style={{fontSize: 20, fontWeight: 'bold', padding: 10}}>{item.category}</Text>
          <MusicList dataset={item.data} />
        </View>
      ))}
    </ScrollView>
  );
};

export default SearchResults;

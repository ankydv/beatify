import React, { useState } from "react";
import { TextInput, StyleSheet, Pressable } from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { View } from "./Themed";
import { useTheme } from "@react-navigation/native";

const SearchBar = ({ onSubmit }) => {
  const [searchText, setSearchText] = useState("");
  const theme = useTheme();
  const handleSearchSubmit = () => {
    if (searchText.trim()) {
      console.log(searchText);
      onSubmit(searchText);
    }
  };

  const clearSearch = () => {
    setSearchText("");
  };

  return (
    <View style={styles.searchContainer}>
      <Feather name="search" size={24} />
      <TextInput
        value={searchText}
        onChangeText={setSearchText}
        onSubmitEditing={handleSearchSubmit}
        placeholder="Search"
        style={styles.input}
        color={theme.colors.text}
      />
      {searchText.length > 0 && (
        <Pressable onPress={clearSearch}>
          <MaterialIcons name="clear" size={24} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    margin: 10,
    elevation: 2, // Subtle shadow for a slight elevation
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
});

export default SearchBar;

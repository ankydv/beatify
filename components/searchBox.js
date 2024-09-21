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
      onSubmit(searchText);
    }
  };

  const clearSearch = () => {
    setSearchText("");
  };

  return (
    <View
      style={[
        styles.searchContainer,
        {
          backgroundColor: theme.colors.card, 
          shadowColor: theme.dark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)", // Light shadow for dark mode
        },
      ]}
    >
      <Feather name="search" size={24} color={theme.colors.text} />
      <TextInput
        value={searchText}
        onChangeText={setSearchText}
        onSubmitEditing={handleSearchSubmit}
        placeholder="Search"
        placeholderTextColor={theme.colors.placeholder || "gray"} 
        style={[
          styles.input,
          {
            color: theme.colors.text, // Text color from theme
          },
        ]}
      />
      {searchText.length > 0 && (
        <Pressable onPress={clearSearch}>
          <MaterialIcons name="clear" size={24} color={theme.colors.text} />
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
    elevation: 2, 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3, 
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
});

export default SearchBar;

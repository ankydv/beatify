import React, { useRef, useState } from "react";
import { TextInput, StyleSheet, Pressable, View } from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "react-native-paper";
import { useFocusEffect } from "expo-router";

const SearchBar = ({ onSubmit }) => {
  const [searchText, setSearchText] = useState("");
  const theme = useTheme();
  const inputRef = useRef(null);
  const [submitted, setSubmitted] = useState(false);
  const handleSearchSubmit = () => {
    if (searchText.trim()) {
      onSubmit(searchText);
      setSubmitted(true);
    }
  };

  const clearSearch = () => {
    setSearchText("");
    inputRef.current?.focus();
  };

  useFocusEffect(() => {
    requestAnimationFrame(() => {
      if(!submitted)
      inputRef.current?.focus();
    });
  });

  return (
    <View
      style={[
        styles.searchContainer,
        {
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.outline,
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
        ref={inputRef}
        cursorColor={theme.colors.primary}
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
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 100,
    margin: 10,
    elevation: 1, 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3, 
    borderWidth: 1,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
});

export default SearchBar;

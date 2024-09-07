import React from 'react';
import { TouchableOpacity, StyleSheet, Text } from 'react-native';
import { FontAwesome } from '@expo/vector-icons'; // Assuming you are using Expo

const LyricsToggleButton = ({ isLyricsVisible, onToggle }) => {
  return (
    <TouchableOpacity style={[styles.button, {backgroundColor: isLyricsVisible ? "white" : 'transparent'}]} onPress={onToggle}>
      {/* {isLyricsVisible ? (
        <FontAwesome name="eye" size={24} color="white" />
      ) : (
        <FontAwesome name="eye-slash" size={24} color="white" />
      )} */}
      <Text style={[styles.text, {color: isLyricsVisible ? 'black': 'white'}]}>
        Lyrics
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: '20%',
    // flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: 50,
    borderColor: "black",
    elevation: 0.5,
    backgroundColor: "rgba(247, 247, 247, 0.1)",
  },
  text: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default LyricsToggleButton;

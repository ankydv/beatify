import React from 'react';
import { StyleSheet, Text } from 'react-native';
import BubbleButton from './BubbleButton';

const LyricsToggleButton = ({ isLyricsVisible, onToggle }) => {
  return (
    <BubbleButton style={[styles.button, isLyricsVisible && { backgroundColor: 'white' }]} onPress={onToggle}>
      <Text style={[styles.text, {color: isLyricsVisible ? 'black': 'white'}]}>
        Lyrics
      </Text>
    </BubbleButton>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 30,
  },
  text: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default LyricsToggleButton;

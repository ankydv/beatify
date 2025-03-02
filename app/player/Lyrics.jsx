import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSelector } from 'react-redux';
import { useProgress } from 'react-native-track-player';
import { FontAwesome } from '@expo/vector-icons';

const Lyrics = () => {
  const parsedLyrics = useSelector((state) => state.audio).lyrics;
  const { position } = useProgress();
  const [currentLine, setCurrentLine] = useState('');

  const OFFSET =  0.7; //lyrics offset in seconds
  const opacity = useRef(new Animated.Value(0.1)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (parsedLyrics && parsedLyrics.length > 0) {
      const findCurrentLyric = () => {
        const currentLyric = parsedLyrics.find((line, index) => {
          const nextLine = parsedLyrics[index + 1];
          return position >= line.time-OFFSET && (!nextLine || position < nextLine.time-OFFSET);
        });
        if (!currentLyric) {
          if (currentLine !== 'music') {
            setCurrentLine('music');
            animateLyric(); 
          }
        } else if (currentLyric.text !== currentLine.trim()) {
          setCurrentLine('  ' + currentLyric.text + '  ');
          animateLyric();
        }
      };

      findCurrentLyric();
    } else {
      setCurrentLine('music');  // Ensure empty lyrics are handled
    }
  }, [position, parsedLyrics]);

  const animateLyric = () => {
    // Reset animation values for the new line
    opacity.setValue(0.1);
    translateY.setValue(40);

    // Start the animation
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,  // Fade in to 100% opacity
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,  // Slide up to its final position
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View style={styles.container}>
      {currentLine === 'music' || currentLine.trim() === ''? (
        <FontAwesome name="music" size={40} color="white" />
      ) : (
        <Animated.Text
          style={[
            styles.lyricsText,
            {
              opacity: opacity,
              transform: [{ translateY: translateY }],
            },
          ]}
        >
          {currentLine}
        </Animated.Text>
      )}
    </View>
  );
};

export default Lyrics;

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    width: '100%',
    paddingHorizontal: 20,
  },
  lyricsText: {
    fontSize: 30,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: 'white',
    textAlign: 'center',
    fontFamily: 'sans-serif', // Similar to Amazon Music
    textShadowColor: "black",
    textShadowRadius: 4,
  },
});

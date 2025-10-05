import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, useTheme } from 'react-native-paper';

const LibraryContent = ({onPress, icon, text}) => {
  const { colors } = useTheme();

  return (
      <Button
        icon={icon}
        mode="contained"
        onPress={onPress}
        style={styles.libraryButton}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
        buttonColor={colors.surfaceVariant}
        textColor={colors.onSurfaceVariant}
      >
        {text}
      </Button>
  );
};

const styles = StyleSheet.create({
  libraryButton: {
  },
  buttonContent: {
    height: 60, 
    justifyContent: 'flex-start',
  },
  buttonLabel: {
    fontSize: 18,
  },
});

export default LibraryContent;

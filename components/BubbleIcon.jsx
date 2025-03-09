import React from 'react';
import { StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import BubbleButton from './BubbleButton';

const BubbleIcon = ({ name, size = 23, color = 'white', onPress, style, isMaterialIcon = true, children, ...props }) => {
  return (
    <BubbleButton onPress={onPress} style={[styles.button, style, { opacity: props.disabled ? 0.2 : 1 }]} {...props}>
      {isMaterialIcon ? <MaterialIcons name={name} size={size} color={color} /> : children}
    </BubbleButton>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 50,
    padding: 7,
  },
});

export default BubbleIcon;

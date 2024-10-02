import React, { useState } from "react";
import { StyleSheet, TouchableWithoutFeedback, View } from "react-native";

const BubbleButton = ({ onPress, style, children }) => {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <TouchableWithoutFeedback
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
    >
      <View style={[styles.button, style, isPressed && styles.pressed]}>
        {children}
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 25,
  },
  pressed: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  text: {
    fontSize: 16,
    color: "white",
  },
});

export default BubbleButton;

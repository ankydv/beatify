import React, { useState } from "react";
import { Alert, StyleSheet, TouchableWithoutFeedback, View } from "react-native";
import { showUnimplementedFeatureAlert } from "../utils/alerts.utils";

const BubbleButton = ({ onPress, style, children }) => {
  const [isPressed, setIsPressed] = useState(false);
  if(!onPress){
    onPress = () => {
      showUnimplementedFeatureAlert();
    }
  }

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

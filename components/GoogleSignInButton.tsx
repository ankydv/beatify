import React from "react";
import { StyleSheet } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const GoogleSignInButton = ({
  onPress,
  isLoading,
}: {
  onPress: () => void;
  isLoading?: boolean;
}) => {
  const theme = useTheme();

  return (
    <Button
      mode="outlined"
      onPress={onPress}
      style={[styles.button]}
      contentStyle={styles.content}
      labelStyle={styles.label}
      loading={isLoading}
      disabled={isLoading}
      icon={({ size, color }) => (
        <MaterialCommunityIcons name="google" size={size} color={color} />
      )}
    >
      <Text style={styles.text}>Sign in with Google</Text>
    </Button>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 4,
  },
  content: {},
  label: {},
  text: {
    fontWeight: "500",
  },
});

export default GoogleSignInButton;

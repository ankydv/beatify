import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Button, Text, useTheme, TextInput } from "react-native-paper";

const Test = () => {
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { colors } = useTheme();

  const handlePress = () => {
    if (!roomId.trim()) {
      setError("Room ID is required.");
      return;
    }
    setError("");
    router.push({
      pathname: "voiceRoom",
      params: { roomId },
    });
  };

  return (
    <View style={[styles.container]}>
      <Text variant="labelLarge" style={[styles.label]}>
        Enter Room ID:
      </Text>
      <TextInput
        style={[styles.input]}
        placeholder="Room ID"
        value={roomId}
        onChangeText={setRoomId}
        keyboardType="numeric"
        maxLength={4}
        error={error}
        // onSubmitEditing={handlePress}
        mode="outlined"
      />
      <Button 
        mode="contained" 
        // onPress={handlePress}
        style={[styles.button]}
      >
        Enter Party Room (Coming Soon)
      </Button>
      {error ? (
        <Text variant="titleMedium" style={[{ color: colors.notification }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

export default Test;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  label: {
    marginBottom: 8,
  },
  input: {
    borderRadius: 4,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  error: {
    fontSize: 14,
    marginBottom: 8,
  },
  button: {
    borderRadius: 4,
  }
});

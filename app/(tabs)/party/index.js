import React, { useState } from 'react';
import { Button, TextInput, View, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';

const Test = () => {
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { colors } = useTheme();

  const handlePress = () => {
    if (!roomId.trim()) {
      setError('Room ID is required.');
      return;
    }
    setError('');
    router.push({
      pathname: 'voiceRoom',
      params: { roomId },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.label, { color: colors.text }]}>Enter Room ID:</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.primary, color: colors.text }]}
        placeholder="Room ID"
        placeholderTextColor={colors.text}
        value={roomId}
        onChangeText={setRoomId}
        keyboardType="numeric"
      />
      {error ? <Text style={[styles.error, { color: colors.notification }]}>{error}</Text> : null}
      <Button title="Go to VC" onPress={handlePress} color={colors.primary} />
    </View>
  );
};

export default Test;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  error: {
    fontSize: 14,
    marginBottom: 8,
  },
});

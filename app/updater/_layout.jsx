import React from 'react';
import { nativeApplicationVersion } from 'expo-application';
import useAppUpdater from '@/hooks/updater.hooks';
import { Button, Text } from 'react-native-paper';
import { View } from 'react-native';

const Updater = () => {
  const { isChecking, downloadProgress, checkForUpdates } = useAppUpdater();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 }}>
      <Text variant='bodyLarge' >Current Version: {nativeApplicationVersion}</Text>
      {downloadProgress !== null ? (
        <Text>Downloading Update: {downloadProgress}%</Text>
      ) : (
        <Button
          mode="contained"
          onPress={() => checkForUpdates(true)}
          disabled={isChecking}
          loading={isChecking}
        >
          Check for Updates
        </Button>
      )}
    </View>
  );
};

export default Updater;

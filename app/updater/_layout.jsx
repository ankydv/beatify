import React from 'react';
import { Button } from 'react-native';
import { View, Text } from '@/components/Themed';
import { nativeApplicationVersion } from 'expo-application';
import useAppUpdater from '@/hooks/updater.hooks';

const Updater = () => {
  const { isChecking, downloadProgress, checkForUpdates } = useAppUpdater();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Current Version: {nativeApplicationVersion}</Text>
      {downloadProgress !== null ? (
        <Text>Downloading Update: {downloadProgress}%</Text>
      ) : (
        <Button
          title="Check for Updates"
          onPress={() => checkForUpdates(true)}
          disabled={isChecking}
        />
      )}
    </View>
  );
};

export default Updater;

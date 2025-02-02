import React, { useState } from 'react';
import { Button, Alert } from 'react-native';
import { View , Text } from '@/components/Themed';
import { checkAppUpdates, handleUpdate } from '../../utils/updates.utils';

const Updater = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);

  const handleCheckForUpdates = async () => {
    setIsChecking(true);

    const onUpdateAvailable = async (latestRelease) => {
      Alert.alert(
        'Update Available',
        `A new version (${latestRelease.tag_name}) is available. Would you like to update now?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Update',
            onPress: () => startDownload(latestRelease),
          },
        ]
      );
    };

    const onUpdateNotAvailable = () => {
      Alert.alert('No Updates Available', 'Your app is up to date.');
      setIsChecking(false);
    };

    await checkAppUpdates(onUpdateAvailable, onUpdateNotAvailable);
  };

  const startDownload = async (latestRelease) => {
    const onUpdateComplete = () => {
      Alert.alert('Downloading', 'Please install the app after download to apply the update.');
      setIsChecking(false);
    };

    const onUpdateFailed = (message) => {
      Alert.alert('Update Failed', message);
      setIsChecking(false);
    };

    const onProgress = (progress) => {
      setDownloadProgress(progress.toFixed(2));
    };

    await handleUpdate(latestRelease, onProgress, onUpdateComplete, onUpdateFailed);
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Current Version: 1.0.1</Text>
      {downloadProgress !== null ? (
        <Text>Downloading Update: {downloadProgress}%</Text>
      ) : (
        <Button
          title="Check for Updates"
          onPress={handleCheckForUpdates}
          disabled={isChecking}
        />
      )}
    </View>
  );
};

export default Updater;
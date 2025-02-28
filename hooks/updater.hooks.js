import { useState } from 'react';
import { Alert } from 'react-native';
import { checkAppUpdates, handleUpdate } from '../utils/updates.utils';

const useAppUpdater = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);

  const checkForUpdates = async (shouldShowUpdateNotAvl) => {
    setIsChecking(true);

    const onUpdateAvailable = async (latestRelease) => {
      Alert.alert(
        'Update Available',
        `A new version (${latestRelease.tag_name}) is available. Would you like to update now?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsChecking(false) },
          {
            text: 'Update',
            onPress: () => startDownload(latestRelease),
          },
        ]
      );
    };

    const onUpdateNotAvailable = () => {
        setIsChecking(false);
        if(shouldShowUpdateNotAvl)
        Alert.alert('No Updates Available', 'Your app is up to date.');
      
    };

    await checkAppUpdates(onUpdateAvailable, onUpdateNotAvailable);
  };

  const startDownload = async (latestRelease) => {
    const onUpdateComplete = () => {
      Alert.alert('Downloading', 'Please install the app after download to apply the update.');
      setIsChecking(false);
      setDownloadProgress(null);
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

  return {
    isChecking,
    downloadProgress,
    checkForUpdates,
  };
};

export default useAppUpdater;

import { checkForUpdates, downloadUpdate, installUpdate } from '../services/updates.service';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { nativeApplicationVersion } from 'expo-application';

export const checkAppUpdates = async (onUpdateAvailable, onUpdateNotAvailable) => {
  const currentVersion = nativeApplicationVersion; // Set your current version here
  const latestRelease = await checkForUpdates(currentVersion);

  if (latestRelease) {
    onUpdateAvailable(latestRelease);
  } else {
    onUpdateNotAvailable();
  }
};

export const handleUpdate = async (release, onProgress, onUpdateComplete, onUpdateFailed) => {
  // console.log('release', release)
  const asset = release.assets.find(asset => asset.name.endsWith('.apk'));

  if (!asset) {
    onUpdateFailed('Could not find the update file.');
    return;
  }
  const destinationPath = `${FileSystem.documentDirectory}${asset.name}`;
  const filePath = await downloadUpdate(asset.browser_download_url, destinationPath, onProgress);

  if (filePath) {
    // installUpdate(filePath);
    onUpdateComplete();
  } else {
    // onUpdateFailed('Failed to download the update.');
  }
};
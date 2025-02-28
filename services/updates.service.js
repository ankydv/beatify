import axios from 'axios';
import { Platform, Linking } from 'react-native';

const GITHUB_API_URL = 'https://api.github.com/repos/ankydv/beatify/releases/latest';

export const checkForUpdates = async (currentVersion) => {
  try {
    const response = await axios.get(GITHUB_API_URL);
    const latestRelease = response.data;
    const latestVersion = latestRelease.tag_name;

    if (latestVersion !== currentVersion) {
      return latestRelease;
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
  }
  return null;
};

export const downloadUpdate = async (downloadUrl, destinationPath, onProgress) => {
  try {
    // Check if the file already exists
    // const fileInfo = await FileSystem.getInfoAsync(destinationPath);
    // if (fileInfo.exists) {
    //   console.log('File already exists at:', destinationPath);
    //   onProgress(100); // Mark download as complete
    //   return destinationPath;
    // }

    // const downloadResumable = FileSystem.createDownloadResumable(
    //   downloadUrl,
    //   destinationPath,
    //   {},
    //   ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
    //     const progress = (totalBytesWritten / totalBytesExpectedToWrite) * 100;
    //     onProgress(progress);
    //   }
    // );

    // const { uri } = await downloadResumable.downloadAsync();
    // console.log('Downloaded update to:', uri);
    // return uri;
    Linking.openURL(downloadUrl);
    return true;
  } catch (error) {
    console.error('Error downloading update:', error);
  }
  return null;
};

export const installUpdate = async (filePath) => {
  try {
    if (Platform.OS === 'android') {
    //   const granted = await requestInstallUnknownAppsPermission();
    //   if (!granted) {
    //     console.error('Permission to install unknown apps denied');
    //     return;
    //   }

    const contentUri = `content://${filePath.replace('file://', '')}`;
    await Linking.openURL(contentUri);
    console.log('Update installed successfully');
    }
  } catch (error) {
    console.error('Error installing update:', error);
  }
};
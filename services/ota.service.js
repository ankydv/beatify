// src/services/UpdateService.js
import * as Updates from 'expo-updates';
import { useEffect } from 'react';

const checkForUpdates = async () => {
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      console.log('Update available, downloading...');
      await Updates.fetchUpdateAsync();
      console.log('Update downloaded, reloading...');
      await Updates.reloadAsync();
    } else {
      console.log('No updates available.');
    }
  } catch (e) {
    console.error('Failed to fetch and apply update:', e);
  }
};

const useAutoUpdate = () => {
  useEffect(() => {
    // Check for updates on app startup
    checkForUpdates();

    // Optionally, set up a periodic check (e.g., every 6 hours)
    const intervalId = setInterval(checkForUpdates, 6 * 60 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);
};

export default useAutoUpdate;
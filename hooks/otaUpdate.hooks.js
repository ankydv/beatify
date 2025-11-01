import { useEffect, useState } from "react";
import * as Updates from "expo-updates";
import { Alert } from "react-native";

export const useAppUpdate = () => {
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        setIsChecking(true);
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          // Download the new update
          await Updates.fetchUpdateAsync();

          // Show user prompt before reload
          Alert.alert(
            "Update available 🎉",
            "A new version is ready. Restart the app to apply it?",
            [
              { text: "Later", style: "cancel" },
              {
                text: "Restart Now",
                onPress: async () => {
                  await Updates.reloadAsync();
                },
              },
            ]
          );
        }
      } catch (error) {
        console.log("Error checking for updates:", error);
      } finally {
        setIsChecking(false);
      }
    };

    checkForUpdates();
  }, []);

  return { isChecking };
};

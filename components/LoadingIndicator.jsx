import { useTheme } from "@react-navigation/native";
import { StyleSheet } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

const LoadingIndicator = ({size = 50}) => {
  const theme = useTheme();
  return (
    <SafeAreaView style={styles.loadingContainer}>
      <ActivityIndicator size={size} color={theme.colors.primary} />
    </SafeAreaView>
  );
};

export default LoadingIndicator;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

import { StyleSheet, View, TouchableOpacity, ScrollView } from "react-native";
import { openModal } from "@/state/slices/modal.slice";
import { useDispatch } from "react-redux";
import SignInWithYouTube from "@/components/ClerkSignIn";
import { useState } from "react";
import { useNavigation, useRouter } from "expo-router";
import { Button, Text, useTheme, Avatar, IconButton } from "react-native-paper";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { tokenManager } from "@/utils/token.utils";
import { SafeAreaView } from "react-native-safe-area-context"; // Use SafeAreaView for better spacing
import SquareIconButton from "@/components/SquareIconButton"
export default function LibraryScreen() { // Renamed component for clarity
  const dispatch = useDispatch();
  const { user, isSignedIn } = useUser();
  const { signOut } = useAuth();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (!isSignedIn) return;
    setIsLoggingOut(true);
    try {
      await signOut();
      await tokenManager.clearTokens();
    } catch (error) {
      console.error("Error logging out:", error);
      // Handle logout error (e.g., show a message)
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogin = () => {
    dispatch(openModal(<SignInWithYouTube />));
  };

  const handleAddPress = () => {
    console.log("Add icon pressed");
    // Navigate to create playlist screen or show modal, etc.
  };

  const handleSettingsPress = () => {
    console.log("Settings icon pressed");
    // Navigate to settings screen
    // navigation.navigate("settings"); // Example navigation
  };

  const handleHistoryPress = async () => {
    console.log("History icon pressed");
    // const res = await authApi.get("/api/songs/fetchhistory?page=1");
    navigation.navigate("history")
  }

  const handleLikedSongsPress = () => {
    console.log("Liked Songs icon pressed");
  }

  const handlePlaylistsPress = () => {
    console.log("Playlists icon pressed");
  }
  

  // --- Login View ---
  if (!isSignedIn) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <Text variant="titleLarge" style={styles.loginPrompt}>
          Log in to view your library.
        </Text>
        <Button
          icon="login"
          mode="contained"
          onPress={handleLogin}
          style={styles.loginButton}
        >
          Login
        </Button>
      </SafeAreaView>
    );
  }

  // --- Logged In View (Spotify Library Style) ---
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => console.log("Profile pressed")}>
            {user?.imageUrl ? (
              <Avatar.Image size={36} source={{ uri: user.imageUrl }} />
            ) : (
              <Avatar.Icon size={36} icon="account" /> // Placeholder icon
            )}
          </TouchableOpacity>
          <Text variant="titleLarge" style={styles.headerTitle}>Library</Text>
        </View>
        <View style={styles.headerRight}>
          <IconButton
            icon="plus"
            size={28}
            onPress={handleAddPress}
            iconColor={colors.onSurface} // Use theme color
          />
          <IconButton
            icon="cog-outline" // Or 'settings' depending on icon pack
            size={24}
            onPress={handleSettingsPress}
            iconColor={colors.onSurface} // Use theme color
          />
           {/* Optional: Add logout directly to settings or keep it separate */}
           {/* <IconButton
             icon="logout"
             size={24}
             onPress={handleLogout}
             disabled={isLoggingOut}
             iconColor={colors.onSurface}
           /> */}
        </View>
      </View>

      {/* Library Content Area */}
      <ScrollView style={styles.contentArea}>
        <View style={styles.squareButtonContainer}>
          <SquareIconButton icon='history' onPress={handleHistoryPress} text="Recents" />
          <SquareIconButton icon="heart" onPress={handleLikedSongsPress} text="Liked Songs" />
          <SquareIconButton icon="playlist-music" onPress={handlePlaylistsPress} text="Playlists" />
          {/* <SquareIconButton icon="playlist-music" onPress={handlePlaylistsPress} text="Playlists" /> */}
        </View>
        {/* Example: Add other buttons or content */}
        <Button
            icon="update"
            mode="contained"
            buttonColor={colors.secondary}
            onPress={() => navigation.navigate("updater")}
            style={{ marginVertical: 20 }}
        >
            Update App
        </Button>
        <Button
            disabled={isLoggingOut}
            loading={isLoggingOut}
            icon="logout"
            mode="outlined"
            onPress={handleLogout}
            style={{ marginBottom: 20 }}
        >
            Logout
        </Button>
        {/* Add Lists for Playlists, Artists, Albums etc. */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loginPrompt: {
    marginBottom: 20,
    textAlign: 'center',
  },
  loginButton: {
    width: '80%',
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    fontWeight: "bold",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  contentArea: {
    flex: 1,
    padding: 15,
  },
  squareButtonContainer: {
    gap: 20,
  }
});

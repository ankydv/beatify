import { Image, ScrollView, StyleSheet, View } from "react-native";
import { openModal } from "@/state/slices/modal.slice";
import { useDispatch } from "react-redux";
import ClerkSignIn from "@/components/ClerkSignIn";
import { useState } from "react";
import { useNavigation } from "expo-router";
import { Button, Text, useTheme,IconButton } from "react-native-paper";
import { useAuth, useUser } from "@clerk/clerk-expo";
import History from "../library/history";
import { SafeAreaView } from "react-native-safe-area-context";
import Playlists from "../library/playlists";
import store from "@/state/store";

export default function TabTwoScreen() {
  const dispatch = useDispatch();
  const { user, isSignedIn } = useUser();
  const { signOut } = useAuth();
  const name = user?.fullName;
  const picture = user?.imageUrl;
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  const handleAuthPress = async () => {
    if (isSignedIn) {
      setIsLoading(true);
      try {
        // Full session teardown BEFORE Clerk signs out: leave any voice room
        // (socket + audio + UI), sever socket auth, unregister FCM and silence
        // notifications — so nothing chat/party survives logout.
        try {
          const { socket } = require('@/configs/socket');
          try {
            const rid = store.getState()?.party?.roomId;
            socket.emit('leave-room', rid ? { roomId: rid } : {});
          } catch (e) {}
        } catch (e) {}
        try {
          const { teardownPartyPlayer } = require('@/utils/partyPlayback.utils');
          await teardownPartyPlayer(store.dispatch).catch(() => {});
        } catch (e) {}
        try {
          store.dispatch({ type: 'party/resetParty' });
        } catch (e) {}
        try {
          const { unregisterPushNotifications } = require('@/services/notification.service');
          await unregisterPushNotifications(null).catch(() => {});
        } catch (e) {}
        try {
          const { disconnectSocket } = require('@/configs/socket');
          disconnectSocket();
        } catch (e) {}
      } finally {
        await signOut();
        setIsLoading(false);
      }
      return;
    }
    dispatch(openModal(<ClerkSignIn />));
  };

  const UpdateButton = () => {
    return (
      <Button
        icon="update"
        mode="contained"
        buttonColor={colors.secondary}
        onPress={() => navigation.navigate("updater")}
      >
        Update
      </Button>
    );
  };

  const OfflineButton = () => {
    return (
      <Button
        icon="download"
        mode="outlined"
        onPress={() => navigation.navigate("offline-library")}
      >
        Offline Library
      </Button>
    );
  };

  if (!isSignedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <Button
          disabled={isLoading}
          loading={isLoading}
          icon="login"
          mode="contained"
          onPress={handleAuthPress}
        >
          Login
        </Button>
        <UpdateButton />
        <OfflineButton />
      </SafeAreaView>
    );
  }
  return (
    <ScrollView>
      <SafeAreaView style={styles.container}>
        <View style={[styles.profileContainer, {backgroundColor: colors.surface, borderColor: colors.secondary}]}>
          <View style={{flexDirection: "row", alignItems: "center", gap: 10}}>
            {picture && (
              <Image source={{ uri: picture }} height={100} width={100} borderRadius={20}></Image>
            )}
            <Text variant="titleLarge" style={styles.title}>{name}</Text>
          </View>
          <View>
            <IconButton icon={'exit-to-app'} size={35} onPress={handleAuthPress}/>
          </View>
        </View>
        <OfflineButton />
        <History />
        <Playlists />
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
    padding: 5,
    marginBottom: 100,
  },
  profileContainer:{
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontWeight: "bold",
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: "80%",
  },
});

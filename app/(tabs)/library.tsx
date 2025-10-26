import { Image, StyleSheet, View } from "react-native";
import { openModal } from "@/state/slices/modal.slice";
import { useDispatch } from "react-redux";
import SignInWithYouTube from "@/components/ClerkSignIn";
import { useState } from "react";
import { useNavigation } from "expo-router";
import { Button, Text, useTheme,IconButton } from "react-native-paper";
import { useAuth, useUser } from "@clerk/clerk-expo";
import History from "../library/history";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TabTwoScreen() {
  const dispatch = useDispatch();
  const { user, isSignedIn } = useUser();
  const { signOut } = useAuth();
  const name = user?.fullName;
  const picture = user?.imageUrl;
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  const test = async () => {
    if (isSignedIn) {
      setIsLoading(true);
      await signOut();
      setIsLoading(false);
      return;
    }
    dispatch(openModal(<SignInWithYouTube />));
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

  if (!isSignedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <Button
          disabled={isLoading}
          loading={isLoading}
          icon="login"
          mode="contained"
          onPress={test}
        >
          Login
        </Button>
        <UpdateButton />
        
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.profileContainer, {backgroundColor: colors.surface, borderColor: colors.secondary}]}>
        <View style={{flexDirection: "row", alignItems: "center", gap: 10}}>
          {picture && (
            <Image source={{ uri: picture }} height={100} width={100} borderRadius={20}></Image>
          )}
          <Text variant="titleLarge" style={styles.title}>{name}</Text>
        </View>
        <View>
          <IconButton icon={'exit-to-app'} size={35} onPress={test}/>
        </View>
      </View>
      <History />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
    padding: 5,
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

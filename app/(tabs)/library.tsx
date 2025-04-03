import { Image, StyleSheet, View } from "react-native";
import { openModal } from "@/state/slices/modal.slice";
import { useDispatch } from "react-redux";
import SignInWithYouTube from "@/components/ClerkSignIn";
// import useUser from "@/hooks/user.hook";
import { useEffect, useState } from "react";
import { useNavigation } from "expo-router";
import { ActivityIndicator, Button, Text, useTheme } from "react-native-paper";
import { useAuth, useUser } from "@clerk/clerk-expo";

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
      <View style={styles.container}>
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
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <Text variant="titleLarge" style={styles.title}>{`Welcome ${name}`}</Text>
      {picture && (
        <Image source={{ uri: picture }} height={100} width={100}></Image>
      )}
      <UpdateButton />
      <Button
        disabled={isLoading}
        loading={isLoading}
        icon="logout"
        mode="outlined"
        onPress={test}
      >
        Logout
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
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

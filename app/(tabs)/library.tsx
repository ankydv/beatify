import { Image, StyleSheet, View } from "react-native";
import { openModal } from "@/state/slices/modal.slice";
import { useDispatch, useSelector } from "react-redux";
import SignInWithYouTube from "@/components/SignInWithYouTube";
import { logout } from "@/state/slices/auth.slice";
import useUser from "@/hooks/user.hook";
import { useEffect } from "react";
import { useNavigation } from "expo-router";
import { Button, Text, useTheme } from "react-native-paper";

export default function TabTwoScreen() {
  const dispatch = useDispatch();
  const { isLoggedIn } = useSelector((state: any) => state.auth);
  const { user } = useUser();
  const name = user?.name;
  const picture = user?.picture;
  const navigation = useNavigation();
  const { colors } = useTheme();
  

  useEffect(() => {
    console.log(user);
  }, [user]);

  const test = () => {
    if (isLoggedIn) {
      dispatch(logout());
      return;
    }
    dispatch(openModal(<SignInWithYouTube />));
  };

  const UpdateButton = () => {
    return (
      <Button icon='update' 
        mode="contained" 
        buttonColor={colors.secondary}
        onPress={() => navigation.navigate("updater")}>
        Update
      </Button>
    );
  };

  if (!isLoggedIn) {
    return (
      <View style={styles.container}>
        <Button icon="login" mode="contained" onPress={test}>
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
      <Button icon="logout" mode="outlined" onPress={test}>
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

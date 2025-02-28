import { Button, Image, StyleSheet } from "react-native";
import { Text, View } from "@/components/Themed";
import { openModal } from "@/state/slices/modal.slice";
import { useDispatch, useSelector } from "react-redux";
import SignInWithYouTube from "@/components/SignInWithYouTube";
import { logout } from "@/state/slices/auth.slice";
import useUser from "@/hooks/user.hook";
import { useEffect } from "react";
import { useNavigation } from "expo-router";

export default function TabTwoScreen() {
  const dispatch = useDispatch();
  const { isLoggedIn } = useSelector((state: any) => state.auth);
  const { user } = useUser();
  const name = user?.name;
  const picture = user?.picture;
  const navigation = useNavigation();

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

  if(!isLoggedIn){
    return(
      <View style={styles.container}>
        <Button title="Login (coming soon)" disabled onPress={test}></Button>
        <Button title="Update" onPress={() => navigation.navigate('updater')}></Button>
      </View>
    )
  }
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{`Welcome ${name}`}</Text>
      {picture && <Image source={{uri: picture}} height={100} width={100}></Image>}
      <View
        style={styles.separator}
        lightColor="#eee"
        darkColor="rgba(255,255,255,0.1)"
      />
      <Button title={isLoggedIn ? "Logout" : "Login"} onPress={test}></Button>
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
    fontSize: 20,
    fontWeight: "bold",
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: "80%",
  },
});

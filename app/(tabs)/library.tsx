import { Button, StyleSheet } from "react-native";
import { Text, View } from "@/components/Themed";
import { openModal } from "@/state/slices/modal.slice";
import { useDispatch, useSelector } from "react-redux";
import SignInWithYouTube from "@/components/SignInWithYouTube";
import { logout } from "@/state/slices/auth.slice";

export default function TabTwoScreen() {
  const dispatch = useDispatch();
  const {isLoggedIn} = useSelector((state : any) => state.auth);
  const test = () => {
    if(isLoggedIn){
        dispatch(logout());
        return;
    }
    dispatch(openModal(<SignInWithYouTube />));
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tab Library</Text>
      <View
        style={styles.separator}
        lightColor="#eee"
        darkColor="rgba(255,255,255,0.1)"
      />
      <Button title={isLoggedIn?'Logout':'Login'} onPress={test}></Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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

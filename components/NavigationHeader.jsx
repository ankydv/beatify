import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BubbleIcon from "./BubbleIcon";
import { useNavigation } from "expo-router";

const NavigationHeader = ({title, isScrolled}) => {
  
  const navigation = useNavigation();


  const onPress = () => navigation.goBack();

  return (
    <SafeAreaView
      style={[styles.topButtons, isScrolled && { backgroundColor: "black" }]}
    >
      <BubbleIcon
        name="arrow-back"
        size={24}
        onPress={onPress}
      />
      {isScrolled && <Text style={styles.title}>{title}</Text>}
    </SafeAreaView>
  );
};

export default NavigationHeader;

const styles = StyleSheet.create({
  topButtons: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 10,
  },
  title: {
    fontSize: 18,
    color: "white",
  },
});
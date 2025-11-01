import { View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { StyleSheet } from "react-native";
import {useHistoryApi} from '@/hooks/library.hooks/history.hooks';
import { useEffect, useState } from "react";
import HistoryList from "./HistoryList";

const History = () => {

    const {getHistory} = useHistoryApi();
    const [history, setHistory] =  useState();
    const [isLoading, setIsLoading] = useState(true);


    useEffect(() => {
        getHistory().then((res) => {
            setHistory(res);
        }).catch((err) => {
            console.log(err);
        }).finally(() => {
            setIsLoading(false);
        });
    }, []);
    
    if (isLoading) {
        return <ActivityIndicator size="large" animating={true}/>;
    }
  return <View style={styles.container}>
    <Text variant="titleLarge">Your Recent Songs</Text>
    <View style={{marginTop: 10}}>
        {history && <HistoryList histories={history.history} />}
    </View>
  </View>;
};

export default History; 


export const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    // justifyContent: "center",
    // alignItems: "center",
  },
});

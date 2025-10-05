import MusicList from "@/components/MusicList";
import { useEffect } from "react";
import { authApi } from "@/configs/axios";
import { useState } from "react";
import { ActivityIndicator, Button, Text } from "react-native-paper";
import { View } from "react-native";
import { useNavigation } from "expo-router";

const HistoryPage = () => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [isloadMorePossible, setisLoadMorePossible] = useState(true);
  const [lastDate, setLastDate] = useState();

  const navigation = useNavigation();

  const loadHistory = () => {
    if (!isloadMorePossible) return;
    setIsLoading(true);
    authApi
      .get(
        `/api/songs/fetchhistory?page=${page}${
          history.length !== 0 ? "&lastDate=" + lastDate : ""
        }`
      )
      .then((res) => {
        setHistory([...history, ...res.data.data]); // Update the history state with res.data
        setIsLoading(false);
        setPage((prev) => prev + 1);
        setisLoadMorePossible(
          parseInt(res.data.currentPage) + 1 < res.data.totalPages
        );
        if (!lastDate && history.length !== 0)
          setLastDate(res.data.data[res.data.data.length - 1].date);
      })
      .catch((error) => {
        console.error("Error fetching history:", error);
      });
  };
  useEffect(() => {
    loadHistory();
  }, []);

  if (!isloadMorePossible && history.length === 0)
    return (
      <View style={{ alignItems: "center", flex: 1, justifyContent: 'center', gap: 20 }}>
        <Text variant="headlineMedium">Seems you're new here!</Text>
        <Button  mode="contained" onPress={()=>navigation.navigate('search')}>Search your favourites</Button>
        <Button mode="contained" onPress={()=>navigation.navigate('homeRoutes')}>Explore</Button>
      </View>
    );

  return (
    <>
      <MusicList
        dataset={history.map((item) => item.music)}
        onEndReached={() => loadHistory()}
      />
      {isLoading && <ActivityIndicator />}
      {!isloadMorePossible && <Text>No more songs to load</Text>}
    </>
  );
};

export default HistoryPage;

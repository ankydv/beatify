import React from "react";
import MusicList from "./MusicList";
import { ScrollView, View } from "react-native";
import { useDispatch } from "react-redux";
import { loadAndPlayTrack } from "@/state/slices/audio.slice";
import { useRouter } from "expo-router";
import { showUnimplementedFeatureAlert } from "@/utils/alerts.utils";
import { useTheme } from "@react-navigation/native";
import { Text } from "react-native-paper";

const SearchResults = ({ results }) => {

  const dispatch = useDispatch();
  const router = useRouter();
  const { colors } = useTheme();

  const handlePress = (item) => {
    const isAlbum = item.resultType==='album';
    const isPlaylist = item.resultType==='playlist';
    const isArtist = item.resultType==='artist';
    if(item.videoId){
      dispatch(loadAndPlayTrack({track: item}))
      router.push("/player");
    }
    else if(isAlbum || isPlaylist){
      router.push({
        pathname: "/(tabs)/homeRoutes/Album",
        params: { id: item.browseId, isPlaylist: isPlaylist }, 
      });
    }
    else{
      showUnimplementedFeatureAlert();
    }
  }

  if(results.length === 0)
    return (
      <View style={{justifyContent: 'center', alignItems: 'center',}}>
        <Text variant="headlineLarge" >Your search results will appear here</Text>
      </View>
  )
  return (
    <ScrollView>
      {results?.map((item, index) => (
        <View key={index} style={{marginBottom: 10, marginTop: 5, paddingHorizontal: 5,}}>
          <Text variant="titleLarge" style={{paddingLeft: 10, fontWeight: 'bold'}} >{item.category}</Text>
          <MusicList dataset={item.data} onPress={handlePress} />
        </View>
      ))}
    </ScrollView>
  );
};

export default SearchResults;

import React from "react";
import MusicList from "./MusicList";
import { ScrollView } from "react-native";
import { Text, View } from "./Themed";
import { useDispatch } from "react-redux";
import { loadAndPlayTrack } from "@/state/slices/audio.slice";
import { useRouter } from "expo-router";
import { showUnimplementedFeatureAlert } from "@/utils/alerts.utils";

const SearchResults = ({ results }) => {

  const dispatch = useDispatch();
  const router = useRouter();

  const handlePress = (item) => {
    const isAlbum = item.resultType==='album';
    const isPlaylist = item.resultType==='playlist';
    const isArtist = item.resultType==='artist';
    if(item.videoId){
      dispatch(loadAndPlayTrack({track: item}))
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

  return (
    <ScrollView>
      {results?.map((item, index) => (
        <View key={index}>
          <Text style={{fontSize: 20, fontWeight: 'bold', padding: 10}}>{item.category}</Text>
          <MusicList dataset={item.data} onPress={handlePress} />
        </View>
      ))}
    </ScrollView>
  );
};

export default SearchResults;

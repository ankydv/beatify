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
    const isArtist = item.resultType==='artist' || item.subscribers;
    if(item.videoId){
      dispatch(loadAndPlayTrack({track: item}))
      router.push("/player");
    }
    else if(isArtist){
      console.log('artist clicked');
      router.push(
        {pathname: "/artist", params: {id: item.browseId}}
      );
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
        <Text style={{fontSize: 30, fontWeight: 'bold', textAlign: 'center', paddingVertical: 20}}>Your search results will appear here</Text>
      </View>
  )
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

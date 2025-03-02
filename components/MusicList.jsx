import React, { useEffect } from "react";
import { View } from "react-native";
import MusicListItem from "./songListItem";
import { useDispatch } from "react-redux";
import { loadAndPlayTrack } from "@/state/slices/audio.slice";
import { useNavigation } from "expo-router";

const MusicList = ({ dataset, isQueue, onPress }) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();

  if(!onPress){
    onPress = (song) => {
      dispatch(loadAndPlayTrack({ track: song, isQueueTrack: isQueue }));
      if(!isQueue)
        navigation.navigate("player");
    }
}

  const formatArtists = (artists) => {
    if (!artists || artists.length === 0) return "";
    return artists.map((artist) => artist.name).join(" ");
  };

  const getThumbUrl = (song) => {
    if(song.thumbnail){
      return song.thumbnail[0].url;
    }
    else if(song.thumbnails)
        return song.thumbnails[0].url
    else return null;
  }

  return (
    <View>
      {dataset?.map((song, index) => (
        <MusicListItem
          key={index}
          title={song.title || song.name || song.artist}
          subtitle={formatArtists(song.artists)}
          imageUrl={getThumbUrl(song)}
          onPress={() => onPress(song)}
          isQueue={isQueue}
          index = {index}
        />
      ))}
    </View>
  );
};

export default MusicList;

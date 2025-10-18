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

  const getTitle = (song) => {
    let title =  song.title || song.name || song.artist
    if(!title && song.resultType === 'artist')
      return formatArtists(song.artists);
    return title;
  }

  const getSubtitle = (song) => {
    if(song.resultType === 'artist')
      return song.subscribers || 'artist';
    else if(song.resultType === 'playlist')
        return song.author;
    else if(song.resultType === 'episode')
        return song.podcast.name;
    else if(song.resultType === 'podcast')
        return 'podcast';
    return formatArtists(song.artists);
  }

  return (
    <View>
      {dataset?.map((song, index) => (
        <MusicListItem
          key={index}
          title={getTitle(song)}
          subtitle={getSubtitle(song)}
          imageUrl={getThumbUrl(song)}
          onPress={() => onPress(song)}
          isQueue={isQueue}
          index = {index}
          resultType = {song.resultType}
        />
      ))}
    </View>
  );
};

export default MusicList;

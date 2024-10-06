import React, { useEffect } from "react";
import { View } from "react-native";
import MusicListItem from "./songListItem";
import { useDispatch } from "react-redux";
import { loadAndPlayTrack } from "@/state/slices/audio.slice";

const MusicList = ({ dataset, isQueue, onPress }) => {
  const dispatch = useDispatch();

  if(!onPress){
    onPress = (song) => {
      dispatch(loadAndPlayTrack({ track: song, isQueueTrack: isQueue }));
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
          title={song.title || song.name}
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

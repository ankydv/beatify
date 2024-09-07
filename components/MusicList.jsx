import React, { useEffect } from "react";
import { View } from "react-native";
import MusicListItem from "./songListItem";
import { useDispatch } from "react-redux";
import { loadAndPlayTrack } from "@/state/slices/audio.slice";

const MusicList = ({ dataset }) => {
    const dispatch = useDispatch();

  const handlePress = (song) => {
    dispatch(loadAndPlayTrack(song));
  };

  const formatArtists = (artists) => {
    if (!artists || artists.length === 0) return "";
    return artists.map((artist) => artist.name).join(" ");
  };
  
  return (
    <View>
      {dataset?.map((song, index) => (
        <MusicListItem
          key={index}
          title={song.title}
          subtitle={formatArtists(song.artists)}
          imageUrl={song.thumbnails[0].url}
          onPress={()=>handlePress(song)}
        />
      ))}
    </View>
  );
};

export default MusicList;

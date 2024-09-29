import React, { useEffect } from "react";
import { View } from "react-native";
import MusicListItem from "./songListItem";
import { useDispatch } from "react-redux";
import { loadAndPlayTrack } from "@/state/slices/audio.slice";

const MusicList = ({ dataset, isQueue }) => {
  const dispatch = useDispatch();

  const handlePress = (song) => {
    dispatch(loadAndPlayTrack({ track: song, isQueueTrack: isQueue }));
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
          title={song.title || song.name}
          subtitle={formatArtists(song.artists)}
          imageUrl={
            song.thumbnails ? song.thumbnails[0].url : song.thumbnail[0].url
          }
          onPress={() => handlePress(song)}
          isQueue={isQueue}
        />
      ))}
    </View>
  );
};

export default MusicList;

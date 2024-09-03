import React from "react";
import MusicListItem from "../components/songListItem";
import { View } from "react-native";
import { loadAndPlayTrack } from "@/state/slices/audio.slice";
import { useDispatch } from "react-redux";

const SearchResults = ({ results }) => {
  const dispatch = useDispatch();
  const formatArtists = (artists) => {
    if (!artists || artists.length === 0) return "";
    return artists.map((artist) => artist.name).join(" ");
  };

  const handlePress = (song) => {
    dispatch(loadAndPlayTrack(song));
    console.log(song);
  };

  return (
    <View>
      {results.data &&
        results.data.map((song, index) => (
          <MusicListItem
            key={index}
            title={song.title}
            subtitle={formatArtists(song.artists)}
            imageUrl={song.thumbnails[0].url}
            onPress={() => handlePress(song)}
          />
        ))}
    </View>
  );
};

export default SearchResults;

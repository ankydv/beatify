import React, { useState, useCallback } from "react";
import { View } from "react-native";
import MusicListItem from "./songListItem";
import { useDispatch } from "react-redux";
import { loadAndPlayTrack } from "@/state/slices/audio.slice";
import { useNavigation } from "expo-router";
import SongActionModal from "./SongActionModal";
import { handleVoiceRoomSongTap } from "@/utils/partyPlayback.utils";

const MusicList = ({ dataset, isQueue, onPress, onMorePress }) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const [selectedSongForMenu, setSelectedSongForMenu] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const handleDefaultPress = async (song) => {
    const isArtist = song.resultType === 'artist' || Boolean(song.subscribers);
    const isAlbum = song.resultType === 'album';
    const isPlaylist = song.resultType === 'playlist';

    if (isArtist) {
      const artistId =
        song.browseId ||
        song.channelId ||
        song.id ||
        (Array.isArray(song.artists) && song.artists[0]?.id) ||
        (song.artist && typeof song.artist === 'object' ? song.artist.id : null);
      if (artistId) {
        navigation.navigate("artist", { id: artistId });
      }
    } else if (isAlbum || isPlaylist) {
      navigation.navigate("album", { id: song.browseId || song.playlistId, isPlaylist: Boolean(isPlaylist) });
    } else {
      // If connected to a voice/party room, intercept and add to room queue / request
      const handled = await handleVoiceRoomSongTap(song);
      if (handled) return;

      try {
        await dispatch(
          loadAndPlayTrack({
            track: song,
            isQueueTrack: isQueue,
            newQueue: Object.assign({}, { tracks: dataset }),
          })
        ).unwrap();
        if (!isQueue) {
          navigation.navigate("player");
        }
      } catch (_) {}
    }
  };

  const handleItemPress = useCallback(async (song) => {
    const isArtist = song.resultType === 'artist' || Boolean(song.subscribers);
    const isAlbum = song.resultType === 'album';
    const isPlaylist = song.resultType === 'playlist';

    if (!isArtist && !isAlbum && !isPlaylist && (song.videoId || song.id)) {
      const handled = await handleVoiceRoomSongTap(song);
      if (handled) return;
    }

    if (onPress) {
      onPress(song);
    } else {
      handleDefaultPress(song);
    }
  }, [onPress]);

  const openSongMenu = useCallback((song) => {
    if (onMorePress) {
      onMorePress(song);
    } else {
      setSelectedSongForMenu(song);
      setMenuVisible(true);
    }
  }, [onMorePress]);

  const formatArtists = (artists) => {
    if (!artists || artists.length === 0) return "";
    return artists.map((artist) => artist.name).join(" ");
  };

  const getThumbUrl = (song) => {
    if (song.thumbnail) {
      return song.thumbnail[0].url;
    } else if (song.thumbnails) {
      return song.thumbnails[0].url;
    } else {
      return null;
    }
  };

  const getTitle = (song) => {
    let title = song.title || song.name || song.artist;
    if (!title && song.resultType === 'artist') {
      return formatArtists(song.artists);
    }
    return title;
  };

  const getSubtitle = (song) => {
    if (song.resultType === 'artist') {
      return song.subscribers || 'artist';
    } else if (song.resultType === 'playlist') {
      return song.author;
    } else if (song.resultType === 'episode') {
      return song.podcast.name;
    } else if (song.resultType === 'podcast') {
      return 'podcast';
    }
    return formatArtists(song.artists);
  };

  return (
    <View>
      {dataset?.map((song, index) => (
        <MusicListItem
          key={song.videoId || song.browseId || index}
          title={getTitle(song)}
          subtitle={getSubtitle(song)}
          imageUrl={getThumbUrl(song)}
          onPress={() => handleItemPress(song)}
          onMorePress={() => openSongMenu(song)}
          isQueue={isQueue}
          index={index}
          resultType={song.resultType}
        />
      ))}

      <SongActionModal
        visible={menuVisible}
        song={selectedSongForMenu}
        onClose={() => {
          setMenuVisible(false);
          setSelectedSongForMenu(null);
        }}
      />
    </View>
  );
};

export default MusicList;

import React, { memo, useCallback, useState } from "react";
import { View } from "react-native";
import MusicListItem from "./songListItem";
import { useDispatch } from "react-redux";
import { loadAndPlayTrack } from "@/state/slices/audio.slice";
import { useNavigation } from "expo-router";
import SongActionModal from "./SongActionModal";
import { handleVoiceRoomSongTap } from "@/utils/partyPlayback.utils";

const formatArtists = (artists) => {
  if (!artists || artists.length === 0) return "";
  return artists.map((artist) => artist.name ?? artist).join(" ");
};

const getThumbUrl = (song) => {
  // Backend populates thumbnail as { thumbnails: [{url}] },
  // search APIs use thumbnail/thumbnails arrays.
  const t = song?.thumbnail;
  if (Array.isArray(t)) return t[0]?.url ?? null;
  if (Array.isArray(t?.thumbnails)) return t.thumbnails[0]?.url ?? null;
  if (typeof t === "string") return t;
  if (Array.isArray(song?.thumbnails)) return song.thumbnails[0]?.url ?? null;
  return null;
};

const getTitle = (song) => {
  const title = song?.title || song?.name || song?.artist;
  if (!title && song?.resultType === 'artist') {
    return formatArtists(song.artists);
  }
  return title ?? 'Unknown';
};

const getSubtitle = (song) => {
  if (song?.resultType === 'artist') {
    return song.subscribers || 'artist';
  } else if (song?.resultType === 'playlist') {
    return song.author;
  } else if (song?.resultType === 'episode') {
    return song?.podcast?.name;
  } else if (song?.resultType === 'podcast') {
    return 'podcast';
  }
  if (typeof song?.artists === 'string') return song.artists;
  if (typeof song?.author === 'string') return song.author;
  return formatArtists(song?.artists);
};

// Row is memo'd — parent state churn (menu open, removal) must not
// re-render every row. Props are primitives + stable callbacks.
const Row = memo(function Row({ song, index, isQueue, onPress, onMorePress }) {
  return (
    <MusicListItem
      title={getTitle(song)}
      subtitle={getSubtitle(song)}
      imageUrl={getThumbUrl(song)}
      onPress={() => onPress(song)}
      onMorePress={() => onMorePress(song)}
      isQueue={isQueue}
      index={index}
      resultType={song.resultType}
    />
  );
});

const keyFor = (song, index) => (
  song?._id || song?.videoId || song?.browseId || song?.id || `${song?.title || song?.name || 'song'}_${index}`
);

const MusicList = ({ dataset, isQueue, onPress, onMorePress, playlistId = null, isUserPlaylist = false, onSongRemoved = null }) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const [selectedSongForMenu, setSelectedSongForMenu] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);

  // Default tap behaviour (queue + navigate). useCallback'd on `dataset`
  // so the press path below stays referentially stable.
  const handleDefaultPress = useCallback(async (song) => {
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
            newQueue: { tracks: dataset },
          })
        ).unwrap();
        if (!isQueue) {
          navigation.navigate("player");
        }
      } catch (_) {}
    }
  }, [dataset, dispatch, navigation, isQueue]);

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
  }, [onPress, handleDefaultPress]);

  const openSongMenu = useCallback((song) => {
    if (onMorePress) {
      onMorePress(song);
    } else {
      setSelectedSongForMenu(song);
      setMenuVisible(true);
    }
  }, [onMorePress]);

  const closeMenu = useCallback(() => {
    setMenuVisible(false);
    setSelectedSongForMenu(null);
  }, []);

  // Plain .map: this list lives inside a parent ScrollView, so FlatList
  // virtualization is defeated anyway — a nested VirtualizedList only adds
  // cell bookkeeping + blank-area flashes. (Same split as playlists.jsx:
  // small embedded lists use map; large standalone lists keep FlatList.)
  const safeData = Array.isArray(dataset) ? dataset : [];

  return (
    <View>
      {safeData.map((song, index) => (
        <Row
          key={keyFor(song, index)}
          song={song}
          index={index}
          isQueue={isQueue}
          onPress={handleItemPress}
          onMorePress={openSongMenu}
        />
      ))}

      <SongActionModal
        visible={menuVisible}
        song={selectedSongForMenu}
        playlistId={playlistId}
        isUserPlaylist={isUserPlaylist}
        onSongRemoved={onSongRemoved}
        onClose={closeMenu}
      />
    </View>
  );
};

export default MusicList;

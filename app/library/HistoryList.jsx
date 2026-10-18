import React, { useMemo, useState } from "react";
import { View } from "react-native";
import MusicListItem from "@/components/songListItem";
import { useDispatch } from "react-redux";
import { loadAndPlayTrack } from "@/state/slices/audio.slice";
import SongActionModal from "@/components/SongActionModal";
import { handleVoiceRoomSongTap } from "@/utils/partyPlayback.utils";

const HistoryList = ({ histories }) => {
  const dispatch = useDispatch();
  const [selectedSong, setSelectedSong] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);

  // Defensive dedupe: backend now guarantees one row per (user, song), but
  // pre-migration duplicates may still exist in DB — never render the same
  // song twice.
  const uniqueHistories = useMemo(() => {
    if (!Array.isArray(histories)) return histories;
    const seen = new Set();
    return histories.filter((history) => {
      const key =
        history?.song?._id?.toString?.() ||
        history?.song?.videoId ||
        history?.song?.title;
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [histories]);

  const playSong = async (song) => {
    const handled = await handleVoiceRoomSongTap(song);
    if (handled) return;
    dispatch(loadAndPlayTrack({ track: song, isQueueTrack: false }));
  };

  return (
    <View>
      {uniqueHistories?.map((history, index) => (
        <MusicListItem
          key={history?._id?.toString?.() || history?.song?._id?.toString?.() || history?.song?.videoId || index}
          title={history.song?.title}
          subtitle={history.song?.author}
          imageUrl={history.song?.thumbnail?.thumbnails?.[0]?.url}
          onPress={() => playSong(history.song)}
          onMorePress={() => {
            setSelectedSong(history.song);
            setMenuVisible(true);
          }}
        />
      ))}

      <SongActionModal
        visible={menuVisible}
        song={selectedSong}
        onClose={() => {
          setMenuVisible(false);
          setSelectedSong(null);
        }}
      />
    </View>
  );
};

export default HistoryList;
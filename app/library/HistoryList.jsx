import React, { useState } from "react";
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

  const playSong = async (song) => {
    const handled = await handleVoiceRoomSongTap(song);
    if (handled) return;
    dispatch(loadAndPlayTrack({ track: song, isQueueTrack: false }));
  };

  return (
    <View>
      {histories?.map((history, index) => (
        <MusicListItem
          key={history.song?.videoId || index}
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
// utils/audioPlayerUtils.js
import TrackPlayer, { State } from 'react-native-track-player';

export const togglePlayback = async (playbackState) => {
  const currentTrack = await TrackPlayer.getActiveTrackIndex();
  if (currentTrack >= 0) {
    if (playbackState === State.Paused || playbackState === State.Ready) {
      await TrackPlayer.play();
    } else {
      await TrackPlayer.pause();
    }
  }
};

// utils/audioPlayerUtils.js
import TrackPlayer, { State } from 'react-native-track-player';
import { partyTogglePlayback } from './partyPlayback.utils';

export const togglePlayback = async (playbackState) => {
  // While a voice room owns audio, route the tap to the room instead of
  // driving TrackPlayer directly (which would desync the party).
  if (await partyTogglePlayback()) return;
  const currentTrack = await TrackPlayer.getActiveTrackIndex();
  if (currentTrack >= 0) {
    if (playbackState === State.Paused || playbackState === State.Ready) {
      await TrackPlayer.play();
    } else {
      await TrackPlayer.pause();
    }
  }
};

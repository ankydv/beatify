import TrackPlayer from 'react-native-track-player';
import store from "@/state/store";
import { playNextTrack, playPrevTrack } from "@/state/slices/audio.slice.js";

module.exports = async function () {
  const handleNext = () => {
    store.dispatch(playNextTrack());
  };

  const handlePrevious = () => {
    store.dispatch(playPrevTrack());
  };

  TrackPlayer.addEventListener('remote-play', () => TrackPlayer.play());
  TrackPlayer.addEventListener('remote-pause', () => TrackPlayer.pause());
  TrackPlayer.addEventListener('remote-next', handleNext);
  TrackPlayer.addEventListener('remote-previous', handlePrevious);
  TrackPlayer.addEventListener('remote-seek', ({ position }) => TrackPlayer.seekTo(position));
};

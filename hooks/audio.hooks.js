// hooks/useAudioControls.js
import { usePlaybackState } from 'react-native-track-player';
import { togglePlayback } from '../utils/audio.utils';

const useAudioControls = () => {
  const playback = usePlaybackState();

  const handleTogglePlayback = async () => {
    await togglePlayback(playback.state);
  };

  return {
    handleTogglePlayback,
  };
};

export default useAudioControls;

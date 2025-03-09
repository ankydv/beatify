import { useEffect, useState } from "react";
import TrackPlayer, { useTrackPlayerEvents, Event } from "react-native-track-player";

const useTrackProgress = () => {
  const [progress, setProgress] = useState({
    position: 0,
    duration: 0,
    buffered: 0,
    track: null,
    type: null,
  });

  const fetchCurrentProgress = async () => {
    const position = await TrackPlayer.getPosition();
    const duration = await TrackPlayer.getDuration();
    const buffered = await TrackPlayer.getBufferedPosition();
    const track = await TrackPlayer.getCurrentTrack();
    const type = await TrackPlayer.getState();

    setProgress((prev) => ({
      ...prev,
      position,
      duration,
      buffered,
      track,
      type,
    }));
  };

  useEffect(() => {
    fetchCurrentProgress();
  }, []); // Fetch progress when component mounts
  useTrackPlayerEvents([Event.PlaybackProgressUpdated], async (event) => {
    if (event.type === Event.PlaybackProgressUpdated) {
      setProgress((prev) => ({
        ...prev,
        position: event.position,
        duration: event.duration,
        buffered: event.buffered,
      }));
    } 
  });

  return { ...progress, setProgress };
};

export default useTrackProgress;

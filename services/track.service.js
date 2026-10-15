import TrackPlayer, { State } from 'react-native-track-player';
import store from "@/state/store";
import { playNextTrack, playPrevTrack } from "@/state/slices/audio.slice.js";
import { isPartyActive, partyTogglePlayback, partyStep, partySeek } from "@/utils/partyPlayback.utils";

module.exports = async function () {
  const handleNext = async () => {
    // Notification "next" while a room owns audio: DJ skips the whole room,
    // listeners' taps are swallowed (local skip would desync them).
    if (await partyStep(1)) return;
    store.dispatch(playNextTrack());
  };

  const handlePrevious = async () => {
    if (await partyStep(-1)) return;
    store.dispatch(playPrevTrack());
  };

  const handleToggle = async () => {
    // Notification play/pause while party-active routes to the room.
    if (await partyTogglePlayback()) return;
    try {
      const st = await TrackPlayer.getState();
      if (st === State.Playing) await TrackPlayer.pause();
      else await TrackPlayer.play();
    } catch (e) {}
  };

  const handleSeek = async ({ position }) => {
    // Android notification / lock screen / Bluetooth scrub. Un-gated, this was
    // the biggest hole: any listener could drag the room's playhead locally.
    if (await partySeek(position)) return;
    try {
      await TrackPlayer.seekTo(position);
    } catch (e) {}
  };

  TrackPlayer.addEventListener('remote-play', handleToggle);
  TrackPlayer.addEventListener('remote-pause', handleToggle);
  TrackPlayer.addEventListener('remote-next', handleNext);
  TrackPlayer.addEventListener('remote-previous', handlePrevious);
  TrackPlayer.addEventListener('remote-seek', handleSeek);
  TrackPlayer.addEventListener('playback-state', ({ state }) => {
    // Party auto-advance is reported from the UI thread (dj:track-ended);
    // the headless service must NOT also advance the personal queue here.
    if (state === State.Ended && !isPartyActive()) {
      handleNext();
    }
  });
};

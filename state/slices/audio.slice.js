import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import TrackPlayer, { Capability } from "react-native-track-player";
import getMetadata from "@/services/metadata.service";
import Metadata, { logPlayableUrl } from "@/utils/metadata.utils";
import {fetchLyrics} from "@/services/lyrics.service";
import { parseSyncedLyrics } from "@/utils/lyrics.utils";
import { getQueue } from "@/services/queue.service";
import { AppKilledPlaybackBehavior } from 'react-native-track-player';
import { prepareTrackForPlayback } from "@/utils/offline.utils";
import { getOfflineLyrics } from "@/services/offline.service";

// Initial state
const initialState = {
  isPlaying: false,
  currentTrack: null,
  metadata: null,
  queue: [],
  isInitialized: false,
  error: null,
  lyrics: null,
  songId: null,
};

// Thunk to initialize TrackPlayer
export const initializePlayer = createAsyncThunk(
  "audio/initializePlayer",
  async () => {
    try {
      await TrackPlayer.setupPlayer({autoHandleInterruptions: true});
      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
          // Capability.Like
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
        ],
        android :{
          alwaysPauseOnInterruption: true,
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,


        },
        progressUpdateEventInterval: 0.2,
        forwardJumpInterval: 5,
      });
      await TrackPlayer.setVolume(0.5);
    } catch (error) {
      if (String(error?.message || error).toLowerCase().includes("already")) {
        return true;
      }
      console.error("Error initializing TrackPlayer:", error);
      throw error;
    }
    return true;
  }
);

// Thunk to load a track and play it
export const loadAndPlayTrack = createAsyncThunk(
  "audio/loadAndPlayTrack",
  async ({track, isQueueTrack, newQueue}, { dispatch, getState }) => {
    // ROOM GUARD: the shared TrackPlayer is the room's player while a voice
    // room owns audio. Loading a personal track here would reset() the room's
    // queue and hijack it for everyone on this device (DJ included). The DJ
    // drives the room through dj:* socket commands instead.
    try {
      const { roomOwnsAudio } = await import("@/utils/partyPlayback.utils");
      if (roomOwnsAudio()) {
        const partySlice = await import("@/state/slices/party.slice");
        // Transient notice (auto-cleared) so the tap doesn't feel broken.
        dispatch(partySlice.setError("The room is playing — only the DJ can change the track"));
        setTimeout(() => {
          try {
            dispatch(partySlice.setError(null));
          } catch (e) {}
        }, 4000);
        return;
      }
    } catch (e) {}
    dispatch(resetAudio());
    try {
      if (!getState().audio.isInitialized) {
        dispatch(setIsInitialized(true));
        await dispatch(initializePlayer()).unwrap(); // Ensures the initialization is complete
      }
      const metadata = await getMetadata(track.videoId);
      if (metadata?.videoDetails?.author) {
        metadata.videoDetails.author = metadata.videoDetails.author.replace(/\s*-\s*topic$/i, "");
      }
      dispatch(setMetadata(metadata));
      const md = new Metadata(metadata);

      await TrackPlayer.reset();

      // Use the decoded, validated format + the headers googlevideo needs.
      // Proven by live probe (scripts/diag-streams.cjs): bare GET -> 403,
      // UA + Range -> 206. TrackPlayer/ExoPlayer MUST send the same UA the
      // InnerTube client used (IOS), otherwise googlevideo rejects the
      // stream even though the URL is valid.
      const details = md.getPlayableFormatDetails();
      const streamingUrl = details?.url || md.getStreamingUrl();
      if (!streamingUrl) {
        throw new Error(`No playable stream found for "${md.getTitle()}"`);
      }
      // Test hook: copy the URL from Metro/logcat into a browser on the SAME
      // device/IP before expiry. googlevideo sigs are IP-bound — a URL
      // fetched on the phone will 403 on your laptop and vice versa.
      logPlayableUrl(details, track.videoId, 'loadAndPlayTrack');
      const streamHeaders =
        details?.headers || metadata?._streamHeaders || undefined;
      const contentType = details?.mimeType
        ? details.mimeType.split(';')[0].trim()
        : 'audio/mp4';
      const artwork =
        md.getThumb("mini")?.url || md.getThumb("medium")?.url || undefined;
      const trackForPlayback = await prepareTrackForPlayback(
        track.videoId,
        streamingUrl,
        md.getTitle(),
        md.getArtists(),
        artwork
      );

      const track1 = {
        id: track.videoId,
        url: trackForPlayback.url,
        title: md.getTitle(),
        artist: md.getArtists(),
        artwork,
        isOffline: trackForPlayback.isOffline,
        // Only attach network headers for remote streams, not local files.
        // userAgent MUST equal headers['User-Agent'] (IOS client UA) — a
        // mismatched UA (e.g. Chrome default) makes googlevideo 403 the
        // stream even though the URL is valid.
        ...(trackForPlayback.isOffline
          ? {}
          : {
              headers: streamHeaders,
              contentType,
              userAgent: streamHeaders?.['User-Agent'],
            }),
      };
      await TrackPlayer.add([track1]);
      await TrackPlayer.play();
      dispatch(setCurrentTrack(track));
      dispatch(setIsPlaying(true));

      // Try to get offline lyrics first
      // Duration: md.duration is 0 unless getStreamingUrl() ran. Derive it from
      // InnerTube metadata so the lyrics duration filter actually works.
      const durationSec =
        Number(metadata?.videoDetails?.lengthSeconds) ||
        Math.round(Number(details?.approxDurationMs) / 1000) ||
        0;
      const rawAlbum = md.getAlbum?.();
      const albumName =
        rawAlbum && rawAlbum !== 'Unknown Album' ? rawAlbum : undefined;
      let lyrics = null;
      try {
        const offlineLyrics = await getOfflineLyrics(track.videoId);
        if (offlineLyrics) {
          lyrics = offlineLyrics;
        } else {
          // If no offline lyrics, fetch from online
          const fetchedLyrics = await fetchLyrics(md.getArtists(), md.getTitle(), durationSec, albumName);
          lyrics = fetchedLyrics;
        }
      } catch (error) {
        console.warn('Error fetching lyrics:', error?.message || error);
        // Try to fetch online as fallback
        try {
          const fetchedLyrics = await fetchLyrics(md.getArtists(), md.getTitle(), durationSec, albumName);
          lyrics = fetchedLyrics;
        } catch (fallbackError) {
          console.warn('Fallback lyrics fetch also failed:', fallbackError?.message || fallbackError);
        }
      }

      if (lyrics) {
        dispatch(setLyrics(parseSyncedLyrics(lyrics?.syncedLyrics)));
      }

      // Fetch related tracks to update the queue
      if(isQueueTrack){
        if(newQueue){
          dispatch(setQueue(newQueue));
        }
        else {
        const queueTracks = await getQueue(track.videoId);
        dispatch(setQueue(queueTracks));
        }
      }
    } catch (error) {
      console.error("Error loading track:", error);
      throw error;
    }
    
  }
);
const getCurrentTrackIndex = () => {

}
export const playNextTrack = createAsyncThunk(
  'audio/playNextTrack',
  async (_, { dispatch, getState }) => {
    // ROOM GUARD: while a room owns the player a local skip would desync this
    // device from the DJ. Route it through the room instead — DJ advances the
    // whole room, listener taps are swallowed.
    try {
      const { partyStep } = await import('@/utils/partyPlayback.utils');
      if (await partyStep(1)) return;
    } catch (e) {}
    const state = getState();
    const { queue, currentTrack } = state.audio;
    // Find the index of the current track in the queue
    const currentIndex = queue.tracks.findIndex(track => track.videoId === currentTrack.videoId);
    // Check if there is a next track in the queue
    if (currentIndex !== -1 && currentIndex < queue.tracks.length - 1) {
      const nextTrack = queue.tracks[currentIndex + 1];

      // Play the next track using loadAndPlayTrack
      await dispatch(loadAndPlayTrack({ track: nextTrack, isQueueTrack: true })).unwrap();
    } else {
      console.log('No more tracks in the queue');
    }
  }
);

export const playPrevTrack = createAsyncThunk(
  'audio/playNextTrack',
  async (_, { dispatch, getState }) => {
    // ROOM GUARD — see playNextTrack.
    try {
      const { partyStep } = await import('@/utils/partyPlayback.utils');
      if (await partyStep(-1)) return;
    } catch (e) {}
    const state = getState();
    const { queue, currentTrack } = state.audio;
    // Find the index of the current track in the queue
    const currentIndex = queue.tracks.findIndex(track => track.videoId === currentTrack.videoId);
    // Check if there is a next track in the queue
    if (currentIndex !== -1 && currentIndex > 0) {
      const prevTrack = queue.tracks[currentIndex - 1];

      // Play the previous track using loadAndPlayTrack
      await dispatch(loadAndPlayTrack({ track: prevTrack, isQueueTrack: true })).unwrap();
    } else {
      console.log('No more tracks in the queue');
    }
  }
);

// Audio slice
const audioSlice = createSlice({
  name: "audio",
  initialState,
  reducers: {
    setIsPlaying(state, action) {
      state.isPlaying = action.payload;
    },
    setCurrentTrack(state, action) {
      state.currentTrack = action.payload;
    },
    setMetadata(state, action) {
      state.metadata = action.payload;
    },
    setQueue(state, action) {
     // console.log("Setting queue with tracks:", action.payload.tracks); // Log the tracks being set in the queue
      state.queue = action.payload;
    },
    setIsInitialized(state, action) {
      state.isInitialized = action.payload;
    },
    setLyrics(state, action){
      state.lyrics = action.payload;
    },
    setSongId(state, action){
      state.songId = action.payload;
    },
    resetAudio(state) {
      state.isPlaying = false;
      state.lyrics=null;
      state.error = null;
    },
    setError(state, action) {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializePlayer.fulfilled, (state) => {
        state.isInitialized = true;
      })
      .addCase(initializePlayer.rejected, (state, action) => {
        state.error = action.error.message;
      })
      .addCase(loadAndPlayTrack.rejected, (state, action) => {
        state.error = action.error.message;
      });
  },
});

// Export actions and reducer
export const {
  setIsPlaying,
  setCurrentTrack,
  setQueue,
  resetAudio,
  setError,
  setIsInitialized,
  setMetadata,
  setLyrics,
  setSongId,
} = audioSlice.actions;
export default audioSlice.reducer;

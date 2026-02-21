import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import TrackPlayer, { Capability } from "react-native-track-player";
import getMetadata from "@/services/metadata.service";
import Metadata from "@/utils/metadata.utils";
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
    dispatch(resetAudio());
    try {
      if (!getState().audio.isInitialized) {
        dispatch(setIsInitialized(true));
        await dispatch(initializePlayer()).unwrap(); // Ensures the initialization is complete
      }
      const metadata = await getMetadata(track.videoId);
      metadata.videoDetails.author = metadata.videoDetails.author.replace(/\s*-\s*topic$/i, "");
      dispatch(setMetadata(metadata));
      const md = new Metadata(metadata);

      await TrackPlayer.reset();
      
      // Prepare track with offline support
      const streamingUrl = md.getStreamingUrl();
      const trackForPlayback = await prepareTrackForPlayback(
        track.videoId,
        streamingUrl,
        md.getTitle(),
        md.getArtists(),
        md.getThumb("mini").url
      );

      const track1 = {
        id: 1,
        url: trackForPlayback.url,
        title: md.getTitle(),
        artist: md.getArtists(),
        artwork: md.getThumb("mini").url,
        isOffline: trackForPlayback.isOffline,
      };
      await TrackPlayer.add([track1]);
      await TrackPlayer.play();
      dispatch(setCurrentTrack(track));
      dispatch(setIsPlaying(true));

      // Try to get offline lyrics first
      let lyrics = null;
      try {
        const offlineLyrics = await getOfflineLyrics(track.videoId);
        if (offlineLyrics) {
          lyrics = offlineLyrics;
        } else {
          // If no offline lyrics, fetch from online
          const fetchedLyrics = await fetchLyrics(md.getArtists(), md.getTitle(), md.duration);
          lyrics = fetchedLyrics;
        }
      } catch (error) {
        console.warn('Error fetching lyrics:', error);
        // Try to fetch online as fallback
        try {
          const fetchedLyrics = await fetchLyrics(md.getArtists(), md.getTitle(), md.duration);
          lyrics = fetchedLyrics;
        } catch (fallbackError) {
          console.warn('Fallback lyrics fetch also failed:', fallbackError);
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
      console.log("Setting queue with tracks:", action.payload.tracks); // Log the tracks being set in the queue
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

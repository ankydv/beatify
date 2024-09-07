import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import TrackPlayer, { Capability } from "react-native-track-player";
import getMetadata from "@/services/metadata.service";
import Metadata from "@/utils/metadata.utils";
import {fetchLyrics} from "@/services/lyrics.service";
import { parseSyncedLyrics } from "@/utils/lyrics.utils";

// Initial state
const initialState = {
  isPlaying: false,
  currentTrack: null,
  metadata: null,
  queue: [],
  isInitialized: false,
  error: null,
  lyrics: null,
};

// Thunk to initialize TrackPlayer
export const initializePlayer = createAsyncThunk(
  "audio/initializePlayer",
  async () => {
    try {
      await TrackPlayer.setupPlayer();
      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          // Capability.SeekTo,
          // Capability.Like
        ],
      });
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
  async (track, { dispatch, getState }) => {
    dispatch(resetAudio());
    try {
      if (!getState().audio.isInitialized) {
        dispatch(setIsInitialized(true));
        await dispatch(initializePlayer()).unwrap(); // Ensures the initialization is complete
      }
      const metadata = await getMetadata(track.videoId);
      dispatch(setMetadata(metadata));
      const md = new Metadata(metadata);

      await TrackPlayer.reset();
      const track1 = {
        id: 1,
        url: md.getStreamingUrl(),
        title: md.getTitle(),
        artist: md.getArtists(),
        artwork: md.getThumbUrl("mini"),
      };

      await TrackPlayer.add([track1]);

      await TrackPlayer.play();
      
      // Fetch related tracks to update the queue
      const queueTracks = null;

      dispatch(setQueue(queueTracks));
      dispatch(setCurrentTrack(track));
      dispatch(setIsPlaying(true));
    const lyrics = await fetchLyrics(md.getArtists(), md.getTitle(), md.duration);
    dispatch(setLyrics(parseSyncedLyrics(lyrics?.syncedLyrics)));
    } catch (error) {
      console.error("Error loading track:", error);
      throw error;
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
      state.queue = action.payload;
    },
    setIsInitialized(state, action) {
      state.isInitialized = action.payload;
    },
    setLyrics(state, action){
      state.lyrics = action.payload;
    },
    resetAudio(state) {
      state.isPlaying = false;
      state.lyrics=null;
      state.metadata=null;
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
} = audioSlice.actions;
export default audioSlice.reducer;

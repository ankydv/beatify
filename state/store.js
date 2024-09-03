import { configureStore } from '@reduxjs/toolkit';
import audioReducer from './slices/audio.slice'

const store = configureStore({
  reducer: {
    audio: audioReducer,
  },
});

export default store;

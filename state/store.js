import { configureStore } from '@reduxjs/toolkit';
import audioReducer from './slices/audio.slice'
import modalReducer from './slices/modal.slice';
import partyReducer from './slices/party.slice';

const store = configureStore({
  reducer: {
    audio: audioReducer,
    modal: modalReducer,
    party: partyReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these paths in serializability checks
        ignoredActions: ['modal/openModal'],
        ignoredPaths: ['modal.content'],
      },
    }),
});

export default store;

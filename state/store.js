import { configureStore } from '@reduxjs/toolkit';
import audioReducer from './slices/audio.slice'
import modalReducer from './slices/modal.slice';
import authReducer from './slices/auth.slice';

const store = configureStore({
  reducer: {
    audio: audioReducer,
    modal: modalReducer,
    auth: authReducer,
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

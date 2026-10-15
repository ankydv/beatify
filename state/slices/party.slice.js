import { createSlice } from '@reduxjs/toolkit';

// Party (shared listening) state — separate from personal audio.queue so
// leaving the party restores personal playback untouched. NOTE: the party
// follower ALSO mirrors the now-playing bundle into audio.currentTrack +
// audio.metadata (see mirrorPartyTrack) so PlayerScreen / bottom PlayerBar /
// the Android media notification show the ROOM song instead of a stale
// personal track while party audio plays.
const initialState = {
  roomId: null,
  role: 'listener', // 'dj' | 'listener'
  djSocketId: null,
  queue: [],
  pendingRequests: [],
  currentIndex: -1,
  status: 'idle', // idle | loading | playing | paused
  anchorPosMs: 0,
  anchorServerMs: null,
  playAtServerMs: null,
  cmdSeq: 0,
  offsetMs: 0,
  lastSyncAt: null,
  loadingQueueId: null,
  error: null,
};

const partySlice = createSlice({
  name: 'party',
  initialState,
  reducers: {
    setRoom(state, action) {
      state.roomId = action.payload;
    },
    applyState(state, action) {
      const s = action.payload || {};
      if (s.roomId !== undefined) state.roomId = s.roomId;
      if (s.queue !== undefined) state.queue = s.queue;
      if (s.pendingRequests !== undefined) state.pendingRequests = s.pendingRequests;
      if (s.currentIndex !== undefined) state.currentIndex = s.currentIndex;
      if (s.status !== undefined) state.status = s.status;
      if (s.anchorPosMs !== undefined) state.anchorPosMs = s.anchorPosMs;
      if (s.anchorServerMs !== undefined) state.anchorServerMs = s.anchorServerMs;
      if (s.playAtServerMs !== undefined) state.playAtServerMs = s.playAtServerMs;
      if (s.cmdSeq !== undefined) state.cmdSeq = s.cmdSeq;
      if (s.djSocketId !== undefined) state.djSocketId = s.djSocketId;
      if (s.role) state.role = s.role;
    },
    setRole(state, action) {
      state.role = action.payload;
    },
    setOffset(state, action) {
      state.offsetMs = action.payload;
      state.lastSyncAt = Date.now();
    },
    setLoading(state, action) {
      state.loadingQueueId = action.payload;
    },
    setStatus(state, action) {
      state.status = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
    },
    resetParty() {
      return { ...initialState };
    },
  },
});

export const {
  setRoom,
  applyState,
  setRole,
  setOffset,
  setLoading,
  setStatus,
  setError,
  resetParty,
} = partySlice.actions;

export const selectCurrentBundle = (state) => {
  const p = state.party;
  if (p.currentIndex < 0 || p.currentIndex >= p.queue.length) return null;
  return p.queue[p.currentIndex];
};

export const selectIsDj = (state) => state.party.role === 'dj';

export default partySlice.reducer;

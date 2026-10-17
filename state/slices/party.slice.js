import { createSlice } from '@reduxjs/toolkit';

// Party (shared listening) state — separate from personal audio.queue so
// leaving the party restores personal playback untouched. NOTE: the party
// follower ALSO mirrors the now-playing bundle into audio.currentTrack +
// audio.metadata (see mirrorPartyTrack) so PlayerScreen / bottom PlayerBar /
// the Android media notification show the ROOM song instead of a stale
// personal track while party audio plays.
const initialState = {
  roomId: null,
  title: null,
  vibe: null,
  tags: [],
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

  // ---- Room runtime (owned by PartyHost at the app root so the room keeps
  //      running while the room SCREEN is minimised) ----
  minimised: false,
  joining: false,
  joinError: null,
  connected: false,
  participants: [], // [{ id (socketId), name, picture, userId, ... }]
  presence: {}, // { [socketId]: { muted, raisedHand } }
  chat: [], // recent messages, oldest -> newest (capped)
  muted: false,
  raisedHand: false,
  audioOutput: 'speaker', // 'speaker' | 'bluetooth'
  muteIncoming: false, // true = deafened (silence music & incoming participant voice)
};

const MAX_CHAT = 200;

const partySlice = createSlice({
  name: 'party',
  initialState,
  reducers: {
    setRoom(state, action) {
      state.roomId = action.payload;
    },
    setMinimised(state, action) {
      state.minimised = !!action.payload;
    },
    setJoining(state, action) {
      state.joining = !!action.payload;
    },
    setJoinError(state, action) {
      state.joinError = action.payload;
    },
    setConnected(state, action) {
      state.connected = !!action.payload;
    },
    setParticipants(state, action) {
      state.participants = Array.isArray(action.payload) ? action.payload : [];
    },
    setPresence(state, action) {
      const { id, muted, raisedHand } = action.payload || {};
      if (!id) return;
      const prev = state.presence[id] || {};
      state.presence[id] = {
        muted: muted === undefined ? prev.muted : !!muted,
        raisedHand: raisedHand === undefined ? prev.raisedHand : !!raisedHand,
      };
    },
    clearPresence(state, action) {
      delete state.presence[action.payload];
    },
    setMuted(state, action) {
      state.muted = !!action.payload;
    },
    setRaisedHand(state, action) {
      state.raisedHand = !!action.payload;
    },
    setAudioOutput(state, action) {
      const mode = String(action.payload || '').toLowerCase();
      state.audioOutput =
        mode === 'bluetooth' || mode === 'bluetooth_hq' ? 'bluetooth' : 'speaker';
    },
    setMuteIncoming(state, action) {
      state.muteIncoming = !!action.payload;
    },
    pushChat(state, action) {
      const m = action.payload;
      if (!m?.message) return;
      const now = Date.now();
      const last = state.chat[state.chat.length - 1];
      if (last) {
        const lastId = last?._id ?? last?.id;
        const incomingId = m?._id ?? m?.id;
        if (incomingId != null && lastId != null && String(incomingId) === String(lastId)) return;
        const sameUser =
          last?.userId != null && m?.userId != null && String(last.userId) === String(m.userId);
        const sameText = last.message === m.message;
        if (sameUser && sameText && now - (last._ts || 0) < 3000) return;
      }
      state.chat.push({ ...m, _ts: now });
      if (state.chat.length > MAX_CHAT) {
        state.chat.splice(0, state.chat.length - MAX_CHAT);
      }
    },
    clearChat(state) {
      state.chat = [];
    },
    applyState(state, action) {
      const s = action.payload || {};
      if (s.roomId !== undefined) state.roomId = s.roomId;
      if (s.title !== undefined) state.title = s.title;
      if (s.vibe !== undefined) state.vibe = s.vibe;
      if (s.tags !== undefined) state.tags = s.tags;
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
  setMinimised,
  setJoining,
  setJoinError,
  setConnected,
  setParticipants,
  setPresence,
  clearPresence,
  setMuted,
  setRaisedHand,
  setAudioOutput,
  setMuteIncoming,
  pushChat,
  clearChat,
} = partySlice.actions;

export const selectCurrentBundle = (state) => {
  const p = state.party;
  if (p.currentIndex < 0 || p.currentIndex >= p.queue.length) return null;
  return p.queue[p.currentIndex];
};

export const selectIsDj = (state) => state.party.role === 'dj';

export default partySlice.reducer;

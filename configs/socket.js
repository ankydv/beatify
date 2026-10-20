import { io } from 'socket.io-client';
import { Alert, AppState } from 'react-native';

let errorShown = false;
let tokenGetter = null;
let reconnectHooked = false;
let appStateHooked = false;
let manualDisconnect = false;

// Created eagerly so existing `socket.on/emit` call sites stay safe,
// but does not connect until initializeSocket() / ensureSocketConnected() is called.
export const socket = io(process.env.EXPO_PUBLIC_AUTH_URL, {
  transports: ['websocket'],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  randomizationFactor: 0.5,
  timeout: 10000,
});

const applyToken = (token) => {
  if (!token) return;
  // Server may read either `socket.handshake.auth.token`
  // or the `Authorization` header — send both.
  socket.auth = { token };
  socket.io.opts.auth = { token };
  socket.io.opts.extraHeaders = {
    ...(socket.io.opts.extraHeaders ?? {}),
    Authorization: `Bearer ${token}`,
  };
};

const refreshToken = async () => {
  if (!tokenGetter) return null;
  try {
    const fresh = await tokenGetter();
    if (fresh) applyToken(fresh);
    return fresh;
  } catch (e) {
    console.warn('[socket] token refresh failed:', e?.message ?? e);
    return null;
  }
};

const hookTokenRefresh = () => {
  if (reconnectHooked) return;
  reconnectHooked = true;
  // Clerk tokens are short-lived — refresh before each retry
  // so a stale token doesn't cause repeated 401s.
  socket.io.on('reconnect_attempt', async () => {
    if (manualDisconnect) return;
    await refreshToken();
  });
};

const hookAppState = () => {
  if (appStateHooked) return;
  appStateHooked = true;
  AppState.addEventListener('change', async (state) => {
    // OS kills websockets while backgrounded. On foreground, force a
    // reconnect with a fresh token instead of relying on backoff.
    if (state === 'active') {
      if (manualDisconnect || !tokenGetter) return;
      if (socket.connected) return;
      console.log('[socket] app foregrounded, reconnecting…');
      try {
        await refreshToken();
      } finally {
        try {
          socket.connect();
        } catch (e) {
          console.warn('[socket] foreground reconnect failed:', e?.message ?? e);
        }
      }
    }
  });
};

socket.on("connect", () => {
  errorShown = false; // allow future errors to surface again
  console.log("Connected to server:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log('[socket] disconnected:', reason);
});

socket.on("connect_error", (err) => {
  console.log("[socket] connect_error:", err?.message ?? err);
  // Don't spam alerts for background retries — only alert on the first
  // visible failure while foregrounded.
  if (errorShown) return;
  if (AppState.currentState !== 'active') return;
  errorShown = true;
  Alert.alert("Connection Error", "Unable to connect to the server. Please check your internet connection and try again.");
});

const resolveToken = async (tokenOrGetter) => {
  if (!tokenOrGetter) return null;
  if (typeof tokenOrGetter === 'function') {
    tokenGetter = tokenOrGetter;
    hookTokenRefresh();
    hookAppState();
    return await refreshToken();
  }
  return tokenOrGetter;
};

export const initializeSocket = async (tokenOrGetter) => {
  manualDisconnect = false;
  const token = await resolveToken(tokenOrGetter);
  if (!token) {
    console.warn('[socket] initializeSocket called without a token — server will reject the connection');
  } else {
    applyToken(token);
  }
  hookAppState();
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
};

/**
 * Ensure the socket is connected, refreshing the Clerk token first.
 * Waits up to `timeoutMs` for `connect`. Rejects on timeout / auth
 * failure instead of hanging. Safe to call on every foreground/rejoin.
 */
export const ensureSocketConnected = async (tokenOrGetter, timeoutMs = 10000) => {
  manualDisconnect = false;
  if (tokenOrGetter) {
    await resolveToken(tokenOrGetter);
  } else if (tokenGetter) {
    await refreshToken();
  }
  hookAppState();
  if (socket.connected) return socket;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Socket connection timed out. Please check your connection and retry.'));
    }, timeoutMs);

    const onConnect = () => {
      cleanup();
      resolve(socket);
    };
    const onError = (err) => {
      // Auth rejections are fatal — don't wait out the timer.
      const msg = err?.message ?? '';
      if (/unauthorized|auth|token|jwt|401|forbidden/i.test(msg)) {
        cleanup();
        reject(new Error(msg || 'Not authorized. Please sign in again.'));
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
    };

    socket.once('connect', onConnect);
    socket.on('connect_error', onError);
    try {
      socket.connect();
    } catch (e) {
      cleanup();
      reject(e);
    }
  });
};

/**
 * Emit with server ack + timeout. Rejects on timeout so callers can
 * show Retry UI instead of hanging forever (the old join-room bug).
 */
export const emitWithAck = (event, payload, timeoutMs = 8000) =>
  new Promise((resolve, reject) => {
    if (!socket.connected) {
      reject(new Error('Not connected to server. Reconnecting…'));
      return;
    }
    try {
      socket.timeout(timeoutMs).emit(event, payload, (err, response) => {
        if (err) {
          reject(new Error('Server did not respond in time. Please retry.'));
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      reject(e);
    }
  });

export const disconnectSocket = (manual = true) => {
  manualDisconnect = manual;
  // Clear stale auth so a post-logout reconnect can never reuse the old
  // user's token (this was letting logged-out devices keep receiving
  // authenticated chat events / 401 loops).
  try {
    socket.auth = {};
    if (socket.io?.opts) {
      socket.io.opts.auth = {};
      if (socket.io.opts.extraHeaders?.Authorization) {
        const { Authorization, ...rest } = socket.io.opts.extraHeaders;
        socket.io.opts.extraHeaders = rest;
      }
    }
  } catch (e) {}
  if (socket.connected || socket.active) {
    socket.disconnect();
  }
};

export const isSocketConnected = () => socket.connected;

export const getSocket = () => socket;

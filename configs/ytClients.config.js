// InnerTube client configurations.
//
// Diagnosed 2026-10-11 (scripts/diag-streams.cjs, video J_d_Q3pTYcc):
//  - ANDROID_VR 1.65.10 -> LOGIN_REQUIRED ("Sign in to confirm you're not a bot")
//  - TVHTML5           -> LOGIN_REQUIRED (same bot wall)
//  - WEB 2.20260820    -> UNPLAYABLE ("Video unavailable")
//  - ANDROID 21.03.36  -> OK, but formats carry NO direct url (SABR/cipher-only)
//  - IOS 20.11.6       -> OK with direct non-ciphered URLs; probes return
//    HTTP 206 ONLY when a browser/client UA + Range header is sent
//    (bare GET -> 403). So IOS must be tried FIRST, and stream fetches
//    must always carry UA + Range.
//
// Notes:
//  - `clientNameNumber` is the numeric value sent in X-YouTube-Client-Name.
//  - The API key is a public InnerTube key; it is passed as the `key` query param.

export const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

// IOS — currently the ONLY client returning direct, playable URLs.
// Proven working: itag 139/140/251 probe HTTP 206 with UA+Range.
// Must stay first.
export const ios = {
  clientName: 'IOS',
  clientNameNumber: 5,
  android: false,
  header: {
    'User-Agent':
      'com.google.ios.youtube/20.11.6 (iPhone10,4; U; CPU iOS 16_7_7 like Mac OS X)',
    'X-YouTube-Client-Name': 5,
    'X-YouTube-Client-Version': '20.11.6',
    // Required since ~2024: without these the player endpoint returns
    // LOGIN_REQUIRED / UNPLAYABLE for all clients.
    'X-Youtube-Identity-Token': undefined, // set per-request when OAuth available
    'X-Goog-Fieldmask':
      'playerResponse.playabilityStatus,playerResponse.streamingData,playerResponse.videoDetails',
  },
  context: {
    client: {
      clientName: 'IOS',
      clientVersion: '20.11.6',
      deviceMake: 'Apple',
      deviceModel: 'iPhone10,4',
      osName: 'iPhone',
      osVersion: '16.7.7.20H330',
      hl: 'en',
      gl: 'IN',
      timeZone: 'Asia/Kolkata',
      utcOffsetMinutes: 330,
    },
  },
};

// ANDROID — fallback mobile client.
export const android = {
  clientName: 'ANDROID',
  clientNameNumber: 3,
  android: true,
  header: {
    'User-Agent':
      'com.google.android.youtube/21.03.36 (Linux; U; Android 16; en_US; SM-S908E Build/TP1A.220624.014) gzip',
    'X-YouTube-Client-Name': 3,
    'X-YouTube-Client-Version': '21.03.36',
  },
  context: {
    client: {
      clientName: 'ANDROID',
      clientVersion: '21.03.36',
      deviceMake: 'Google',
      deviceModel: 'SM-S908E',
      osName: 'Android',
      osVersion: '16',
      androidSdkVersion: 36,
      hl: 'en',
      timeZone: 'Asia/Kolkata',
      utcOffsetMinutes: 330,
    },
  },
};

// TVHTML5 — Cobalt TV client, occasionally returns playable formats.
export const tv = {
  clientName: 'TVHTML5',
  clientNameNumber: 7,
  android: false,
  header: {
    'User-Agent':
      'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/25.lts.30.1034943-gold (unlike Gecko), Unknown_TV_Unknown_0/Unknown (Unknown, Unknown)',
    'X-YouTube-Client-Name': 7,
    'X-YouTube-Client-Version': '7.20260311.12.00',
  },
  context: {
    client: {
      clientName: 'TVHTML5',
      clientVersion: '7.20260311.12.00',
      hl: 'en',
      timeZone: 'Asia/Kolkata',
      utcOffsetMinutes: 330,
    },
  },
};

// WEB — last resort. Often returns signatureCipher (unplayable without a JS
// runtime), but kept so a validated direct URL can still be picked up.
export const web = {
  clientName: 'WEB',
  clientNameNumber: 1,
  android: false,
  header: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'X-YouTube-Client-Name': 1,
    'X-YouTube-Client-Version': '2.20260820.08.00',
  },
  context: {
    client: {
      clientName: 'WEB',
      clientVersion: '2.20260820.08.00',
      hl: 'en',
      timeZone: 'Asia/Kolkata',
      utcOffsetMinutes: 330,
    },
  },
};

// Ordered list of clients to try. First playable result wins.
// NOTE: android_vr was removed — it returns LOGIN_REQUIRED on every video
// and merely referencing it here crashed the module (ReferenceError).
export const CLIENTS = [ios, android, tv, web];

/**
 * Build the HTTP headers required for an InnerTube request.
 * @param {object} client - One of the client configs above.
 * @param {string} videoId - The video id (used for the Referer).
 * @param {string} [visitorData] - Visitor id, sent as X-Goog-Visitor-Id.
 * @param {string} [oauthToken] - Google OAuth access token (when the user is
 *   signed in). Attached as `Authorization: Bearer` — this is what lifts the
 *   "Sign in to confirm you're not a bot" wall.
 */
export const getClientHeaders = (
  client,
  videoId,
  visitorData,
  oauthToken
) => {
  const headers = {
    'Content-Type': 'application/json',
    'accept-language': 'en-US,en',
    Origin: 'https://www.youtube.com',
    Referer: `https://www.youtube.com/watch?v=${videoId}`,
    ...client.header,
  };

  if (visitorData) {
    headers['X-Goog-Visitor-Id'] = visitorData;
  }

  if (oauthToken) {
    headers.Authorization = `Bearer ${oauthToken}`;
  }

  // axios sends `undefined` values as literal strings on some platforms —
  // strip them so we never send "X-Youtube-Identity-Token: undefined".
  for (const key of Object.keys(headers)) {
    if (headers[key] === undefined) delete headers[key];
  }

  return headers;
};

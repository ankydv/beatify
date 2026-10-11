import axios from 'axios';

const SEARCH_URL = 'https://lrclib.net/api/search';
const GET_URL = 'https://lrclib.net/api/get';

// lrclib requires an identifying User-Agent. Browsers send one automatically,
// axios in React Native / Expo does not — without this the API rejects the app
// while the same URL works when pasted in a browser.
const USER_AGENT = 'Beatify v2.0.1 (https://github.com/ankydv/beatify)';

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Fetches lyrics for a song using the lrclib.net API.
 * Filters and prioritizes lyrics based on the proportion of English words within the duration range.
 * @param {string} artist_name - The name of the artist.
 * @param {string} track_name - The name of the track.
 * @param {number} duration - The duration of the track in seconds.
 * @param {string} [album_name] - Optional album name (improves /api/get match).
 * @returns {Promise<Object|null>} - Best-matched lyrics object or null.
 */
export const fetchLyrics = async (artist_name, track_name, duration, album_name) => {
  const artist = clean(artist_name);
  const track = clean(track_name);

  if (!artist && !track) {
    console.warn('[lyrics] missing artist and track name');
    return null;
  }

  const headers = { 'User-Agent': USER_AGENT };
  const timeout = 10000;

  try {
    console.log('[lyrics] fetch:', artist, '-', track, `(${duration}s)`);

    // 1) Primary: /api/search with track_name (+ artist_name)
    let items = [];
    try {
      const res = await axios.get(SEARCH_URL, {
        params: { artist_name: artist || undefined, track_name: track },
        headers,
        timeout,
      });
      if (Array.isArray(res.data)) items = res.data;
    } catch (err) {
      logLyricsError('search', err);
      // fall through to q-fallback instead of throwing immediately
    }

    // 2) Fallback: fuzzy `q` search (handles "Official Video", channel-name artists, etc.)
    if (items.length === 0 && (artist || track)) {
      try {
        const res = await axios.get(SEARCH_URL, {
          params: { q: `${track} ${artist}`.trim() },
          headers,
          timeout,
        });
        if (Array.isArray(res.data)) items = res.data;
      } catch (err) {
        logLyricsError('search?q', err);
      }
    }

    // 3) Fallback: exact /api/get signature match (needs album + duration)
    if (items.length === 0 && track && artist && duration > 0) {
      try {
        const res = await axios.get(GET_URL, {
          params: {
            track_name: track,
            artist_name: artist,
            album_name: clean(album_name) || undefined,
            duration: Math.round(Number(duration)),
          },
          headers,
          timeout,
        });
        if (res.data && (res.data.syncedLyrics || res.data.plainLyrics)) {
          return res.data;
        }
      } catch (err) {
        // /api/get returns 404 when nothing matches — that just means "no lyrics".
        if (err?.response?.status !== 404) logLyricsError('get', err);
      }
    }

    if (!items || items.length === 0) return null;

    // Duration may be 0/unknown (caller bug) — only apply the window when valid.
    const dur = Number(duration);
    const hasDuration = Number.isFinite(dur) && dur > 0;
    const TOLERANCE = 10;

    const candidates = items
      .filter(
        (lyricsObj) =>
          (lyricsObj.syncedLyrics || lyricsObj.plainLyrics) &&
          (!hasDuration || Math.abs(Number(lyricsObj.duration) - dur) <= TOLERANCE)
      )
      .map((lyricsObj) => {
        const text = lyricsObj.syncedLyrics || lyricsObj.plainLyrics || '';
        const totalWords = text.split(/\s+/).filter(Boolean).length || 1;
        const englishWords = text.match(/\b[a-zA-Z]+\b/g)?.length || 0;
        const englishRatio = englishWords / totalWords;
        const hasSynced = !!lyricsObj.syncedLyrics;
        return { ...lyricsObj, englishRatio, hasSynced };
      });

    // Prefer entries that actually have synced lyrics, then highest English ratio.
    candidates.sort(
      (a, b) => Number(b.hasSynced) - Number(a.hasSynced) || b.englishRatio - a.englishRatio
    );

    return candidates.length > 0 ? candidates[0] : null;
  } catch (error) {
    logLyricsError('fetchLyrics', error);
    throw error;
  }
};

const logLyricsError = (tag, error) => {
  console.error(`[lyrics] ${tag} failed:`, {
    message: error?.message,
    status: error?.response?.status,
    data: error?.response?.data,
  });
};

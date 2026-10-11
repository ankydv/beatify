import axios from 'axios';
import qs from 'qs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedMetadata, cacheMetadata } from '@/services/cache.service';
import {
  CLIENTS,
  INNERTUBE_API_KEY,
  getClientHeaders,
} from '@/configs/ytClients.config';
import {
  selectStreamFormat,
  selectStreamFormats,
  decodeStreamUrl,
  getStreamHeaders,
  getStreamExpirySeconds,
  logPlayableUrl,
} from '@/utils/metadata.utils';
import getVisitorData from '@/services/visitorData.service';

const baseUrl = 'https://www.youtube.com/youtubei/v1';

const baseParams = {
  contentCheckOk: true,
  racyCheckOk: true,
};

const playbackContext = {
  contentPlaybackContext: {
    html5Preference: 'HTML5_PREF_WANTS',
  },
};

/**
 * Ensure we have a visitor id, fetching a fresh one if it is missing.
 * A valid visitor id significantly reduces the chance of being flagged/blocked.
 */
const ensureVisitorData = async () => {
  try {
    const stored = await AsyncStorage.getItem('visitorData');
    if (stored) return stored;
  } catch (error) {
    console.warn('Failed to read visitorData from storage:', error);
  }

  try {
    return await getVisitorData();
  } catch (error) {
    console.warn('Failed to fetch visitorData:', error);
    return null;
  }
};

/**
 * Validate that a stream URL is actually downloadable (not 403/410).
 * Uses a tiny ranged GET with the same client UA + Range headers the real
 * player sends. A bare `axios.get(url)` — or a mismatched UA — 403s even on
 * good URLs, which is why a URL that "looks fine" can fail validation.
 * Returns the HTTP status so callers can distinguish expired (403) from
 * network errors.
 */
export const validateStreamUrl = async (url, videoId) => {
  if (!url) return false;

  // Reject already-expired URLs without a network round-trip.
  const expiresAt = getStreamExpirySeconds(url);
  if (expiresAt && expiresAt * 1000 < Date.now() + 60 * 1000) {
    console.warn(
      `[metadata] validate: URL expired at ${new Date(expiresAt * 1000).toISOString()}`
    );
    return false;
  }

  try {
    const response = await axios.get(url, {
      headers: { ...getStreamHeaders(videoId), Range: 'bytes=0-1' },
      timeout: 8000,
      validateStatus: () => true,
    });
    // 200 (full) or 206 (partial content) both mean the URL streams.
    const ok = response.status === 200 || response.status === 206;
    if (!ok) {
      console.warn(
        `[metadata] validate: HTTP ${response.status} for itag URL (ctype=${response.headers?.['content-type']}) — likely IP/UA mismatch or bot-wall`
      );
    }
    return ok;
  } catch (error) {
    console.warn('[metadata] validate: network error', error?.message || error);
    return false;
  }
};

/**
 * Perform a single player request for a given client.
 * When the user is signed in with YouTube (Google OAuth), the access token
 * is attached as `Authorization: Bearer <token>` — that is what lifts the
 * "Sign in to confirm you're not a bot" wall for ANDROID/TV/WEB clients.
 */
const callPlayerClient = async (client, videoId, visitorData, oauthToken) => {
  const endpoint = `${baseUrl}/player`;
  const query = {
    key: INNERTUBE_API_KEY,
    videoId,
    ...baseParams,
  };

  // Clone the context so we never mutate the shared client config.
  const context = {
    ...client.context,
    client: { ...client.context.client },
  };
  if (visitorData) {
    context.client.visitorData = visitorData;
  }

  const data = { context, playbackContext };
  const headers = getClientHeaders(client, videoId, visitorData, oauthToken);

  const response = await axios({
    url: `${endpoint}?${qs.stringify(query)}`,
    method: 'POST',
    headers,
    data,
  });

  return response.data;
};

/**
 * Fetch player metadata for a video, trying several InnerTube clients until a
 * playable, non-flagged stream URL is found.
 * @param {string} videoId
 * @returns {Promise<object>} The InnerTube player response.
 */
const player = async (videoId) => {
  // 1) Serve from cache when the cached stream URL is still valid.
  const cachedMetadata = await getCachedMetadata(videoId);
  if (cachedMetadata) {
    const rawCached =
      cachedMetadata._playableFormat || selectStreamFormat(cachedMetadata);
    const cachedFormat = rawCached
      ? { ...rawCached, url: decodeStreamUrl(rawCached.url) }
      : null;
    if (cachedFormat && (await validateStreamUrl(cachedFormat.url, videoId))) {
      console.log('returning cached metadata');
      const cachedDetails = {
        itag: cachedFormat.itag,
        url: cachedFormat.url,
        mimeType: cachedFormat.mimeType,
        expiresAtSeconds: getStreamExpirySeconds(cachedFormat.url),
        headers: getStreamHeaders(videoId),
      };
      // Copy-paste friendly log so the URL can be tested in a browser/curl.
      logPlayableUrl(cachedDetails, videoId, 'metadata-cache');
      return {
        ...cachedMetadata,
        _playableFormat: cachedFormat,
        _streamHeaders: getStreamHeaders(videoId),
      };
    }
    // Cached URL expired/IP-rotated -> fall through to fresh fetch.
  }

  const visitorData = await ensureVisitorData();

  // Unauthenticated InnerTube playback. YouTube may still rate-limit
  // some clients ("Sign in to confirm you're not a bot"); visitorData
  // + client rotation is the mitigation.
  const oauthToken = null;

  let lastError = null;

  // 2) Try every client in order until one yields a playable stream.
  for (const client of CLIENTS) {
    try {
      const result = await callPlayerClient(
        client,
        videoId,
        visitorData,
        oauthToken
      );

      const status = result?.playabilityStatus?.status;
      const reason =
        result?.playabilityStatus?.reason ||
        result?.playabilityStatus?.messages?.[0] ||
        '';
      if (status !== 'OK') {
        console.warn(
          `[metadata] ${client.clientName}: status=${status} reason=${reason} (oauth=${oauthToken ? 'yes' : 'no'})`
        );
        continue;
      }
      const candidates = selectStreamFormats(result);

      if (candidates.length === 0) {
        console.warn(
          `[metadata] ${client.clientName}: no playable format (status=${status})`
        );
        continue;
      }

      // Validate candidates best-first: within a client, a lower quality format
      // (e.g. muxed itag 18) may still be playable when the best one 403s.
      let playableFormat = null;
      for (const candidate of candidates) {
        if (await validateStreamUrl(candidate.url, videoId)) {
          playableFormat = candidate;
          break;
        }
      }

      if (!playableFormat) {
        console.warn(
          `[metadata] ${client.clientName}: all stream URLs rejected by YouTube (oauth=${oauthToken ? 'yes' : 'no'} — emulator IP 10.0.2.2/IPv6 may differ from player's egress IP; sign in with YouTube to lift bot-wall)`
        );
        continue;
      }

      // Remember the validated format (decoded, directly downloadable URL)
      // so callers reuse the exact same URL + headers.
      result._playableFormat = playableFormat;
      result._streamHeaders = getStreamHeaders(videoId);

      // Log the playable URL so it can be copy-pasted into a browser/curl
      // for testing. googlevideo URLs are IP-bound + expiring — test on the
      // same device/IP before the printed expiry time.
      logPlayableUrl(
        {
          itag: playableFormat.itag,
          url: playableFormat.url,
          mimeType: playableFormat.mimeType,
          expiresAtSeconds: getStreamExpirySeconds(playableFormat.url),
          headers: result._streamHeaders,
        },
        videoId,
        `metadata-${client.clientName}`
      );

      await cacheMetadata(result);
      return result;
      
    } catch (error) {
      lastError = error;
      console.warn(
        `[metadata] ${client.clientName} request failed:`,
        error?.message || error
      );
    }
  }

  throw new Error(
    `Unable to load playable metadata for ${videoId}` +
      (lastError ? ` (last error: ${lastError.message})` : '')
  );
};

export default player;

// src/utils/Metadata.js

// Preferred audio-only itags, in order of quality (opus/aac).
export const AUDIO_ITAGS = [251, 141, 140, 171, 250, 139, 249];
// Progressive (muxed) fallback itags. itag 18 (360p mp4) is served by the
// android_vr client even when PO tokens are required for other formats.
export const PROGRESSIVE_ITAGS = [18, 22, 59];

// User-Agent that googlevideo accepts for direct stream fetches.
// CRITICAL: this must match the InnerTube client that produced the URL.
// We fetch with IOS (com.google.ios.youtube), so streams must be fetched
// with the same UA — a Chrome UA on an IOS-issued URL returns 403.
// Proven by live probe: same URL -> 403 bare, 206 with matching UA+Range.
export const STREAM_USER_AGENT =
  'com.google.ios.youtube/20.11.6 (iPhone10,4; U; CPU iOS 16_7_7 like Mac OS X)';

/**
 * Headers googlevideo expects on stream / download requests.
 * Without the matching client UA + Range the edge returns 403, which is why
 * a URL that looks fine in JSON "doesn't work" when fetched bare or with a
 * mismatched User-Agent.
 */
export const getStreamHeaders = (videoId) => ({
  'User-Agent': STREAM_USER_AGENT,
  Range: 'bytes=0-',
  Accept: '*/*',
  'Accept-Encoding': 'identity',
  Referer: videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : 'https://www.youtube.com/',
});

/**
 * Decode an InnerTube cipher value (`signatureCipher` / `cipher`).
 * Format: `url=<encoded>&sp=sig&s=<cipheredSig>` (query-string encoded).
 * We URL-decode each component and rebuild a direct URL. Full `s`
 * deciphering needs YouTube's base.js; when only `s` is present we attach
 * it as the signature (works for non-protected formats, best-effort for
 * the rest) so callers still get a downloadable URL instead of nothing.
 */
export const decipherFormatUrl = (format) => {
  const cipher = format?.signatureCipher || format?.cipher;
  if (format?.url) return format.url;
  if (!cipher) return null;
  try {
    const params = new URLSearchParams(cipher);
    const base = params.get('url');
    if (!base) return null;
    const sig = params.get('sig') || params.get('s');
    const sp = params.get('sp') || 'sig';
    if (!sig) return base; // already a plain url, just encoded
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}${sp}=${sig}`;
  } catch {
    return null;
  }
};

/**
 * Normalize an InnerTube stream URL into a directly downloadable URL.
 *
 * InnerTube returns URLs with percent-encoded query values
 * (`%2C` `%2F` `%3D` ...). Passing them through another encoder (or
 * `JSON.stringify` round-trips) double-encodes them and googlevideo 403s.
 * Re-serializing via URLSearchParams decodes-then-encodes each param
 * exactly once, producing a clean, playable URL.
 *
 * @param {string} rawUrl
 * @returns {string|null} normalized playable URL, or null if unparsable
 */
export const decodeStreamUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl);
    // URLSearchParams decodes %XX on read; toString() re-encodes once.
    // Sorting is NOT applied — order is preserved.
    parsed.search = new URLSearchParams(parsed.searchParams).toString();
    return parsed.toString();
  } catch {
    // Fallback: single decode pass for non-standard URLs.
    try {
      return decodeURIComponent(rawUrl);
    } catch {
      return rawUrl;
    }
  }
};

/** Extract the `expire` unix timestamp from a stream URL, if present. */
export const getStreamExpirySeconds = (url) => {
  try {
    const expire = new URL(url).searchParams.get('expire');
    const seconds = Number(expire);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch {
    return null;
  }
};

/**
 * Log a playable stream URL in a copy-paste friendly shape so it can be
 * tested in a browser / curl. googlevideo URLs are IP-bound + expiring, so
 * the log also prints expiry time, required headers, and a ready curl.
 * Safe to leave in: plain console.log, visible in Metro logcat.
 */
export const logPlayableUrl = (details, videoId, source = 'player') => {
  if (!details?.url) {
   // console.log(`[playable-url][${source}][${videoId}] NO PLAYABLE URL`);
    return;
  }
  const expiresAt = details.expiresAtSeconds
    ? new Date(details.expiresAtSeconds * 1000).toISOString()
    : 'unknown';
  // console.log(
  //   `[playable-url][${source}][${videoId}] itag=${details.itag} mime=${details.mimeType} expires=${expiresAt}\n${details.url}`
  // );
  const headers = details.headers || {};
  const headerFlags = Object.entries(headers)
    .map(([k, v]) => `-H "${k}: ${v}"`)
    .join(' ');
  // console.log(
  //   `[playable-curl][${source}][${videoId}] curl ${headerFlags} "${details.url}" --output test-${videoId}.webm`
  // );
  // console.log(
  //   `[playable-note][${source}][${videoId}] Test in a browser via a PROXY that forwards your UA+Range headers (bare paste 403s by design), OR in-app (headers are attached automatically). Must be same IP before ${expiresAt}.`
  // );
};

const withDecodedUrl = (format) => {
  if (!format || typeof format !== 'object') return null;
  const raw = format.url || decipherFormatUrl(format);
  const url = decodeStreamUrl(raw);
  if (!url) return null;
  return { ...format, url };
};

/**
 * Build an ordered list of playable stream formats from a player response.
 * Every returned format carries a normalized, directly-downloadable `url`
 * (percent-escapes decoded exactly once, `signatureCipher` resolved).
 * Order: preferred audio-only -> any audio-only -> progressive muxed -> rest.
 * @param {object} metadata - The InnerTube player response.
 * @returns {object[]} Ordered candidate formats (best first).
 */
export const selectStreamFormats = (metadata) => {
  const streamingData = metadata?.streamingData;
  if (!streamingData) return [];

  const adaptiveFormats = streamingData.adaptiveFormats || [];
  const formats = streamingData.formats || [];
  const all = [...adaptiveFormats, ...formats]
    .map(withDecodedUrl)
    .filter(Boolean);

  // A usable format must expose a direct url after decoding.
  const usable = (format) => !!format?.url;

  const ordered = [];
  const seenItags = new Set();
  const push = (format) => {
    if (format && usable(format) && !ordered.includes(format)) {
      // de-dupe re-mapped entries by itag while preserving order
      if (format.itag != null) {
        if (seenItags.has(format.itag)) return;
        seenItags.add(format.itag);
      }
      ordered.push(format);
    }
  };

  // 1) Preferred audio-only adaptive formats.
  for (const itag of AUDIO_ITAGS) {
    push(all.find((format) => format.itag === itag));
  }

  // 2) Any audio-only adaptive format.
  for (const format of all) {
    if (format.mimeType?.startsWith('audio/')) push(format);
  }

  // 3) Progressive (muxed) fallback formats.
  for (const itag of PROGRESSIVE_ITAGS) {
    push(all.find((format) => format.itag === itag));
  }

  // 4) Any other format that exposes a direct url.
  for (const format of all) push(format);

  return ordered;
};

/**
 * Pick the best playable stream format from a player response.
 * @param {object} metadata - The InnerTube player response.
 * @returns {object|null} The selected format object, or null if none.
 */
export const selectStreamFormat = (metadata) => {
  return selectStreamFormats(metadata)[0] || null;
};

const toDurationSeconds = (format, metadata) => {
  if (format?.approxDurationMs) {
    const seconds = Number(format.approxDurationMs) / 1000;
    if (!Number.isNaN(seconds) && seconds > 0) return seconds;
  }
  if (metadata?.videoDetails?.lengthSeconds) {
    const seconds = Number(metadata.videoDetails.lengthSeconds);
    if (!Number.isNaN(seconds) && seconds > 0) return seconds;
  }
  return 0;
};

class Metadata {
  constructor(metadata) {
    this.metadata = metadata;
    this.duration = 0;
  }

  // Get the title of the track
  getTitle() {
    return this.metadata?.videoDetails?.title || 'Unknown Title';
  }

  // Get the artist as a formatted string
  getArtists() {
    let artist = this.metadata?.videoDetails?.author || 'Unknown Artist';
    return artist;
  }

  // Get the album name
  getAlbum() {
    return this.metadata?.album || 'Unknown Album';
  }

  // Get the duration in minutes and seconds
  getDuration() {
    const duration =
      this.duration || Number(this.metadata?.videoDetails?.lengthSeconds) || 0;
    if (!duration) return '00:00';

    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  // Get the best playable streaming URL (decoded, directly downloadable).
  // Prefers the exact format validated by the metadata service, if present.
  getStreamingUrl() {
    const format = this.getStreamFormat();
    if (!format) return null;

    this.duration = toDurationSeconds(format, this.metadata);
    return decodeStreamUrl(format.url);
  }

  // Get the validated playable format object (decoded URL included).
  getStreamFormat() {
    const format =
      this.metadata?._playableFormat || selectStreamFormat(this.metadata);
    if (!format) return null;
    const url = decodeStreamUrl(format.url || decipherFormatUrl(format));
    if (!url) return null;
    return { ...format, url };
  }

  // Full details a player/downloader needs: decoded url + headers + mime.
  // This is the "format API" shape — hand `url` + `headers` to any
  // downloader (fetch / FileSystem / ExoPlayer) and it plays.
  getPlayableFormatDetails() {
    const format = this.getStreamFormat();
    if (!format) return null;
    const videoId = this.metadata?.videoDetails?.videoId;
    return {
      itag: format.itag,
      url: format.url, // decoded, directly downloadable
      mimeType: format.mimeType,
      bitrate: format.bitrate,
      audioQuality: format.audioQuality,
      approxDurationMs: format.approxDurationMs,
      contentLength: format.contentLength,
      expiresAtSeconds: getStreamExpirySeconds(format.url),
      headers: getStreamHeaders(videoId),
    };
  }

  // Convenience for download buttons: { url, filename, headers, mimeType }.
  getDownloadInfo() {
    const details = this.getPlayableFormatDetails();
    if (!details) return null;
    const ext = details.mimeType?.includes('webm')
      ? 'webm'
      : details.mimeType?.includes('mp4')
        ? 'm4a'
        : 'audio';
    const safeTitle = (this.getTitle() || 'track')
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .slice(0, 60);
    return { ...details, filename: `${safeTitle}.${ext}` };
  }

  getThumb(size) {
    const thumbnails = this.metadata?.videoDetails?.thumbnail?.thumbnails;
    if (!thumbnails || thumbnails.length === 0) return null;

    // Sort ascending by width so that index maps to quality.
    const sorted = [...thumbnails].sort(
      (a, b) => (a.width || 0) - (b.width || 0)
    );
    const len = sorted.length;

    switch (size) {
      case 'mini':
        return sorted[0];
      case 'small':
        return sorted[Math.min(1, len - 1)];
      case 'medium':
        return sorted[Math.min(2, len - 1)];
      case 'large':
        return sorted[Math.min(3, len - 1)];
      default:
        return sorted[len - 1];
    }
  }
}

export default Metadata;

import getMetadata from '@/services/metadata.service';
import Metadata from '@/utils/metadata.utils';

export function toThumb(song) {
  if (song?.thumbnail?.length) return song.thumbnail[0].url;
  if (song?.thumbnails?.length) return song.thumbnails[0].url;
  if (typeof song?.thumb === 'string') return song.thumb;
  return song?.thumb || null;
}

export function toArtists(song) {
  if (typeof song?.artists === 'string') return song.artists;
  if (Array.isArray(song?.artists)) return song.artists.map((a) => a?.name || a).filter(Boolean).join(', ');
  if (typeof song?.artist === 'string') return song.artist;
  return 'Unknown Artist';
}

/**
 * Normalize anything the search API hands us (raw id, watch URL, youtu.be)
 * into a bare YouTube videoId. Throws a clear client-side error instead of
 * letting a malformed id travel to InnerTube and come back as HTTP 400.
 */
export function normalizeVideoId(input) {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  const m =
    s.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
    s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) ||
    s.match(/\/shorts\/([a-zA-Z0-9_-]{11})/) ||
    s.match(/^([a-zA-Z0-9_-]{11})$/);
  if (m) return m[1];
  return s;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Resolve a searchable song into the shareable playback bundle (DJ only). */
export async function resolveBundle(song) {
  const raw = song?.videoId;
  const videoId = normalizeVideoId(raw);
  if (!videoId) throw new Error('Song has no videoId');
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    throw new Error(`Invalid videoId "${String(raw).slice(0, 40)}" — pick the song from search again`);
  }
  let metadata = null;
  let lastError = null;
  // InnerTube 400s are often transient (bot-wall / visitor rotation) —
  // retry once before surfacing so a single flaky client doesn't kill add.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      metadata = await getMetadata(videoId);
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
      if (attempt === 0) await sleep(800);
    }
  }
  if (!metadata) {
    throw new Error(`Couldn't resolve "${song?.title || song?.name || videoId}": ${lastError?.message || 'metadata fetch failed'}`);
  }
  const md = new Metadata(metadata);
  const details = md.getPlayableFormatDetails();
  const url = details?.url || md.getStreamingUrl();
  if (!url) throw new Error(`No playable stream for "${md.getTitle()}"`);
  const headers = details?.headers || metadata?._streamHeaders || undefined;
  return {
    videoId,
    title: md.getTitle() || song.title || song.name || videoId,
    artists: md.getArtists?.() !== 'Unknown Artist' ? md.getArtists() : toArtists(song),
    thumb: md.getThumb?.('medium')?.url || toThumb(song),
    durationSec: Number(metadata?.videoDetails?.lengthSeconds) || Math.round(Number(details?.approxDurationMs) / 1000) || 0,
    url,
    headers,
    userAgent: headers?.['User-Agent'] || undefined,
    contentType: details?.mimeType ? details.mimeType.split(';')[0].trim() : 'audio/mp4',
    mimeType: details?.mimeType || undefined,
    itag: details?.itag ?? undefined,
    expiresAtSeconds: details?.expiresAtSeconds ?? undefined,
  };
}

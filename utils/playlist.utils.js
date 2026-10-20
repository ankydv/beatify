/**
 * Shared playlist helpers (kept UI-free so album + modal don't import
 * components from each other — avoids circular-import bundling issues).
 */

/**
 * Backend stores playlist.songs as Song ObjectIds — the remove endpoint
 * expects that ObjectId, NOT the YouTube videoId.
 */
export function resolvePlaylistSongId(song) {
  return song?._id || song?.songId || song?.id || null;
}

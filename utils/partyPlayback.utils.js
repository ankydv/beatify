import { Platform, ToastAndroid, Alert } from 'react-native';
import TrackPlayer, {
  State,
  Capability,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';
import store from '@/state/store';
import { socket, emitWithAck } from '@/configs/socket';
import { resolveBundle, toArtists, toThumb } from '@/utils/partyDj.utils';

let scheduledTimer = null;
let playerReadyPromise = null;

/**
 * Pending seamless-jam seed.
 * Set JUST BEFORE navigating into a newly-created room while personal audio
 * is playing. Consumed once by usePartyPlayback's hello handler so the host's
 * existing queue becomes the room queue WITHOUT stopping local playback.
 */
let pendingJamSeed = null;

export function prepareJamSeed() {
  try {
    const a = store.getState()?.audio;
    const track = a?.currentTrack;
    if (!track || track?.isPartyTrack || !track?.videoId) {
      pendingJamSeed = null;
      return null;
    }
    pendingJamSeed = { videoId: track.videoId, createdAt: Date.now() };
    return pendingJamSeed;
  } catch (e) {
    pendingJamSeed = null;
    return null;
  }
}

export function peekJamSeed() {
  return pendingJamSeed;
}

export function consumeJamSeed() {
  const s = pendingJamSeed;
  pendingJamSeed = null;
  return s;
}

/** True when a party bundle is the same song already playing locally. */
function isSameVideoAsLocal(bundle) {
  try {
    const videoId = bundle?.videoId;
    if (!videoId) return false;
    const cur = store.getState()?.audio?.currentTrack;
    return !!(cur?.videoId && String(cur.videoId) === String(videoId));
  } catch (e) {
    return false;
  }
}

/**
 * Seamless host handoff: push the currently-playing personal track (+ the next
 * few personal-queue tracks) into a fresh empty room and start room playback
 * from the CURRENT local position — so the music never stops.
 * Returns true when the room was seeded.
 */
export async function seedRoomFromPersonal(roomId) {
  if (!roomId) return false;
  let track = null;
  let queueTracks = [];
  try {
    const a = store.getState()?.audio;
    track = a?.currentTrack;
    queueTracks = Array.isArray(a?.queue?.tracks) ? a.queue.tracks : [];
  } catch (e) {}
  if (!track || track?.isPartyTrack || !track?.videoId) return false;

  let positionMs = 0;
  try {
    positionMs = Math.round((await TrackPlayer.getPosition()) * 1000) || 0;
  } catch (e) {}
  if (!Number.isFinite(positionMs) || positionMs < 0) positionMs = 0;

  let bundle = null;
  try {
    bundle = await resolveBundle({
      videoId: track.videoId,
      title: track.title || track.name,
      artists: track.artists,
      artist: track.artist,
      thumbnail: track.thumbnail,
      thumbnails: track.thumbnails,
      thumb: track.thumb,
    });
  } catch (e) {
    return false;
  }
  if (!bundle?.url) return false;

  let queueId = null;
  try {
    const res = await emitWithAck('dj:queue-add', { roomId, bundle });
    if (!res?.success) return false;
    queueId = res?.queueId || res?.item?.queueId || res?.track?.queueId || null;
  } catch (e) {
    return false;
  }

  // Best-effort: carry the next few personal-queue tracks into the room so the
  // DJ's existing queue continues inside the party. Never blocks the handoff.
  try {
    const idx = queueTracks.findIndex((t) => String(t?.videoId) === String(track.videoId));
    const upcoming = (idx >= 0 ? queueTracks.slice(idx + 1, idx + 6) : queueTracks.slice(0, 5)) || [];
    for (const t of upcoming) {
      if (!t?.videoId || String(t.videoId) === String(track.videoId)) continue;
      try {
        const b = await resolveBundle(t);
        if (b?.url) await emitWithAck('dj:queue-add', { roomId, bundle: b });
      } catch (e) {}
    }
  } catch (e) {}

  if (queueId) {
    try {
      await emitWithAck('dj:load', {
        roomId,
        queueId,
        positionMs,
        playAtServerMs: Date.now() + 1500,
      });
    } catch (e) {}
  }
  return true;
}

/**
 * Idle-room takeover: joining a room with NO bundle (idle / empty queue) must
 * still take over the shared TrackPlayer — otherwise the user's personal song
 * keeps playing over the room. Pause local audio; the snapshot taken on join
 * restores it on leave via teardownPartyPlayer().
 */
export async function pausePersonalForIdleRoom() {
  try {
    const s = store.getState();
    if (!s?.party?.roomId) return false;
    const cur = s?.audio?.currentTrack;
    if (cur?.isPartyTrack) return false;
    if (!cur) return false;
    await ensurePlayerReady();
    try {
      await TrackPlayer.pause();
    } catch (e) {}
    return true;
  } catch (e) {
    return false;
  }
}

export function clearScheduled() {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }
}

export function scheduleAt(delayMs, fn) {
  clearScheduled();
  scheduledTimer = setTimeout(fn, Math.max(0, delayMs));
}

/**
 * Ensure the native TrackPlayer is set up before any party load.
 * Bug-2 root: joining a room with no personal playback ever run means
 * `audio.isInitialized` is false and setupPlayer() never ran — every
 * loadPartyBundle() silently threw and no track played. This lazily
 * initialises once and is safe to call from every party entry point.
 */
export async function ensurePlayerReady() {
  try {
    const st = store.getState();
    if (st?.audio?.isInitialized) return true;
  } catch (e) {}

  // Check if native player is already alive (e.g. from background or earlier setup)
  try {
    const nativeState = await TrackPlayer.getState();
    if (nativeState != null) {
      try {
        const { setIsInitialized } = await import('@/state/slices/audio.slice');
        store.dispatch(setIsInitialized(true));
      } catch (e) {}
      return true;
    }
  } catch (e) {}

  if (!playerReadyPromise) {
    playerReadyPromise = (async () => {
      let attempts = 0;
      let lastErr = null;
      while (attempts < 2) {
        attempts++;
        try {
          const { initializePlayer, setIsInitialized } = await import(
            '@/state/slices/audio.slice'
          );
          await store.dispatch(initializePlayer()).unwrap();
          try {
            store.dispatch(setIsInitialized(true));
          } catch (e) {}
          // Re-apply room control lock after initialization
          await applyRoomControlLock();
          return true;
        } catch (e) {
          lastErr = e;
          if (attempts < 2) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      }
      playerReadyPromise = null;
      throw lastErr;
    })();
  }
  return playerReadyPromise;
}

/**
 * Fetch latest room state from server and apply it.
 * Used when recovering from player initialization delay, seek errors, or desync.
 */
export async function fetchLatestPartyState(roomId, dispatch) {
  if (!roomId) return null;
  try {
    const { emitWithAck } = await import('@/configs/socket');
    const { applyState } = await import('@/state/slices/party.slice');
    const res = await emitWithAck('dj:state-request', { roomId });
    const st = res?.state || res;
    if (st && st.roomId) {
      if (dispatch) dispatch(applyState(st));
      return st;
    }
  } catch (e) {}
  return null;
}

/**
 * Leave-room teardown: stop room audio and hand the queue back to personal.
 * Bug-2 root (part 2): leaving kept the RNTP queue loaded with the room
 * track so it kept playing. Also snapshots nothing — personal queue was
 * never touched (only currentTrack/metadata were mirrored), so restoring
 * = reset player + re-add the personal queue head WITHOUT autoplay.
 * Returns true when a personal track was restored (caller may auto-play
 * or leave paused — we leave paused to avoid surprise audio).
 */
export async function teardownPartyPlayer(dispatch) {
  clearScheduled();
  // pause() BEFORE reset(): reset() alone does not reliably stop audio that
  // already started — this is the "song keeps playing after disconnect" bug.
  try {
    await TrackPlayer.pause();
  } catch (e) {}
  try {
    await TrackPlayer.reset();
  } catch (e) {}
  try {
    if (dispatch) {
      const { restorePersonalTrack } = await import('@/services/party.service');
      restorePersonalTrack(dispatch);
      // Re-seed the RNTP queue with the personal track so Play resumes it.
      // Personal snapshot holds { currentTrack, metadata }; reload its stream
      // URL the same way loadAndPlayTrack does but stop before play().
      const a = store.getState()?.audio;
      const track = a?.currentTrack;
      if (track && !track.isPartyTrack && track.videoId) {
        try {
          await ensurePlayerReady();
          const getMetadata = (await import('@/services/metadata.service')).default;
          const Metadata = (await import('@/utils/metadata.utils')).default;
          const metadata = await getMetadata(track.videoId);
          const md = new Metadata(metadata);
          const details = md.getPlayableFormatDetails();
          const url = details?.url || md.getStreamingUrl();
          if (url) {
            const headers = details?.headers || metadata?._streamHeaders || undefined;
            await TrackPlayer.add([{
              id: track.videoId,
              url,
              title: track.title || md.getTitle(),
              artist:
                typeof track.artists === 'string'
                  ? track.artists
                  : md.getArtists?.() || '',
              artwork: track.thumbnail?.[0]?.url || undefined,
              headers,
              contentType: details?.mimeType
                ? details.mimeType.split(';')[0].trim()
                : 'audio/mp4',
              userAgent: headers?.['User-Agent'] || undefined,
            }]);
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}

export function isPartyActive() {
  try {
    const s = store.getState()?.party;
    return !!(s?.roomId && s?.queue?.length && s?.currentIndex >= 0 && (s?.status === 'playing' || s?.status === 'loading'));
  } catch (e) {
    return false;
  }
}

export function isPartyDj() {
  try {
    return store.getState()?.party?.role === 'dj';
  } catch (e) {
    return false;
  }
}

/**
 * AUTHORITATIVE ownership test for the shared TrackPlayer instance.
 *
 * While a voice room is active the room's now-playing bundle is mirrored into
 * `audio.currentTrack` with `isPartyTrack: true` (see mirrorPartyTrack). From
 * that moment the room — not the local device — owns the player, for EVERY
 * status (idle/loading/playing/paused), until leave-room restores the personal
 * snapshot and resets the party slice.
 *
 * Why not `isPartyActive()`: that only returns true for `playing|loading`, so
 * the instant the DJ paused, every local control surface (Android notification,
 * lock screen, quick-settings media tile, mini-player, player screen) stopped
 * being gated and a listener could resume/pause the room track locally.
 */
export function roomOwnsAudio() {
  try {
    const s = store.getState();
    // Any room membership takes over the shared player — even an idle room
    // with no bundle yet. This is the reported bug: joining an empty room
    // left personal audio playing because ownership required a mirrored
    // party track that only exists once the room has songs.
    // Seamless-DJ exception: while WE are seeding a fresh room from our own
    // personal playback (seed in-flight for our own video), ownership stays
    // false so the room hello path skips the reset() + reload — the music
    // keeps playing uninterrupted and just becomes the room's queue.
    if (!s?.party?.roomId) return false;
    if (pendingJamSeed && isSameVideoAsLocal({ videoId: pendingJamSeed.videoId })) return false;
    return true;
  } catch (e) {
    return false;
  }
}

/** Pure selector form (usable with `useSelector`). */
export function selectIsListenerLocked(s) {
  return !!(s?.party?.roomId && s?.party?.role !== 'dj');
}

/** True when the local device is a LISTENER whose player is owned by a room. */
export function isListenerLocked() {
  try {
    return selectIsListenerLocked(store.getState());
  } catch (e) {
    return false;
  }
}

const FULL_CAPABILITIES = [
  Capability.Play,
  Capability.Pause,
  Capability.SkipToNext,
  Capability.SkipToPrevious,
  Capability.SeekTo,
];

let appliedControlMode = null; // 'full' | 'locked' | null

function buildPlayerOptions(capabilities, compactCapabilities) {
  // NOTE: progressUpdateEventInterval MUST be re-sent on every updateOptions —
  // RNTP drops the progress job when it is absent, which would freeze the
  // player screen slider and the party drift corrector.
  return {
    capabilities,
    compactCapabilities,
    android: {
      alwaysPauseOnInterruption: true,
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
    },
    progressUpdateEventInterval: 0.2,
    forwardJumpInterval: 5,
  };
}

/**
 * Native-level lock (defence in depth on top of the JS gates).
 *
 * While a LISTENER's device is playing room audio, strip every capability from
 * RNTP so the Android media session / persistent notification / lock screen /
 * quick-settings tile / Bluetooth AVRCP / Android Auto expose NO play, pause,
 * skip or seek action at all — the OS has nothing to hand to the listener.
 * The DJ keeps the full control set, and so does anyone outside a room.
 *
 * @param {boolean} opts.ensureReady  Boot the player first if needed (only safe
 *   to pass from OUTSIDE ensurePlayerReady — it would deadlock otherwise).
 * @param {boolean} opts.force        Re-apply even if the mode is unchanged.
 * @param {'full'|'locked'} opts.mode Override the derived mode (used on teardown).
 */
export async function applyRoomControlLock({ ensureReady = false, force = false, mode = null } = {}) {
  const target = mode || (isListenerLocked() ? 'locked' : 'full');
  if (!force && appliedControlMode === target) return target;
  try {
    if (target === 'locked' && ensureReady) await ensurePlayerReady();
    const st = store.getState();
    if (!st?.audio?.isInitialized) {
      // Nothing to configure yet. initializePlayer() runs `applyRoomControlLock()`
      // right after it writes the default options, so a 'full' mode is already
      // correct; a pending 'locked' will be applied by that hook.
      if (target === 'full') appliedControlMode = 'full';
      return target;
    }
    await TrackPlayer.updateOptions(
      target === 'locked'
        ? buildPlayerOptions([], [])
        : buildPlayerOptions(FULL_CAPABILITIES, [Capability.Play, Capability.Pause])
    );
    appliedControlMode = target;
  } catch (e) {
    // Never let a capability refresh break playback — the JS gates still hold.
    appliedControlMode = null;
  }
  return target;
}

/** Recompute + apply the lock from the current redux state. */
export function syncRoomControlLock(opts) {
  return applyRoomControlLock(opts);
}

function currentPartyTrack() {
  try {
    const p = store.getState()?.party;
    if (p.currentIndex < 0 || p.currentIndex >= p.queue.length) return null;
    return p.queue[p.currentIndex];
  } catch (e) {
    return null;
  }
}

/**
 * Party-aware playback toggle for notification / mini-player / player-screen
 * buttons. Returns true when party mode consumed the tap (caller must NOT
 * also drive TrackPlayer). While a room owns audio:
 *  - DJ taps route to the room (socket commands keep everyone in sync).
 *  - Listener taps are ignored (local play/pause would desync them).
 */
export async function partyTogglePlayback() {
  if (!roomOwnsAudio()) return false;
  const p = store.getState()?.party;
  const cur = currentPartyTrack();
  try {
    if (p.role !== 'dj') {
      // Idle room with no bundle: listener just pauses their lingering
      // personal audio so joining an empty room silences local playback.
      if (!cur) {
        try {
          await TrackPlayer.pause();
        } catch (e) {}
      }
      return true; // swallow: listeners can't control room audio
    }
    if (p.status === 'playing') {
      let pos = p.anchorPosMs || 0;
      try {
        pos = Math.round((await TrackPlayer.getPosition()) * 1000);
      } catch (e) {}
      socket.emit('dj:pause-at', { roomId: p.roomId, positionMs: pos });
    } else if (cur) {
      if (p.status === 'paused') {
        socket.emit('dj:play-at', {
          roomId: p.roomId,
          queueId: cur.queueId,
          positionMs: p.anchorPosMs || 0,
          playAtServerMs: Date.now() + 1500,
        });
      } else {
        socket.emit('dj:load', {
          roomId: p.roomId,
          queueId: cur.queueId,
          positionMs: 0,
          playAtServerMs: Date.now() + 2500,
        });
      }
    }
  } catch (e) {}
  return true;
}

/** Same routing for notification next/prev. Returns true when consumed. */
export async function partyStep(dir) {
  if (!roomOwnsAudio()) return false;
  try {
    const p = store.getState()?.party;
    if (p.role !== 'dj') return true; // swallow listener taps
    const cur = currentPartyTrack();
    if (!cur) {
      // Idle room with no queue: nothing to step — stay silent.
      return true;
    }
    socket.emit(dir > 0 ? 'dj:next' : 'dj:prev', { roomId: p.roomId });
  } catch (e) {}
  return true;
}

/**
 * Party-aware seek for the player-screen slider, the Android notification /
 * lock-screen scrub bar and Bluetooth/AVRCP seek. Returns true when a room owns
 * audio (caller must NOT touch TrackPlayer):
 *  - Listener: swallowed — only the DJ may move the room's playhead.
 *  - DJ: broadcast through `dj:seek-at` so every device (including this one)
 *    seeks from the same server-stamped anchor instead of desyncing.
 */
export async function partySeek(positionSec) {
  if (!roomOwnsAudio()) return false;
  try {
    const p = store.getState()?.party;
    if (p.role !== 'dj') return true; // swallow listener seeks
    const cur = currentPartyTrack();
    if (!cur) {
      // Idle room with no queue: nothing to seek — stay silent.
      return true;
    }
    socket.emit('dj:seek-at', {
      roomId: p.roomId,
      positionMs: Math.round(Math.max(0, Number(positionSec) || 0) * 1000),
    });
  } catch (e) {}
  return true;
}

export async function loadPartyBundle(bundle, positionSec = 0) {
  if (!bundle?.url) throw new Error('No stream URL for this track');
  await ensurePlayerReady();
  await TrackPlayer.reset();
  await TrackPlayer.add([{
    id: bundle.queueId || bundle.videoId,
    url: bundle.url,
    title: bundle.title || 'Party track',
    artist: bundle.artists || '',
    artwork: bundle.thumb || undefined,
    duration: bundle.durationSec || undefined,
    headers: bundle.headers || undefined,
    contentType: bundle.contentType || 'audio/mp4',
    userAgent: bundle.userAgent || undefined,
  }]);
  if (positionSec > 0.5) {
    try {
      await TrackPlayer.seekTo(positionSec);
    } catch (e) {}
  }
}

export async function ensurePlaying() {
  try {
    const st = await TrackPlayer.getState();
    if (st !== State.Playing) await TrackPlayer.play();
  } catch (e) {}
}

export async function pauseParty() {
  try {
    await TrackPlayer.pause();
  } catch (e) {}
}

/**
 * Intercepts song tap if inside an active party/voice room:
 * - If DJ: adds song to room queue (and starts playback if queue is empty/idle)
 * - If Listener: sends song request to DJ
 * Returns true if handled by voice room, false if personal playback should proceed.
 */
export async function handleVoiceRoomSongTap(song, feedback = true) {
  if (!song) return false;
  const p = store.getState()?.party;
  if (!p?.roomId) return false;

  const notify = (msg) => {
    if (Platform.OS === 'android') {
      try {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      } catch (_) {}
    } else {
      try {
        Alert.alert('Party Room', msg);
      } catch (_) {}
    }
  };

  const isDj = p.role === 'dj';
  const videoId = song.videoId || song.id;
  const normalizedSong = { ...song, videoId };

  try {
    if (isDj) {
      const bundle = await resolveBundle(normalizedSong);
      const res = await emitWithAck('dj:queue-add', { roomId: p.roomId, bundle });
      if (!res?.success) throw new Error(res?.message || 'Could not add to room queue');

      const wasEmpty = !p.queue || p.queue.length === 0 || (p.status === 'idle' && p.currentIndex === -1);
      if (wasEmpty) {
        const queueId = res?.queueId || res?.item?.queueId || res?.track?.queueId;
        if (queueId) {
          try {
            await emitWithAck('dj:load', { roomId: p.roomId, queueId, positionMs: 0, playAtServerMs: Date.now() + 2500 });
          } catch (_) {}
        }
      }
      if (feedback) notify(`Added "${bundle.title || normalizedSong.title}" to room queue 🎵`);
      return true;
    } else {
      const res = await emitWithAck('dj:request-add', {
        roomId: p.roomId,
        videoId,
        title: normalizedSong.title || normalizedSong.name || videoId,
        artists: toArtists(normalizedSong),
        thumb: toThumb(normalizedSong),
        durationSec: Number(normalizedSong.durationSec) || 0,
      });
      if (!res?.success) throw new Error(res?.message || 'Could not request song');
      if (feedback) notify(`Requested "${normalizedSong.title || normalizedSong.name || 'Song'}" to DJ 🙋`);
      return true;
    }
  } catch (err) {
    if (feedback) notify(err?.message || 'Failed to add/request song');
    return true;
  }
}


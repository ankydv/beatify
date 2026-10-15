import TrackPlayer, { State } from 'react-native-track-player';
import { useEffect } from 'react';
import { socket } from '@/configs/socket';
import { loadPartyBundle, ensurePlaying } from '@/utils/partyPlayback.utils';

// Listener fallback: if the DJ-shared URL fails on this device (rare IP/UA
// edge), resolve locally via InnerTube once instead of stalling.
export function usePartyFallback({ enabled, partyRef }) {
  useEffect(() => {
    if (!enabled) return;

    const tryLocalResolve = async ({ queueId, bundle }) => {
      try {
        const p = partyRef.current;
        if (p.role === 'dj') return;
        const cur = p.currentIndex >= 0 ? p.queue[p.currentIndex] : null;
        if (!cur || cur.queueId !== queueId) return;
        const getMetadata = (await import('@/services/metadata.service')).default;
        const Metadata = (await import('@/utils/metadata.utils')).default;
        const metadata = await getMetadata(bundle.videoId || cur.videoId);
        const md = new Metadata(metadata);
        const details = md.getPlayableFormatDetails();
        const url = details?.url || md.getStreamingUrl();
        if (!url) return;
        const pos = await TrackPlayer.getPosition().catch(() => 0);
        await loadPartyBundle({
          queueId,
          title: md.getTitle(),
          artists: md.getArtists?.() || '',
          thumb: md.getThumb?.('medium')?.url || cur.thumb,
          durationSec: Number(metadata?.videoDetails?.lengthSeconds) || 0,
          url,
          headers: details?.headers,
          userAgent: details?.headers?.['User-Agent'],
          contentType: details?.mimeType ? details.mimeType.split(';')[0].trim() : 'audio/mp4',
        }, pos);
        await ensurePlaying();
      } catch (e) {}
    };

    const onLoad = async (payload) => {
      try {
        await new Promise((r) => setTimeout(r, 3000));
        const st = await TrackPlayer.getState().catch(() => null);
        if (st === State.Playing || st === State.Buffering) return;
        await tryLocalResolve(payload);
      } catch (e) {}
    };

    socket.on('dj:load', onLoad);
    return () => {
      socket.off('dj:load', onLoad);
    };
  }, [enabled, partyRef]);
}

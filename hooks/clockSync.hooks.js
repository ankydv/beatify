import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '@/configs/socket';

const PING_SAMPLES = 8;
const RE_SYNC_MS = 30000;

/**
 * NTP-style offset estimation against the party server.
 * offsetMs = serverNow - localNow. serverNow() = Date.now() + offsetMs.
 */
export default function useClockSync({ enabled = true, roomId } = {}) {
  const [offsetMs, setOffsetMs] = useState(0);
  const [rttMs, setRttMs] = useState(null);
  const [synced, setSynced] = useState(false);
  const samplesRef = useRef([]);
  const timerRef = useRef(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const serverNow = useCallback(() => Date.now() + offsetMs, [offsetMs]);

  const delayUntil = useCallback(
    (serverTs) => {
      if (!serverTs) return 0;
      return Math.max(0, serverTs - serverNow());
    },
    [serverNow]
  );

  const ping = useCallback(() => {
    if (!enabledRef.current || !socket.connected) return;
    const t0 = Date.now();
    try {
      socket.emit('clock:ping', { t0 });
    } catch (e) {}
  }, []);

  const syncBurst = useCallback(() => {
    samplesRef.current = [];
    let i = 0;
    const id = setInterval(() => {
      ping();
      i += 1;
      if (i >= PING_SAMPLES) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [ping]);

  useEffect(() => {
    if (!enabled) return;
    const onPong = ({ t0, t1 }) => {
      if (t0 == null || t1 == null) return;
      const t3 = Date.now();
      const rtt = t3 - t0;
      if (rtt < 0 || rtt > 5000) return;
      const sample = t1 - (t0 + rtt / 2);
      samplesRef.current.push({ offset: sample, rtt });
      if (samplesRef.current.length > PING_SAMPLES) samplesRef.current.shift();
      if (samplesRef.current.length >= 3) {
        const sorted = [...samplesRef.current].sort((a, b) => a.rtt - b.rtt);
        const best = sorted.slice(0, Math.max(3, Math.floor(sorted.length / 2)));
        const med = [...best.map((s) => s.offset)].sort((a, b) => a - b)[Math.floor(best.length / 2)];
        setOffsetMs(Math.round(med));
        setRttMs(Math.round(best.reduce((a, s) => a + s.rtt, 0) / best.length));
        setSynced(true);
      }
    };
    socket.on('clock:pong', onPong);
    const cancel = syncBurst();
    timerRef.current = setInterval(syncBurst, RE_SYNC_MS);
    const onConnect = () => syncBurst();
    socket.on('connect', onConnect);
    return () => {
      socket.off('clock:pong', onPong);
      socket.off('connect', onConnect);
      if (typeof cancel === 'function') cancel();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, roomId, ping, syncBurst]);

  return { offsetMs, rttMs, synced, serverNow, delayUntil, resync: syncBurst };
}

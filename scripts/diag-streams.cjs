// Diagnostic: hit InnerTube player for each configured client, then probe
// the returned stream URLs the same way a browser/player would.
// Run: node scripts/diag-streams.cjs [videoId]
const axios = require('axios');
const qs = require('qs');

const videoId = process.argv[2] || 'J_d_Q3pTYcc';
const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

const CLIENTS = [
  {
    clientName: 'ANDROID_VR',
    version: '1.65.10',
    ua: 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
    context: { clientName: 'ANDROID_VR', clientVersion: '1.65.10', deviceMake: 'Oculus', deviceModel: 'Quest 3', osName: 'Android', osVersion: '12L', androidSdkVersion: 32, hl: 'en', gl: 'IN' },
  },
  {
    clientName: 'IOS',
    version: '20.11.6',
    ua: 'com.google.ios.youtube/20.11.6 (iPhone10,4; U; CPU iOS 16_7_7 like Mac OS X)',
    context: { clientName: 'IOS', clientVersion: '20.11.6', deviceMake: 'Apple', deviceModel: 'iPhone10,4', osName: 'iPhone', osVersion: '16.7.7.20H330', hl: 'en', gl: 'IN' },
  },
  {
    clientName: 'ANDROID',
    version: '21.03.36',
    ua: 'com.google.android.youtube/21.03.36 (Linux; U; Android 16; en_US; SM-S908E Build/TP1A.220624.014) gzip',
    context: { clientName: 'ANDROID', clientVersion: '21.03.36', deviceMake: 'Google', deviceModel: 'SM-S908E', osName: 'Android', osVersion: '16', androidSdkVersion: 36, hl: 'en', gl: 'IN' },
  },
  {
    clientName: 'TVHTML5',
    version: '7.20260311.12.00',
    ua: 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/25.lts.30.1034943-gold (unlike Gecko), Unknown_TV_Unknown_0/Unknown (Unknown, Unknown)',
    context: { clientName: 'TVHTML5', clientVersion: '7.20260311.12.00', hl: 'en', gl: 'IN' },
  },
  {
    clientName: 'WEB',
    version: '2.20260820.08.00',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    context: { clientName: 'WEB', clientVersion: '2.20260820.08.00', hl: 'en', gl: 'IN' },
  },
];

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

async function probeUrl(label, url, headers) {
  try {
    const res = await axios.get(url, { headers, timeout: 10000, validateStatus: () => true, maxRedirects: 3 });
    const body = typeof res.data === 'string' ? res.data.slice(0, 120) : JSON.stringify(res.data).slice(0, 120);
    console.log(`    [probe:${label}] HTTP ${res.status} ctype=${res.headers['content-type']} len=${res.headers['content-length']} body=${body}`);
    return res.status;
  } catch (e) {
    console.log(`    [probe:${label}] ERROR ${e.message}`);
    return -1;
  }
}

(async () => {
  console.log(`video=${videoId}`);
  try {
    const ip = (await axios.get('https://api.ipify.org', { timeout: 8000 })).data;
    console.log(`egress-ip(node)=${ip}`);
  } catch (e) { console.log(`egress-ip lookup failed: ${e.message}`); }

  for (const c of CLIENTS) {
    console.log(`\n=== ${c.clientName} ${c.version} ===`);
    try {
      const res = await axios({
        url: `https://www.youtube.com/youtubei/v1/player?${qs.stringify({ key: INNERTUBE_API_KEY, videoId, contentCheckOk: true, racyCheckOk: true })}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://www.youtube.com',
          Referer: `https://www.youtube.com/watch?v=${videoId}`,
          'User-Agent': c.ua,
          'X-YouTube-Client-Name': undefined,
        },
        data: { context: { client: c.context }, playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } } },
        timeout: 15000,
        validateStatus: () => true,
      });
      const data = res.data;
      console.log(`  player HTTP ${res.status} status=${data?.playabilityStatus?.status} reason=${data?.playabilityStatus?.reason || ''}`);
      const ad = data?.streamingData?.adaptiveFormats || [];
      const fm = data?.streamingData?.formats || [];
      console.log(`  adaptive=${ad.length} formats=${fm.length}`);
      const pick = ad.find(f => f.itag === 251) || ad.find(f => (f.mimeType || '').startsWith('audio/')) || fm.find(f => f.itag === 18) || ad[0] || fm[0];
      if (!pick) { console.log('  NO CANDIDATE'); continue; }
      console.log(`  pick itag=${pick.itag} mime=${pick.mimeType} hasUrl=${!!pick.url} hasCipher=${!!(pick.signatureCipher || pick.cipher)} hasN=${pick.url ? new URL(pick.url).searchParams.has('n') : 'n/a'} saber=${!!data?.streamingData?.serverAbrStreamingUrl} expire=${pick.url ? new URL(pick.url).searchParams.get('expire') : 'n/a'} ip=${pick.url ? new URL(pick.url).searchParams.get('ip') : 'n/a'}`);
      if (!pick.url) { console.log('  SKIP probe (ciphered)'); continue; }
      const url = pick.url;
      await probeUrl('bare', url, {});
      await probeUrl('browser-ua+range', url, { 'User-Agent': BROWSER_UA, Range: 'bytes=0-1', Referer: `https://www.youtube.com/watch?v=${videoId}`, Origin: 'https://www.youtube.com' });
      await probeUrl('client-ua+range', url, { 'User-Agent': c.ua, Range: 'bytes=0-1', Referer: `https://www.youtube.com/watch?v=${videoId}`, Origin: 'https://www.youtube.com' });
    } catch (e) {
      console.log(`  REQUEST FAILED ${e.message}`);
    }
  }
})();

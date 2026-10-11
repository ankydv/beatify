import Metadata, {
  selectStreamFormat,
  selectStreamFormats,
  decodeStreamUrl,
  decipherFormatUrl,
  getStreamHeaders,
  getStreamExpirySeconds,
  logPlayableUrl,
} from '../metadata.utils';

const makeMetadata = (streamingData) => ({ streamingData });

describe('selectStreamFormats', () => {
  it('returns an empty list when there is no streamingData', () => {
    expect(selectStreamFormats({})).toEqual([]);
    expect(selectStreamFormats(null)).toEqual([]);
  });

  it('prefers the highest-quality audio-only format', () => {
    const metadata = makeMetadata({
      adaptiveFormats: [
        { itag: 140, url: 'https://example.com/140', mimeType: 'audio/mp4' },
        { itag: 251, url: 'https://example.com/251', mimeType: 'audio/webm' },
      ],
    });

    expect(selectStreamFormat(metadata).itag).toBe(251);
  });

  it('ignores formats that only expose a signatureCipher', () => {
    const metadata = makeMetadata({
      adaptiveFormats: [
        { itag: 140, signatureCipher: 'cipher', mimeType: 'audio/mp4' },
      ],
      formats: [{ itag: 18, url: 'https://example.com/18' }],
    });

    const formats = selectStreamFormats(metadata);
    expect(formats).toHaveLength(1);
    expect(formats[0].itag).toBe(18);
  });

  it('treats signatureCipher without a url param as unplayable', () => {
    const metadata = makeMetadata({
      adaptiveFormats: [
        {
          itag: 140,
          signatureCipher: 'sp=sig&sig=abc',
          mimeType: 'audio/mp4',
        },
      ],
    });

    expect(selectStreamFormats(metadata)).toEqual([]);
  });

  it('falls back to muxed format 18 when audio-only is unavailable', () => {
    const metadata = makeMetadata({
      formats: [
        { itag: 22, url: 'https://example.com/22' },
        { itag: 18, url: 'https://example.com/18' },
      ],
    });

    expect(selectStreamFormat(metadata).itag).toBe(18);
  });

  it('orders audio-only mime types before muxed fallbacks', () => {
    const metadata = makeMetadata({
      adaptiveFormats: [
        { itag: 999, url: 'https://example.com/999', mimeType: 'audio/mp4' },
      ],
      formats: [{ itag: 18, url: 'https://example.com/18' }],
    });

    const formats = selectStreamFormats(metadata);
    expect(formats[0].itag).toBe(999);
    expect(formats[1].itag).toBe(18);
  });

  it('decodes percent-encoded query params exactly once', () => {
    const metadata = makeMetadata({
      adaptiveFormats: [
        {
          itag: 251,
          url: 'https://example.com/videoplayback?cps=1116%2C222&expire=9999999999&sig=abc%3D%3D',
          mimeType: 'audio/webm; codecs="opus"',
        },
      ],
    });

    const formats = selectStreamFormats(metadata);
    expect(formats).toHaveLength(1);
    // %2C stays single-encoded (%252C would mean double-encoded = 403).
    expect(formats[0].url).not.toContain('%25');
    expect(formats[0].url).toContain('cps=1116');
  });

  it('resolves signatureCipher formats into downloadable URLs', () => {
    const metadata = makeMetadata({
      adaptiveFormats: [
        {
          itag: 140,
          signatureCipher:
            'url=' +
            encodeURIComponent('https://example.com/videoplayback?expire=1') +
            '&sp=sig&sig=' +
            encodeURIComponent('abc=='),
          mimeType: 'audio/mp4',
        },
      ],
    });

    const formats = selectStreamFormats(metadata);
    expect(formats).toHaveLength(1);
    expect(formats[0].url).toContain('https://example.com/videoplayback');
    expect(formats[0].url).toContain('sig=');
  });
});

describe('Metadata', () => {
  it('returns null from getStreamingUrl when nothing is playable', () => {
    const md = new Metadata(makeMetadata({}));
    expect(md.getStreamingUrl()).toBeNull();
  });

  it('prefers the validated _playableFormat URL', () => {
    const metadata = {
      ...makeMetadata({
        adaptiveFormats: [
          { itag: 251, url: 'https://example.com/251', mimeType: 'audio/webm' },
        ],
      }),
      _playableFormat: {
        itag: 18,
        url: 'https://example.com/18',
        approxDurationMs: '120000',
      },
    };

    const md = new Metadata(metadata);
    expect(md.getStreamingUrl()).toBe('https://example.com/18');
    expect(md.getDuration()).toBe('2:00');
  });

  it('getThumb sorts thumbnails by width and maps size to quality', () => {
    const md = new Metadata({
      videoDetails: {
        thumbnail: {
          thumbnails: [
            { width: 480, url: 'large' },
            { width: 120, url: 'mini' },
            { width: 640, url: 'xlarge' },
            { width: 320, url: 'medium' },
          ],
        },
      },
    });

    expect(md.getThumb('mini').url).toBe('mini');
    expect(md.getThumb('small').url).toBe('medium');
    expect(md.getThumb('medium').url).toBe('large');
    expect(md.getThumb('large').url).toBe('xlarge');
  });

  it('getThumb clamps the requested size to the available thumbnails', () => {
    const md = new Metadata({
      videoDetails: {
        thumbnail: { thumbnails: [{ width: 120, url: 'only' }] },
      },
    });

    expect(md.getThumb('large').url).toBe('only');
  });

  it('getThumb returns null without thumbnails', () => {
    const md = new Metadata({ videoDetails: {} });
    expect(md.getThumb('mini')).toBeNull();
  });

  it('exposes decoded downloadable URL + headers via getPlayableFormatDetails', () => {
    const videoId = 'J_d_Q3pTYcc';
    const md = new Metadata({
      videoDetails: { videoId, title: 'T', author: 'A', lengthSeconds: '174' },
      streamingData: {
        adaptiveFormats: [
          {
            itag: 251,
            url: 'https://rr1.googlevideo.com/videoplayback?expire=9999999999&cps=1116%2C222&sig=abc%3D%3D',
            mimeType: 'audio/webm; codecs="opus"',
            bitrate: 156860,
            approxDurationMs: '174021',
          },
        ],
      },
    });

    const details = md.getPlayableFormatDetails();
    expect(details.itag).toBe(251);
    expect(details.url).toContain('https://rr1.googlevideo.com/videoplayback');
    expect(details.url).not.toContain('%25');
    expect(details.mimeType).toContain('audio/webm');
    // Stream UA must match the issuing InnerTube client (IOS), not Chrome.
    expect(details.headers['User-Agent']).toContain('com.google.ios.youtube');
    expect(details.headers.Referer).toContain(videoId);
    expect(details.expiresAtSeconds).toBe(9999999999);
    expect(md.getStreamingUrl()).toBe(details.url);

    const download = md.getDownloadInfo();
    expect(download.filename).toMatch(/\.webm$/);
    expect(download.url).toBe(details.url);
  });

  it('logPlayableUrl prints copy-paste URL + curl without throwing', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const details = {
      itag: 251,
      url: 'https://rr1.googlevideo.com/videoplayback?expire=9999999999&sig=abc',
      mimeType: 'audio/webm; codecs="opus"',
      expiresAtSeconds: 9999999999,
      headers: getStreamHeaders('J_d_Q3pTYcc'),
    };
    expect(() => logPlayableUrl(details, 'J_d_Q3pTYcc', 'test')).not.toThrow();
    const output = spy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('[playable-url][test][J_d_Q3pTYcc]');
    expect(output).toContain('https://rr1.googlevideo.com/videoplayback');
    expect(output).toContain('[playable-curl]');
    spy.mockRestore();

    const emptySpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => logPlayableUrl(null, 'x', 'test')).not.toThrow();
    expect(String(emptySpy.mock.calls[0][0])).toContain('NO PLAYABLE URL');
    emptySpy.mockRestore();
  });
});

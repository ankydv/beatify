import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const YOUTUBE_HOME = 'https://www.youtube.com';

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

/**
 * Fetch and store a YouTube visitor id.
 * Falls back to a previously stored value (and never throws) so callers can
 * continue even when the homepage fetch is blocked.
 */
async function getVisitorData() {
  try {
    const response = await axios.get(YOUTUBE_HOME, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    });

    const html = typeof response.data === 'string' ? response.data : '';
    const match = html.match(/"visitorData":"(.*?)"/);

    if (match && match[1]) {
      await AsyncStorage.setItem('visitorData', match[1]);
      return match[1];
    }

    console.warn('visitorData not found in YouTube homepage');
  } catch (error) {
    console.warn(
      'Failed to fetch YouTube homepage for visitorData:',
      error?.message || error
    );
  }

  // Fall back to any previously stored value.
  try {
    return await AsyncStorage.getItem('visitorData');
  } catch (error) {
    return null;
  }
}

export default getVisitorData;

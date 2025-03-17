import axios from 'axios';
import qs from 'qs';
import { getCachedMetadata, cacheMetadata } from '@/services/cache.service'
import { tokenManager } from '@/utils/token.utils';
import { refreshToken } from './auth.service';

const apiKey = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const baseUrl = 'https://www.youtube.com/youtubei/v1';
const baseParams = {
  contentCheckOk: true,
  racyCheckOk: true
};

const header = {
  'User-Agent': 'com.google.android.apps.youtube.music/',
  'X-YouTube-Client-Name': 62,
  'X-YouTube-Client-Version': '7.25.52',
};

const context = {
  "client": {
      "clientName": "ANDROID_MUSIC",
      "clientVersion": "7.25.52",
      "deviceMake": "Samsung",
      "deviceModel": "X910",
      "userAgent": "com.google.android.apps.youtube.music/",
      "osName": "android",
      "osVersion": "12.0",
      "hl": "en",
      "timeZone": "Asia/Kolkata",
      "utcOffsetMinutes": 330
    }
};

const playbackContext = {
    "contentPlaybackContext": {
      "html5Preference": "HTML5_PREF_WANTS",
    }
}

const baseData = {
  context, playbackContext
};

const executeRequest = async (url, method = 'GET', headers = {}, data = null) => {
  const baseHeaders = {
    'accept-language': 'en-US,en',
    ...headers
  };
  
  const response = await axios({
    url,
    method,
    headers: baseHeaders,
    data
  });
  
  return response.data;
};

const callApi = async (endpoint, query, data, useAuth = true) => {
  const endpointUrl = `${endpoint}?${qs.stringify(query)}`;
  let access_token;

  let headers = {
    'Content-Type': 'application/json',
    ...header
  };

  if(useAuth){
    await refreshToken();
    access_token = await tokenManager.getAccessToken();
    headers = {
      ...headers, 
      'Authorization': `Bearer ${access_token}`,
    }
  }

  const response = await executeRequest(endpointUrl, 'POST', headers, data);
  return response;
};

const player = async (videoId) => {
  // Search for metadata in the cache first
  const cachedMetadata = await getCachedMetadata(videoId);
  
  if (cachedMetadata) {
    // Return the cached metadata if found
    console.log('returning cached metadata')
    return cachedMetadata;
  }

  // Proceed with the API call if metadata is not found in cache
  const endpoint = `${baseUrl}/player`;
  const query = {
    videoId,
    ...baseParams
  };
  
  const result = await callApi(endpoint, query, baseData);

  // Cache the result for future use
  await cacheMetadata(result);
  return result;
};

export default player;
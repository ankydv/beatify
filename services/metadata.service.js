import axios from 'axios';
import querystring from 'querystring';
import { getCachedMetadata, cacheMetadata } from '@/services/cache.service'

const apiKey = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const baseUrl = 'https://www.youtube.com/youtubei/v1';
const baseParams = {
  key: apiKey,
  contentCheckOk: true,
  racyCheckOk: true
};

const header = {
  'User-Agent': 'com.google.android.apps.youtube.music/'
};

const context = {
  client: {
    clientName: 'ANDROID_MUSIC',
    clientVersion: '5.16.51',
    androidSdkVersion: 30
  }
};

const baseData = {
  context
};

const executeRequest = async (url, method = 'GET', headers = {}, data = null) => {
  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0',
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

const callApi = async (endpoint, query, data) => {
  const endpointUrl = `${endpoint}?${querystring.stringify(query)}`;
  const headers = {
    'Content-Type': 'application/json',
    ...header
  };
  
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
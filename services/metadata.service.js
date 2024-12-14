import axios from 'axios';
import querystring from 'querystring';
import { getCachedMetadata, cacheMetadata } from '@/services/cache.service'
import { tokenManager } from '@/utils/token.utils';
import { refreshToken } from './auth.service';

const apiKey = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const baseUrl = 'https://www.youtube.com/youtubei/v1';
const baseParams = {
  key: apiKey,
  contentCheckOk: true,
  racyCheckOk: true
};

const header = {
  'User-Agent': 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)',
  'X-YouTube-Client-Name': 5,
  'X-YouTube-Client-Version': '19.45.4',
};

const context = {
  "client": {
      "clientName": "IOS",
      "clientVersion": "19.45.4",
      "deviceMake": "Apple",
      "deviceModel": "iPhone16,2",
      "userAgent": "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)",
      "osName": "iPhone",
      "osVersion": "18.1.0.22B83",
      "hl": "en",
      "timeZone": "Asia/Kolkata",
      "utcOffsetMinutes": 330
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

const callApi = async (endpoint, query, data, useAuth = false) => {
  const endpointUrl = `${endpoint}?${querystring.stringify(query)}`;
  if(useAuth){
    await refreshToken();
    const access_token = await tokenManager.getAccessToken();
  }
  const headers = {
    'Content-Type': 'application/json',
    ...header
  };

  if(useAuth)
  headers = {
    ...headers, 
    'Authorization': `Bearer ${access_token}`,
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
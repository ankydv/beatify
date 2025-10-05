import {createAxiosInstance} from './createAxiosInstance';

const googleAuthApi = createAxiosInstance('https://www.googleapis.com/oauth2/v1', 'google');
export default googleAuthApi;

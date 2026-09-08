import axios from 'axios';
import {environment} from '../config/environment';
import {tokenStorage} from '../storage/tokens';
export const api=axios.create({baseURL:environment.apiBaseUrl,timeout:20_000});
api.interceptors.request.use(async config=>{const token=await tokenStorage.getAccessToken();if(token)config.headers.Authorization=`Bearer ${token}`;return config});

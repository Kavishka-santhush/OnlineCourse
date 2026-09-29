// Central axios client for the Node/Express API.
//
// Every request is authenticated with the current Clerk session token
// (Authorization: Bearer <jwt>), resolved lazily through a token provider the
// auth store registers on boot. Responses are unwrapped to `res.data`; errors
// are normalised to `{ message, status, data }`.
import axios from 'axios';
import { getClerkToken } from './clerk.js';

const baseURL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '') + '/api';

export const http = axios.create({ baseURL, withCredentials: false });

// Attach the Clerk JWT (when signed in) to every request.
http.interceptors.request.use(async (config) => {
  const token = await getClerkToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unwrap success payloads and standardise error shapes.
http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err.response?.status || 0;
    const message =
      err.response?.data?.error || err.response?.data?.message ||
      (status === 0 ? 'Network error — is the API running?' : err.message);
    return Promise.reject({ message, status, data: err.response?.data });
  },
);

/** Thin verb helpers so views read nicely: api.get('/courses') etc. */
export const api = {
  get: (url, config) => http.get(url, config),
  post: (url, body, config) => http.post(url, body, config),
  patch: (url, body, config) => http.patch(url, body, config),
  delete: (url, config) => http.delete(url, config),
  upload: (url, body, onProgress) =>
    http.post(url, body, { headers: { 'Content-Type': 'application/json' }, onUploadProgress: onProgress }),
};

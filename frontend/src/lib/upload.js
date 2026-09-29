import { api } from './api.js';
import { fileToDataUrl } from './utils.js';

/**
 * Upload a browser File to Supabase Storage through the Node API.
 * @param {File} file
 * @param {Object} opts
 *   bucket  — semantic key: 'videos' | 'files' | 'media' | 'avatars' | 'docs'
 *   folder  — storage folder/prefix, e.g. `courses/<courseId>`
 *   onProgress — (0..100)
 * @returns {Promise<{ url, path, signedUrl? }>}
 */
export async function uploadFile(file, { bucket, folder = '', onProgress } = {}) {
  const data = await fileToDataUrl(file); // data:URL; base64 payload
  const contentType = file.type || 'application/octet-stream';
  // Strip the `data:...;base64,` prefix — the API expects raw base64.
  const base64 = data.split(',')[1] || data;
  const res = await api.post('/media/upload', {
    bucket, folder, fileName: file.name, contentType, data: base64,
  }, { onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))) });
  return res;
}

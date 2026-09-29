import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { v4 as uuid } from 'uuid';

/**
 * Supabase Storage helper — ALL file uploads (videos, thumbnails, docs,
 * avatars, certificates, assignment submissions) go to Supabase Storage.
 * No local disk, no other cloud providers.
 */
const storage = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
  auth: { persistSession: false },
});

const MIME_EXT = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'audio/mpeg': 'mp3',
};

/**
 * Upload a base64 / buffer payload to a bucket and return the public URL + path.
 * @param {string} bucket bucket name (see env.storage)
 * @param {string} folder logical folder inside the bucket, e.g. `courses/{id}`
 * @param {string} originalName original file name
 * @param {string|Buffer|Uint8Array} data file contents (base64 string or Buffer)
 * @param {string} contentType MIME type
 */
export async function uploadBuffer(bucket, folder, originalName, data, contentType) {
  const ext = MIME_EXT[contentType] || (originalName?.split('.').pop() || 'bin');
  const safe = `${uuid()}.${ext}`;
  const path = `${folder ? folder.replace(/^\/|\/$/g, '') + '/' : ''}${safe}`;
  const body = typeof data === 'string' ? Buffer.from(data, 'base64') : data;

  const { error } = await storage.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: true,
  });
  if (error) throw Object.assign(new Error(`Storage upload failed: ${error.message}`), { status: 400 });

  const { data: pub } = storage.storage.from(bucket).getPublicUrl(path);
  return { path, bucket, url: pub.publicUrl };
}

/** Create a signed (private) upload/download URL, e.g. for large video chunks. */
export async function createSignedUploadUrl(bucket, path) {
  const { data, error } = await storage.storage.from(bucket).createSignedUploadUrl(path);
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return data;
}

/** Create a time-limited signed download URL for a private object. */
export async function createSignedUrl(bucket, path, expiresIn = 3600) {
  const { data, error } = await storage.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return data.signedUrl;
}

export async function removePath(bucket, path) {
  const { error } = await storage.storage.from(bucket).remove([path]);
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return { removed: path };
}

/**
 * Return a short-lived signed URL for a private video, given its stored path.
 * Accepts either a full public URL or a bucket-relative path.
 */
export async function resolveMediaUrl(bucket, pathOrUrl, expiresIn = 6 * 3600) {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  return createSignedUrl(bucket, pathOrUrl, expiresIn);
}

export { storage };

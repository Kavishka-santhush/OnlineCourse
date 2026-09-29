import { db, must, byId, insertOne, updateOne, deleteOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { validate } from '../utils/validate.js';

const CARD = 'id,title,slug,subtitle,thumbnail_url,price,is_free,rating_avg,level';

/** POST /api/wishlist/:courseId — toggle add/remove */
export const toggleWishlist = asyncHandler(async (req, res) => {
  const courseId = req.params.courseId;
  const existing = must(await db.from('wishlist').select('id').eq('user_id', req.user.id).eq('course_id', courseId).limit(1));
  if (existing.length) { await deleteOne('wishlist', existing[0].id); return res.json({ inWishlist: false }); }
  await insertOne('wishlist', { user_id: req.user.id, course_id: courseId });
  res.status(201).json({ inWishlist: true });
});

/** GET /api/wishlist — my wishlist */
export const getWishlist = asyncHandler(async (req, res) => {
  const rows = must(await db.from('wishlist').select(`course:courses(${CARD})`).eq('user_id', req.user.id).order('created_at', { ascending: false }));
  res.json({ wishlist: rows.map((r) => r.course).filter(Boolean) });
});

/* ── Collections (learning paths) ────────────────────────── */

/** POST /api/collections */
export const createCollection = asyncHandler(async (req, res) => {
  const { title, description = '', is_public = false } = req.body;
  const col = await insertOne('collections', { user_id: req.user.id, title: String(title).slice(0, 120), description, is_public });
  res.status(201).json({ collection: col });
});

/** GET /api/collections — mine + shared/public */
export const listCollections = asyncHandler(async (req, res) => {
  const mine = must(await db.from('collections').select('*, items:collection_items(course:courses(id))').eq('user_id', req.user.id));
  const shared = must(await db.from('collections').select('*, items:collection_items(course:courses(id)), owner:users(id,display_name)').eq('is_public', true).neq('user_id', req.user.id).limit(20));
  res.json({ collections: mine, shared });
});

/** GET /api/collections/:id — public or owner */
export const getCollection = asyncHandler(async (req, res) => {
  const col = must(await db.from('collections').select('*, owner:users(id,display_name,avatar_url), items:collection_items(course:courses(*))').eq('id', req.params.id).limit(1))[0];
  if (!col) throw HttpError.notFound('Collection not found');
  if (!col.is_public && col.user_id !== req.user?.id) throw HttpError.forbidden();
  res.json({ collection: col });
});

/** POST /api/collections/:id/courses — add course */
export const addToCollection = asyncHandler(async (req, res) => {
  const col = await byId('collections', req.params.id);
  if (!col) throw HttpError.notFound('Collection not found');
  if (col.user_id !== req.user.id) throw HttpError.forbidden();
  const { course_id: courseId } = validate({ course_id: 'required|uuid' }, req.body);
  const exists = must(await db.from('collection_items').select('id').eq('collection_id', col.id).eq('course_id', courseId).limit(1));
  if (exists.length) return res.json({ ok: true, note: 'already in collection' });
  await insertOne('collection_items', { collection_id: col.id, course_id: courseId });
  res.status(201).json({ ok: true });
});

/** DELETE /api/collections/:id/courses/:courseId */
export const removeFromCollection = asyncHandler(async (req, res) => {
  const col = await byId('collections', req.params.id);
  if (col.user_id !== req.user.id) throw HttpError.forbidden();
  const item = must(await db.from('collection_items').select('id').eq('collection_id', col.id).eq('course_id', req.params.courseId).limit(1))[0];
  if (item) await deleteOne('collection_items', item.id);
  res.json({ ok: true });
});

/** PATCH /api/collections/:id */
export const updateCollection = asyncHandler(async (req, res) => {
  const col = await byId('collections', req.params.id);
  if (col.user_id !== req.user.id) throw HttpError.forbidden();
  const patch = {};
  for (const k of ['title', 'description', 'is_public']) if (k in req.body) patch[k] = req.body[k];
  res.json({ collection: await updateOne('collections', col.id, patch) });
});

/** DELETE /api/collections/:id */
export const deleteCollection = asyncHandler(async (req, res) => {
  const col = await byId('collections', req.params.id);
  if (col.user_id !== req.user.id) throw HttpError.forbidden();
  await deleteOne('collections', col.id);
  res.json({ deleted: true });
});

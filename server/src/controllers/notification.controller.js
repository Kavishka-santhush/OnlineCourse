import { db, must, updateOne } from '../lib/supabase.js';
import { asyncHandler } from '../utils/httpError.js';
import { pagination } from '../utils/validate.js';

/** GET /api/notifications — paginated + unread count */
export const list = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query, { defaultLimit: 30 });
  let q = db.from('notifications').select('*', { count: 'exact' }).eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (req.query.unread === 'true') q = q.eq('read', false);
  const { data, count } = await q.range(offset, offset + limit - 1);
  const { count: unread } = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('read', false);
  res.json({ notifications: data || [], total: count, unread: unread || 0, page, limit });
});

/** POST /api/notifications/:id/read */
export const markRead = asyncHandler(async (req, res) => {
  await updateOne('notifications', req.params.id, { read: true });
  res.json({ ok: true });
});

/** POST /api/notifications/read-all */
export const markAllRead = asyncHandler(async (req, res) => {
  must(await db.from('notifications').update({ read: true }).eq('user_id', req.user.id).eq('read', false));
  res.json({ ok: true });
});

/** DELETE /api/notifications/:id */
export const remove = asyncHandler(async (req, res) => {
  must(await db.from('notifications').delete().eq('id', req.params.id).eq('user_id', req.user.id));
  res.json({ ok: true });
});

/** GET /api/notifications/preferences */
export const getPreferences = asyncHandler(async (req, res) => {
  const rows = must(await db.from('notification_preferences').select('*').eq('user_id', req.user.id));
  res.json({ preferences: rows });
});

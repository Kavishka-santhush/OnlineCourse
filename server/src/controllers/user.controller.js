import { db, must, byId, updateOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { validate, pagination } from '../utils/validate.js';
import { activity } from '../utils/audit.js';
import { uploadBuffer } from '../lib/storage.js';
import { env } from '../config/env.js';

const PUBLIC_USER = 'id, clerk_id, display_name, username, email, avatar_url, bio, website, social_links, timezone, language, role, instructor_tier, is_verified_instructor, created_at';

/** GET /api/users/me */
export const getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

/** PATCH /api/users/me */
export const updateMe = asyncHandler(async (req, res) => {
  const data = validate({
    display_name: 'string|max:80',
    username: 'string|max:40',
    bio: 'string|max:1000',
    website: 'string|max:200',
    social_links: 'object',
    timezone: 'string|max:60',
    language: 'string|max:10',
    avatar_url: 'string|max:500',
  }, req.body);
  if (data.username) {
    const dup = must(await db.from('users').select('id').eq('username', data.username).neq('id', req.user.id).limit(1));
    if (dup.length) throw HttpError.conflict('Username is already taken');
  }
  const user = await updateOne('users', req.user.id, data);
  await activity({ userId: req.user.id, action: 'profile.update', description: 'Updated profile' });
  res.json({ user });
});

/** POST /api/users/me/avatar — body: { data (base64), contentType } */
export const uploadAvatar = asyncHandler(async (req, res) => {
  const { data, contentType = 'image/png' } = req.body;
  if (!data) throw HttpError.badRequest('Missing base64 data');
  const file = await uploadBuffer(env.storage.avatars, `users/${req.user.id}`, 'avatar', data, contentType);
  const user = await updateOne('users', req.user.id, { avatar_url: file.url, avatar_path: file.path });
  res.json({ url: file.url, user });
});

/** PATCH /api/users/me/settings — notification + privacy prefs */
export const updateSettings = asyncHandler(async (req, res) => {
  const { notifications = {}, privacy = {} } = req.body;
  for (const [type, prefs] of Object.entries(notifications)) {
    await db.from('notification_preferences')
      .upsert({ user_id: req.user.id, type, in_app: prefs.in_app ?? true, email: prefs.email ?? true }, { onConflict: 'user_id,type' });
  }
  await db.from('users').update({ privacy_settings: privacy }).eq('id', req.user.id);
  res.json({ ok: true });
});

/** GET /api/users/me/activity */
export const myActivity = asyncHandler(async (req, res) => {
  const { limit, offset } = pagination(req.query, { defaultLimit: 50 });
  const rows = must(await db.from('user_activity').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).range(offset, offset + limit - 1));
  res.json({ activity: rows });
});

/** GET /api/users/:id — public profile */
export const getProfile = asyncHandler(async (req, res) => {
  const user = await byId('users', req.params.id, PUBLIC_USER);
  if (!user) throw HttpError.notFound('User not found');
  res.json({ user });
});

/* ── Admin user management ───────────────────────────────── */

/** GET /api/admin/users */
export const listUsers = asyncHandler(async (req, res) => {
  const { limit, offset } = pagination(req.query, { defaultLimit: 25 });
  const { role, q, suspended } = req.query;
  let query = db.from('users').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (role) query = query.eq('role', role);
  if (suspended !== undefined) query = query.eq('is_suspended', suspended === 'true');
  if (q) query = query.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data, count } = await query.range(offset, offset + limit - 1);
  res.json({ users: must({ data, error: null }), total: count, limit, offset });
});

/** PATCH /api/admin/users/:id/role */
export const changeRole = asyncHandler(async (req, res) => {
  const { role } = validate({ role: 'required|string|in:student,instructor,moderator,admin,super_admin' }, req.body);
  const target = await byId('users', req.params.id);
  if (!target) throw HttpError.notFound('User not found');
  if (req.user.role !== 'super_admin' && ['admin', 'super_admin'].includes(role)) {
    throw HttpError.forbidden('Only super admin can grant admin roles');
  }
  const user = await updateOne('users', target.id, { role });
  res.json({ user });
});

/** POST /api/admin/users/:id/suspend | /unsuspend */
export const setSuspension = asyncHandler(async (req, res) => {
  const suspend = req.path.includes('suspend') && !req.path.includes('unsuspend');
  const reason = req.body.reason || null;
  const user = await updateOne('users', req.params.id, { is_suspended: suspend, suspension_reason: reason });
  if (!user) throw HttpError.notFound('User not found');
  res.json({ user, note: suspend ? 'Clerk session should be invalidated via Ban API' : 'Reactivated' });
});

/** DELETE /api/admin/users/:id */
export const deleteUser = asyncHandler(async (req, res) => {
  must(await db.from('users').delete().eq('id', req.params.id));
  res.json({ deleted: true });
});

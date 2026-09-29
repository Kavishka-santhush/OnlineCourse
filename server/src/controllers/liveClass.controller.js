import { db, must, byId, insertOne, updateOne, deleteOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { validate, pagination } from '../utils/validate.js';
import { assertCanEdit } from './course.controller.js';
import { notifyCourseAudience } from '../services/notify.service.js';
import { uploadBuffer } from '../lib/storage.js';
import { env } from '../config/env.js';

const isStaff = (u) => ['admin', 'super_admin', 'moderator'].includes(u?.role);

async function ownClass(req, id) {
  const lc = await byId('live_classes', id);
  if (!lc) throw HttpError.notFound('Live class not found');
  if (lc.instructor_id !== req.user.id && !isStaff(req.user)) throw HttpError.forbidden();
  return lc;
}

/** POST /api/live-classes — instructor schedules a session */
export const createLiveClass = asyncHandler(async (req, res) => {
  const data = validate({
    title: 'required|string|max:160',
    course_id: 'uuid',
    description: 'string|max:2000',
    starts_at: 'required|date',
    duration_minutes: 'number|min:5',
    max_participants: 'number|min:0',
    is_public: 'bool',
  }, req.body);
  if (data.course_id) await assertCanEdit(req, data.course_id);
  const lc = await insertOne('live_classes', {
    instructor_id: req.user.id, is_public: false, max_participants: 0, duration_minutes: 60,
    status: 'scheduled', ...data,
  });
  if (data.course_id) {
    await notifyCourseAudience(data.course_id, { type: 'live_class', title: 'New live class', body: `${data.title} — ${data.starts_at}`, link: `/live/${lc.id}` });
  }
  res.status(201).json({ liveClass: lc });
});

/** PATCH /api/live-classes/:id */
export const updateLiveClass = asyncHandler(async (req, res) => {
  const lc = await ownClass(req, req.params.id);
  const allowed = ['title', 'description', 'starts_at', 'duration_minutes', 'max_participants', 'is_public', 'status', 'recording_url', 'recording_path'];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
  res.json({ liveClass: await updateOne('live_classes', lc.id, patch) });
});

/** DELETE /api/live-classes/:id */
export const deleteLiveClass = asyncHandler(async (req, res) => {
  const lc = await ownClass(req, req.params.id);
  await deleteOne('live_classes', lc.id);
  res.json({ deleted: true });
});

/** GET /api/live-classes — upcoming (public lists public ones; enrolled see their courses') */
export const listLiveClasses = asyncHandler(async (req, res) => {
  const { limit, offset } = pagination(req.query, { defaultLimit: 25 });
  let q = db.from('live_classes').select('*, course:courses(id,title,slug), instructor:users(id,display_name,avatar_url)').gte('starts_at', new Date().toISOString()).order('starts_at');
  if (!req.user || !isStaff(req.user)) q = q.or(`is_public.eq.true,instructor_id.eq.${req.user?.id || '00000000-0000-0000-0000-000000000000'}`);
  const rows = must(await q.range(offset, offset + limit - 1));
  res.json({ liveClasses: rows });
});

/** GET /api/live-classes/:id — join detail (enforcement of enrollment for private) */
export const getLiveClass = asyncHandler(async (req, res) => {
  const lc = must(await db.from('live_classes').select('*, course:courses(id,title,instructor_id), instructor:users(id,display_name)').eq('id', req.params.id).limit(1))[0];
  if (!lc) throw HttpError.notFound('Live class not found');
  let allowed = lc.is_public || lc.instructor_id === req.user?.id || isStaff(req.user);
  if (!allowed && lc.course) {
    const enr = must(await db.from('enrollments').select('id').eq('user_id', req.user?.id).eq('course_id', lc.course.id).limit(1));
    allowed = enr.length > 0;
  }
  if (!allowed) throw HttpError.forbidden('Enroll in the course to join this live class');
  if (req.user) await insertOne('live_class_attendance', { live_class_id: lc.id, user_id: req.user.id, joined_at: new Date().toISOString() }).catch(() => {});
  res.json({ liveClass: lc, canManage: lc.instructor_id === req.user?.id || isStaff(req.user) });
});

/** POST /api/live-classes/:id/leave — finalise attendance duration */
export const leaveLiveClass = asyncHandler(async (req, res) => {
  const att = must(await db.from('live_class_attendance').select('*').eq('live_class_id', req.params.id).eq('user_id', req.user.id).is('left_at', null).limit(1))[0];
  if (att) await updateOne('live_class_attendance', att.id, { left_at: new Date().toISOString() });
  res.json({ ok: true });
});

/** POST /api/live-classes/:id/recording — upload replay (auto-added as lesson) */
export const uploadRecording = asyncHandler(async (req, res) => {
  const lc = await ownClass(req, req.params.id);
  const { data, contentType = 'video/mp4' } = req.body;
  if (!data) throw HttpError.badRequest('Missing recording data');
  const file = await uploadBuffer(env.storage.videos, `live/${lc.id}`, 'recording', data, contentType);
  await updateOne('live_classes', lc.id, { recording_url: file.url, recording_path: file.path, status: 'recorded' });
  if (lc.course_id) {
    const { data: lastSec } = await db.from('sections').select('id').eq('course_id', lc.course_id).order('position', { ascending: false }).limit(1);
    const sectionId = req.body.section_id || lastSec?.[0]?.id;
    if (sectionId) {
      const { data: last } = await db.from('lessons').select('position').eq('section_id', sectionId).order('position', { ascending: false }).limit(1);
      await insertOne('lessons', { section_id: sectionId, course_id: lc.course_id, title: `Replay: ${lc.title}`, type: 'video', video_url: file.url, video_path: file.path, position: (last?.[0]?.position ?? 0) + 1, duration_seconds: lc.duration_minutes * 60 });
    }
  }
  res.json({ recording: file, lessonAdded: Boolean(lc.course_id) });
});

/** GET /api/live-classes/:id/attendance */
export const classAttendance = asyncHandler(async (req, res) => {
  const lc = await ownClass(req, req.params.id);
  const rows = must(await db.from('live_class_attendance').select('*, user:users(id,display_name,avatar_url)').eq('live_class_id', lc.id));
  res.json({ attendance: rows });
});

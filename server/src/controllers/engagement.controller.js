import { db, must, byId, insertOne, updateOne, deleteOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { validate, pagination } from '../utils/validate.js';
import { notifyCourseAudience } from '../services/notify.service.js';
import { audit } from '../utils/audit.js';
import { notify } from '../services/notify.service.js';

const isStaff = (u) => ['admin', 'super_admin', 'moderator'].includes(u?.role);

/* ── Q&A per lesson/course ───────────────────────────────── */

/** POST /api/qa — { course_id, lesson_id?, question, parent_id? } */
export const createQuestion = asyncHandler(async (req, res) => {
  const { course_id: courseId, lesson_id: lessonId = null, question, parent_id: parentId = null } = validate({ course_id: 'required|uuid', question: 'required|string|max:4000' }, req.body);
  const enr = must(await db.from('enrollments').select('id').eq('user_id', req.user.id).eq('course_id', courseId).limit(1));
  const course = await byId('courses', courseId);
  const isResponding = parentId && (req.user.id === course.instructor_id || isStaff(req.user));
  if (!enr.length && !isResponding) throw HttpError.forbidden('Enroll to ask questions');
  const thread = await insertOne('qa_threads', {
    course_id: courseId, lesson_id: lessonId, author_id: req.user.id,
    question: parentId ? null : question,
    parent_id: parentId,
    answer: parentId ? question : null,
    is_instructor_answer: parentId ? (req.user.id === course.instructor_id) : false,
  });
  res.status(201).json({ thread });
});

/** GET /api/qa/course/:courseId — list threads + answers */
export const courseQuestions = asyncHandler(async (req, res) => {
  const { limit, offset } = pagination(req.query, { defaultLimit: 30 });
  const threads = must(await db.from('qa_threads').select('*, author:users(id,display_name,avatar_url,role), answers:qa_threads(id,answer,is_instructor_answer,created_at,author:users(id,display_name,avatar_url,role))')
    .eq('course_id', req.params.courseId).is('parent_id', null).order('created_at', { ascending: false }).range(offset, offset + limit - 1));
  res.json({ threads });
});

/** POST /api/qa/:id/upvote */
export const upvoteAnswer = asyncHandler(async (req, res) => {
  const t = await byId('qa_threads', req.params.id);
  if (!t) throw HttpError.notFound();
  await updateOne('qa_threads', t.id, { upvotes: (t.upvotes || 0) + 1 });
  res.json({ upvotes: (t.upvotes || 0) + 1 });
});

/** POST /api/qa/:id/accept — question author marks best answer */
export const acceptAnswer = asyncHandler(async (req, res) => {
  const t = await byId('qa_threads', req.params.id);
  const root = await byId('qa_threads', t.parent_id);
  if (root.author_id !== req.user.id && !isStaff(req.user)) throw HttpError.forbidden();
  await updateOne('qa_threads', t.id, { accepted: true });
  res.json({ ok: true });
});

/** GET /api/qa/instructor — all questions across instructor's courses */
export const instructorQuestions = asyncHandler(async (req, res) => {
  const courseIds = must(await db.from('courses').select('id').eq('instructor_id', req.user.id)).map((c) => c.id);
  const rows = courseIds.length ? must(await db.from('qa_threads').select('*, course:courses(id,title), author:users(id,display_name)').in('course_id', courseIds).is('parent_id', null).order('created_at', { ascending: false }).limit(100)) : [];
  res.json({ questions: rows });
});

/* ── Direct messaging (course-scoped) ────────────────────── */

/** POST /api/messages — { recipient_id, course_id?, body } */
export const sendMessage = asyncHandler(async (req, res) => {
  const { recipient_id: recipientId, course_id: courseId = null } = validate({ recipient_id: 'required|uuid', body: 'required|string|max:4000' }, req.body);
  if (!req.body.body) throw HttpError.unprocessable('Validation failed', { body: 'required' });
  // Only allow messaging instructors of courses the sender is enrolled in (course-related)
  if (recipientId !== req.user.id) {
    const recipient = await byId('users', recipientId);
    if (!recipient) throw HttpError.notFound('Recipient not found');
    if (!['instructor', 'admin', 'super_admin', 'moderator'].includes(recipient.role)) throw HttpError.forbidden('You can only message instructors');
  }
  const msg = await insertOne('messages', { sender_id: req.user.id, recipient_id: recipientId, course_id: courseId, body: req.body.body });
  await notify({ userId: recipientId, type: 'message', title: 'New message', body: `${req.user.display_name}: ${String(req.body.body).slice(0, 80)}`, link: '/dashboard/messages' });
  res.status(201).json({ message: msg });
});

/** GET /api/messages/thread/:userId */
export const messageThread = asyncHandler(async (req, res) => {
  const other = req.params.userId;
  const rows = must(await db.from('messages').select('*').or(`and(sender_id.eq.${req.user.id},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${req.user.id})`).order('created_at').limit(500));
  await db.from('messages').update({ read: true }).eq('recipient_id', req.user.id).eq('sender_id', other).eq('read', false);
  res.json({ messages: rows });
});

/** GET /api/messages — inbox conversations */
export const inbox = asyncHandler(async (req, res) => {
  const rows = must(await db.from('messages').select('*, sender:users(id,display_name,avatar_url), recipient:users(id,display_name)').or(`sender_id.eq.${req.user.id},recipient_id.eq.${req.user.id}`).order('created_at', { ascending: false }).limit(300));
  const convos = {};
  for (const m of rows) {
    const other = m.sender_id === req.user.id ? m.recipient : m.sender;
    const key = other.id;
    if (!convos[key]) convos[key] = { user: other, last: m, unread: 0 };
    if (m.recipient_id === req.user.id && !m.read) convos[key].unread++;
  }
  res.json({ conversations: Object.values(convos) });
});

/* ── Platform announcements (super admin) ────────────────── */

export const createPlatformAnnouncement = asyncHandler(async (req, res) => {
  const { title, body, level = 'info', active = true } = validate({ title: 'required|string|max:160', body: 'string|max:4000' }, req.body);
  const ann = await insertOne('platform_announcements', { author_id: req.user.id, title, body, level, active });
  await audit({ actorId: req.user.id, action: 'announcement.create', entityType: 'platform_announcement', entityId: ann.id });
  res.status(201).json({ announcement: ann });
});

export const listPlatformAnnouncements = asyncHandler(async (req, res) => {
  const rows = must(await db.from('platform_announcements').select('*').order('created_at', { ascending: false }).limit(50));
  res.json({ announcements: rows });
});

export const deletePlatformAnnouncement = asyncHandler(async (req, res) => {
  await deleteOne('platform_announcements', req.params.id);
  res.json({ deleted: true });
});

/** GET /api/announcements/active — public banner + dashboard notices */
export const activeAnnouncements = asyncHandler(async (req, res) => {
  const rows = must(await db.from('platform_announcements').select('id,title,body,level,created_at').eq('active', true).order('created_at', { ascending: false }).limit(5));
  res.json({ announcements: rows });
});

export { notifyCourseAudience };

import { db, must, byId, insertOne, updateOne, deleteOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { validate } from '../utils/validate.js';
import { uploadBuffer, createSignedUrl } from '../lib/storage.js';
import { env } from '../config/env.js';
import { assertCanEdit } from './course.controller.js';
import { notifyCourseAudience } from '../services/notify.service.js';

const LESSON_TYPES = ['video', 'article', 'pdf', 'audio', 'quiz', 'assignment', 'live_class'];

async function loadCourseForEdit(req, courseId) {
  return assertCanEdit(req, courseId);
}

/* ── Sections ────────────────────────────────────────────── */

/** POST /api/courses/:courseId/sections */
export const createSection = asyncHandler(async (req, res) => {
  await loadCourseForEdit(req, req.params.courseId);
  const { title } = validate({ title: 'required|string|max:160' }, req.body);
  const { data: existing } = await db.from('sections').select('position').eq('course_id', req.params.courseId).order('position', { ascending: false }).limit(1);
  const nextPos = (existing?.[0]?.position ?? 0) + 1;
  const section = await insertOne('sections', { course_id: req.params.courseId, title, position: nextPos });
  res.status(201).json({ section });
});

/** PATCH /api/sections/:id */
export const updateSection = asyncHandler(async (req, res) => {
  const section = await byId('sections', req.params.id);
  if (!section) throw HttpError.notFound('Section not found');
  await loadCourseForEdit(req, section.course_id);
  const patch = {};
  if ('title' in req.body) patch.title = req.body.title;
  if ('position' in req.body) patch.position = Number(req.body.position);
  res.json({ section: await updateOne('sections', section.id, patch) });
});

/** DELETE /api/sections/:id */
export const deleteSection = asyncHandler(async (req, res) => {
  const section = await byId('sections', req.params.id);
  if (!section) throw HttpError.notFound('Section not found');
  await loadCourseForEdit(req, section.course_id);
  await deleteOne('sections', section.id);
  res.json({ deleted: true });
});

/* ── Lessons ─────────────────────────────────────────────── */

/** POST /api/sections/:sectionId/lessons */
export const createLesson = asyncHandler(async (req, res) => {
  const section = await byId('sections', req.params.sectionId);
  if (!section) throw HttpError.notFound('Section not found');
  await loadCourseForEdit(req, section.course_id);
  const data = validate({
    title: 'required|string|max:200',
    type: `required|string|in:${LESSON_TYPES.join(',')}`,
  }, req.body);
  const { data: last } = await db.from('lessons').select('position').eq('section_id', section.id).order('position', { ascending: false }).limit(1);
  const lesson = await insertOne('lessons', {
    section_id: section.id,
    course_id: section.course_id,
    position: (last?.[0]?.position ?? 0) + 1,
    is_preview: false,
    duration_seconds: Number(req.body.duration_seconds || 0),
    ...data,
  });
  res.status(201).json({ lesson });
});

/** PATCH /api/lessons/:id */
export const updateLesson = asyncHandler(async (req, res) => {
  const lesson = await byId('lessons', req.params.id);
  if (!lesson) throw HttpError.notFound('Lesson not found');
  await loadCourseForEdit(req, lesson.course_id);
  const allowed = ['title', 'type', 'content', 'duration_seconds', 'is_preview', 'prerequisite_lesson_id', 'attachment_urls', 'resources', 'position', 'video_url', 'video_path', 'captions'];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = k.includes('position') || k.includes('duration') ? Number(req.body[k]) : req.body[k];
  const updated = await updateOne('lessons', lesson.id, patch);
  // New lesson published on an already-published course → notify students
  if (updated && lesson.status !== 'published' && updated.is_preview !== undefined) {
    // no-op hook point
  }
  res.json({ lesson: updated });
});

/** DELETE /api/lessons/:id */
export const deleteLesson = asyncHandler(async (req, res) => {
  const lesson = await byId('lessons', req.params.id);
  if (!lesson) throw HttpError.notFound('Lesson not found');
  await loadCourseForEdit(req, lesson.course_id);
  await deleteOne('lessons', lesson.id);
  res.json({ deleted: true });
});

/** POST /api/courses/:courseId/reorder — { order: [{section_id, lessons:[id,...]}] } */
export const reorderCurriculum = asyncHandler(async (req, res) => {
  await loadCourseForEdit(req, req.params.courseId);
  const order = Array.isArray(req.body.order) ? req.body.order : [];
  for (const [sIdx, section] of order.entries()) {
    await updateOne('sections', section.section_id, { position: sIdx + 1 });
    for (const [lIdx, lessonId] of (section.lessons || []).entries()) {
      await updateOne('lessons', lessonId, { position: lIdx + 1, section_id: section.section_id });
    }
  }
  res.json({ ok: true });
});

/** GET /api/courses/:courseId/curriculum — management view (all lessons, full fields) */
export const getCurriculum = asyncHandler(async (req, res) => {
  await loadCourseForEdit(req, req.params.courseId);
  const sections = must(await db.from('sections').select('*').eq('course_id', req.params.courseId).order('position'));
  const lessons = must(await db.from('lessons').select('*').eq('course_id', req.params.courseId).order('position', { ascending: true }));
  for (const s of sections) s.lessons = lessons.filter((l) => l.section_id === s.id);
  const totalDuration = lessons.reduce((a, l) => a + (l.duration_seconds || 0), 0);
  res.json({ sections, totalLessons: lessons.length, totalDuration });
});

/* ── Media upload to Supabase Storage ────────────────────── */

/**
 * POST /api/media/upload — body: { bucket, folder, fileName, contentType, data(base64) }
 * Instructors/staff only for course buckets; authenticated users for avatars/docs.
 * Returns { url, path, signedUrl? }. Videos returned as signed URLs for playback.
 */
export const uploadMedia = asyncHandler(async (req, res) => {
  const { folder = '', fileName = 'file', contentType = 'application/octet-stream', data } = req.body;
  if (!data) throw HttpError.badRequest('Missing base64 data');
  // Accept a semantic key (videos|files|media|avatars|certs|docs) OR the raw
  // bucket id, then resolve to the configured bucket so the browser never has
  // to know the real Supabase bucket names.
  const allowedBuckets = Object.values(env.storage);
  const bucket = env.storage[req.body.bucket] || req.body.bucket;
  if (!allowedBuckets.includes(bucket)) throw HttpError.badRequest('Unknown bucket');
  if ([env.storage.videos, env.storage.files, env.storage.media].includes(bucket)) {
    // must be an instructor creating content — enforce via folder prefix `courses/<id>`
    const m = /^courses\/([^/]+)/.exec(folder);
    if (m) await loadCourseForEdit(req, m[1]);
  }
  const file = await uploadBuffer(bucket, folder || `users/${req.user.id}`, fileName, data, contentType);
  const signedUrl = bucket === env.storage.videos ? await createSignedUrl(bucket, file.path, 6 * 3600) : null;
  res.status(201).json({ ...file, signedUrl });
});

/** GET /api/media/signed-url?bucket=&path= — stream a private asset */
export const signedUrl = asyncHandler(async (req, res) => {
  const { path } = req.query;
  if (!req.query.bucket || !path) throw HttpError.badRequest('bucket and path required');
  // Accept a semantic key (videos|files|media|avatars|certs|docs) OR the raw bucket id.
  const bucket = env.storage[req.query.bucket] || req.query.bucket;
  res.json({ url: await createSignedUrl(bucket, path, 3600) });
});

/** Notify enrolled students that a course has new content (instructor-triggered). */
export const announceNewLessons = asyncHandler(async (req, res) => {
  const course = await loadCourseForEdit(req, req.params.courseId);
  const result = await notifyCourseAudience(course.id, {
    type: 'new_lesson',
    title: `New content in ${course.title}`,
    body: 'Your instructor added new lessons. Continue learning!',
    link: `/learn/${course.slug}`,
    emailTemplate: 'newLesson',
    emailData: { courseTitle: course.title, lessonTitle: req.body.lesson_title || 'new lessons' },
  });
  res.json(result);
});

export { LESSON_TYPES };

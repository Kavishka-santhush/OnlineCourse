import { db, must, byId, insertOne, updateOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { validate, pagination } from '../utils/validate.js';
import { notify } from '../services/notify.service.js';
import { maybeIssueCertificate } from './certificate.controller.js';

/** Internal: create an enrollment if not present. Returns { enrollment, created }. */
export async function grantEnrollment({ userId, courseId, orderId = null, source = 'purchase', accessExpiresAt = null }) {
  const existing = must(await db.from('enrollments').select('*').eq('user_id', userId).eq('course_id', courseId).limit(1));
  if (existing.length) return { enrollment: existing[0], created: false };
  const enrollment = await insertOne('enrollments', {
    user_id: userId, course_id: courseId, order_id: orderId, source,
    status: 'active', progress_percent: 0, access_expires_at: accessExpiresAt,
    last_accessed_at: new Date().toISOString(),
  });
  // keep denormalised counter accurate via read-modify-write increment
  const course = await byId('courses', courseId);
  if (course) await updateOne('courses', courseId, { enrollment_count: (course.enrollment_count || 0) + 1 });
  return { enrollment, created: true };
}

/** POST /api/enrollments/free/:courseId — enroll in a free course */
export const enrollFree = asyncHandler(async (req, res) => {
  const course = await byId('courses', req.params.courseId);
  if (!course) throw HttpError.notFound('Course not found');
  if (!course.is_free && Number(course.price) > 0) throw HttpError.badRequest('Course is not free — use checkout');
  if (course.status !== 'published') throw HttpError.badRequest('Course not available');
  const { enrollment, created } = await grantEnrollment({ userId: req.user.id, courseId: course.id, source: 'free' });
  if (created) {
    await notify({ userId: req.user.id, type: 'purchase', title: 'Enrolled', body: `You are enrolled in ${course.title}`, link: `/learn/${course.slug}`, email: req.user.email, emailTemplate: 'purchase', emailData: { name: req.user.display_name, courseTitle: course.title, amount: 'Free' } });
  }
  res.status(created ? 201 : 200).json({ enrollment });
});

/** GET /api/enrollments/me — my learning */
export const myEnrollments = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query, { defaultLimit: 50 });
  const rows = must(await db.from('enrollments')
    .select('*, course:courses(id,title,slug,thumbnail_url,level,language,total_duration_seconds), last_lesson:lessons(id,title,position)')
    .eq('user_id', req.user.id)
    .order('last_accessed_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1));
  const { count } = await db.from('enrollments').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id);
  res.json({ enrollments: rows, total: count, page, limit });
});

/** Access guard for learning endpoints. */
async function assertEnrolled(req, courseId) {
  const rows = must(await db.from('enrollments').select('*').eq('user_id', req.user.id).eq('course_id', courseId).limit(1));
  const enrollment = rows[0];
  if (!enrollment) throw HttpError.forbidden('Not enrolled in this course');
  if (enrollment.status === 'revoked') throw HttpError.forbidden('Access revoked');
  if (enrollment.access_expires_at && new Date(enrollment.access_expires_at) < new Date()) throw HttpError.forbidden('Access expired');
  return enrollment;
}

async function recalcProgress(userId, courseId) {
  const lessons = must(await db.from('lessons').select('id, requires_completion').eq('course_id', courseId));
  const required = lessons.filter((l) => l.requires_completion !== false);
  const total = required.length || lessons.length;
  const done = must(await db.from('lesson_progress').select('id').eq('user_id', userId).eq('course_id', courseId).eq('completed', true));
  const percent = total ? Math.round((Math.min(done.length, total) / total) * 100) : 0;
  const complete = percent >= 100 && total > 0;
  const enrollment = must(await db.from('enrollments').select('*').eq('user_id', userId).eq('course_id', courseId).limit(1))[0];
  if (enrollment) {
    await updateOne('enrollments', enrollment.id, {
      progress_percent: percent,
      status: complete ? 'completed' : 'active',
      completed_at: complete ? (enrollment.completed_at || new Date().toISOString()) : enrollment.completed_at,
    });
  }
  return { percent, complete, enrollment };
}

/** POST /api/progress/lesson — { course_id, lesson_id, completed, position_seconds, watched_seconds } */
export const trackLesson = asyncHandler(async (req, res) => {
  const { course_id: courseId, lesson_id: lessonId } = validate({ course_id: 'required|uuid', lesson_id: 'required|uuid' }, req.body);
  await assertEnrolled(req, courseId);

  const rows = must(await db.from('lesson_progress').select('*').eq('user_id', req.user.id).eq('lesson_id', lessonId).limit(1));
  const existing = rows[0] || null;
  const payload = {
    user_id: req.user.id,
    course_id: courseId,
    lesson_id: lessonId,
    completed: req.body.completed ?? existing?.completed ?? false,
    position_seconds: Number(req.body.position_seconds || existing?.position_seconds || 0),
    watched_seconds: Number(req.body.watched_seconds || 0) + (existing?.watched_seconds || 0),
    completed_at: req.body.completed ? (existing?.completed_at || new Date().toISOString()) : existing?.completed_at || null,
  };
  let progress;
  if (existing) progress = await updateOne('lesson_progress', existing.id, payload);
  else progress = await insertOne('lesson_progress', payload);

  await updateOne('enrollments', (await assertEnrolled(req, courseId)).id, { last_accessed_at: new Date().toISOString(), last_lesson_id: lessonId });
  const { percent, complete } = await recalcProgress(req.user.id, courseId);
  if (complete) await maybeIssueCertificate({ userId: req.user.id, courseId });
  res.json({ progress, percent, complete });
});

/** POST /api/progress/complete — { course_id, lesson_id } toggle completion */
export const markComplete = asyncHandler(async (req, res) => {
  const { course_id: courseId, lesson_id: lessonId, completed = true } = validate({ course_id: 'required|uuid', lesson_id: 'required|uuid' }, req.body);
  await assertEnrolled(req, courseId);
  return res.json(await trackLessonHelper(req.user.id, courseId, lessonId, completed));
});

async function trackLessonHelper(userId, courseId, lessonId, completed) {
  const rows = must(await db.from('lesson_progress').select('*').eq('user_id', userId).eq('lesson_id', lessonId).limit(1));
  const existing = rows[0];
  if (existing) await updateOne('lesson_progress', existing.id, { completed, completed_at: completed ? new Date().toISOString() : null });
  else await insertOne('lesson_progress', { user_id: userId, course_id: courseId, lesson_id: lessonId, completed, completed_at: completed ? new Date().toISOString() : null, watched_seconds: 0, position_seconds: 0 });
  const { percent, complete } = await recalcProgress(userId, courseId);
  if (complete) await maybeIssueCertificate({ userId, courseId });
  return { percent, complete };
}

/** GET /api/progress/:courseId — resume state + per-lesson progress */
export const getCourseProgress = asyncHandler(async (req, res) => {
  const courseId = req.params.courseId;
  const enrollment = await assertEnrolled(req, courseId);
  const lessons = must(await db.from('lessons')
    .select('id,title,type,position,section_id,duration_seconds,content,video_url,video_path,captions,attachment_urls,resources,requires_completion,is_preview')
    .eq('course_id', courseId).order('position', { ascending: true }));
  const progress = must(await db.from('lesson_progress').select('lesson_id,completed,position_seconds,watched_seconds').eq('user_id', req.user.id).eq('course_id', courseId));
  const pMap = Object.fromEntries(progress.map((p) => [p.lesson_id, p]));
  // Map interactive lessons to their quiz / assignment ids so the player can load them.
  const quizzes = must(await db.from('quizzes').select('id,lesson_id').eq('course_id', courseId));
  const qMap = Object.fromEntries(quizzes.map((q) => [q.lesson_id, q.id]));
  const assignments = must(await db.from('assignments').select('id,lesson_id').eq('course_id', courseId));
  const aMap = Object.fromEntries(assignments.map((a) => [a.lesson_id, a.id]));
  const nextLesson = lessons.find((l) => !pMap[l.id]?.completed) || lessons[0];
  res.json({
    enrollment,
    lessons: lessons.map((l) => ({ ...l, progress: pMap[l.id] || null, quiz_id: qMap[l.id] || null, assignment_id: aMap[l.id] || null })),
    nextLesson, percent: enrollment.progress_percent,
  });
});

/** POST /api/progress/study-time — increments today's study seconds + streak */
export const trackStudyTime = asyncHandler(async (req, res) => {
  const seconds = Math.min(600, Number(req.body.seconds || 0));
  const today = new Date().toISOString().slice(0, 10);
  const existing = must(await db.from('learning_stats').select('*').eq('user_id', req.user.id).limit(1))[0];
  const stats = existing || await insertOne('learning_stats', { user_id: req.user.id, total_seconds: 0, streak_days: 0, courses_completed: 0 });
  const lastDate = stats.last_active_date;
  let streak = stats.streak_days || 0;
  if (lastDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    streak = lastDate === yesterday ? streak + 1 : 1;
  }
  await updateOne('learning_stats', stats.id, {
    total_seconds: (stats.total_seconds || 0) + seconds,
    streak_days: streak,
    last_active_date: today,
  });
  res.json({ streak, total_seconds: (stats.total_seconds || 0) + seconds });
});

/** Learning stats summary for dashboard */
export const learningStats = asyncHandler(async (req, res) => {
  const stats = must(await db.from('learning_stats').select('*').eq('user_id', req.user.id).limit(1))[0] || { total_seconds: 0, streak_days: 0, courses_completed: 0 };
  const { count: enrolled } = await db.from('enrollments').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id);
  const { count: completed } = await db.from('enrollments').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('status', 'completed');
  res.json({ stats: { ...stats, courses_completed: completed || 0 }, enrolled: enrolled || 0 });
});

export { assertEnrolled, recalcProgress };

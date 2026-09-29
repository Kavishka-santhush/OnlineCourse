import slugify from 'slugify';
import { db, must, byId, insertOne, updateOne, deleteOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { validate, pagination } from '../utils/validate.js';
import { audit } from '../utils/audit.js';
import { notifyCourseAudience } from '../services/notify.service.js';

export const COURSE_STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'published', 'unpublished'];

const isStaff = (u) => ['admin', 'super_admin', 'moderator'].includes(u?.role);

async function uniqueSlug(title, ignoreId = null) {
  const base = slugify(title, { lower: true, strict: true }).slice(0, 60) || 'course';
  let slug = base;
  let i = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = must(await db.from('courses').select('id').eq('slug', slug).limit(1));
    if (!existing.length || (ignoreId && existing[0].id === ignoreId)) return slug;
    slug = `${base}-${++i}`;
  }
}

const COURSE_CARD = 'id, title, slug, subtitle, thumbnail_url, price, is_free, level, language, rating_avg, rating_count, enrollment_count, status, is_featured, category:categories(id,name), instructor:users(id,display_name,avatar_url,is_verified_instructor)';

/** GET /api/courses — public catalog with filters/sort/pagination */
export const listCourses = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  const { category, subcategory, level, language, min_price: minP, max_price: maxP, free, q, sort, instructor } = req.query;
  let query = db.from('courses').select(COURSE_CARD, { count: 'exact' }).eq('status', 'published');
  if (category) query = query.eq('category_id', category);
  if (subcategory) query = query.eq('subcategory_id', subcategory);
  if (level) query = query.eq('level', level);
  if (language) query = query.eq('language', language);
  if (instructor) query = query.eq('instructor_id', instructor);
  if (free === 'true') query = query.eq('is_free', true);
  if (minP != null) query = query.gte('price', Number(minP));
  if (maxP != null) query = query.lte('price', Number(maxP));
  if (q) query = query.or(`title.ilike.%${q}%,subtitle.ilike.%${q}%`);
  const sortMap = {
    newest: ['created_at', false], popular: ['enrollment_count', false],
    rating: ['rating_avg', false], price_low: ['price', true], price_high: ['price', false],
  };
  const [col, asc] = sortMap[sort] || ['created_at', false];
  query = query.order(col, { ascending: asc });
  const { data, count } = await query.range(offset, offset + limit - 1);
  res.json({ courses: data || [], total: count, page, limit, pages: Math.ceil((count || 0) / limit) });
});

/** GET /api/courses/instructor — current instructor's courses (all statuses) */
export const myCourses = asyncHandler(async (req, res) => {
  const rows = must(await db.from('courses').select(COURSE_CARD).eq('instructor_id', req.user.id).order('updated_at', { ascending: false }));
  res.json({ courses: rows });
});

/** GET /api/courses/:slug — detail page (published, or owner/staff preview). Also accepts a course id. */
export const getCourse = asyncHandler(async (req, res) => {
  const key = req.params.slug;
  const rows = must(await db.from('courses').select('*, category:categories(*), subcategory:categories(*), instructor:users(id,display_name,username,avatar_url,bio,website,is_verified_instructor,instructor_tier)')
    .or(`slug.eq.${key},id.eq.${key}`).limit(1));
  const course = rows[0];
  if (!course) throw HttpError.notFound('Course not found');
  const owner = req.user && (req.user.id === course.instructor_id || isStaff(req.user));
  if (course.status !== 'published' && !owner) throw HttpError.notFound('Course not found');

  const sections = must(await db.from('sections').select('id,title,position,lessons(id,title,type,position,duration_seconds,is_preview,prerequisite_lesson_id)').eq('course_id', course.id).order('position').order('position', { foreignTable: 'lessons', ascending: true }));
  let enrolled = false;
  if (req.user) {
    const e = must(await db.from('enrollments').select('id').eq('course_id', course.id).eq('user_id', req.user.id).limit(1));
    enrolled = e.length > 0;
  }
  if (!owner && !enrolled) {
    // hide non-preview lesson content from non-enrolled users
    for (const s of sections) s.lessons = s.lessons.filter((l) => l.is_preview);
  }
  res.json({ course: { ...course, sections }, enrolled, canManage: owner });
});

/** POST /api/courses — instructor creates a draft */
export const createCourse = asyncHandler(async (req, res) => {
  const data = validate({
    title: 'required|string|min:3|max:160',
    subtitle: 'string|max:250',
    description: 'string',
    category_id: 'uuid',
    subcategory_id: 'uuid',
    level: 'string|in:Beginner,Intermediate,Advanced,All Levels',
    language: 'string|max:30',
    price: 'number|min:0',
    is_free: 'bool',
  }, req.body);
  const slug = await uniqueSlug(data.title);
  const course = await insertOne('courses', {
    instructor_id: req.user.id,
    slug,
    status: 'draft',
    level: 'All Levels',
    language: 'English',
    price: 0,
    is_free: false,
    currency: 'usd',
    ...data,
    tags: req.body.tags || [],
    learning_objectives: req.body.learning_objectives || [],
    requirements: req.body.requirements || [],
  });
  res.status(201).json({ course });
});

/** Helper: assert current user can edit this course */
async function assertCanEdit(req, courseId) {
  const course = await byId('courses', courseId);
  if (!course) throw HttpError.notFound('Course not found');
  if (course.instructor_id !== req.user.id && !isStaff(req.user)) throw HttpError.forbidden('Not your course');
  return course;
}

/** PATCH /api/courses/:id */
export const updateCourse = asyncHandler(async (req, res) => {
  const course = await assertCanEdit(req, req.params.id);
  const allowed = ['title', 'subtitle', 'description', 'category_id', 'subcategory_id', 'level', 'language', 'price', 'is_free', 'thumbnail_url', 'thumbnail_path', 'intro_video_url', 'intro_video_path', 'tags', 'learning_objectives', 'requirements', 'target_audience', 'seo_title', 'seo_description', 'caption_language', 'access_type', 'access_expires_days', 'certificate_template'];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
  if (patch.price != null && patch.price > 0) patch.is_free = false;
  if (patch.is_free) patch.price = 0;
  if (patch.title && patch.title !== course.title) patch.slug = await uniqueSlug(patch.title, course.id);
  const updated = await updateOne('courses', course.id, patch);
  res.json({ course: updated });
});

/** POST /api/courses/:id/submit — send for review */
export const submitForReview = asyncHandler(async (req, res) => {
  const course = await assertCanEdit(req, req.params.id);
  if (!course.category_id) throw HttpError.unprocessable('Add a category before submitting', { category_id: 'required' });
  const sections = must(await db.from('sections').select('id').eq('course_id', course.id).limit(1));
  if (!sections.length) throw HttpError.unprocessable('Add at least one section/lesson before submitting', { curriculum: 'required' });
  const updated = await updateOne('courses', course.id, { status: 'submitted', submitted_at: new Date().toISOString(), rejection_reason: null });
  await audit({ actorId: req.user.id, action: 'course.submit', entityType: 'course', entityId: course.id });
  res.json({ course: updated });
});

/** POST /api/courses/:id/publish (instructor, only if already approved) */
export const publishCourse = asyncHandler(async (req, res) => {
  const course = await assertCanEdit(req, req.params.id);
  if (!['approved', 'unpublished'].includes(course.status) && !isStaff(req.user)) {
    throw HttpError.forbidden('Course must be approved before publishing');
  }
  const final = await updateOne('courses', course.id, { status: req.body.unpublish ? 'unpublished' : 'published', published_at: req.body.unpublish ? course.published_at : (course.published_at || new Date().toISOString()) });
  res.json({ course: final });
});

/** POST /api/courses/:id/clone — duplicate a course as a new draft */
export const cloneCourse = asyncHandler(async (req, res) => {
  const course = await assertCanEdit(req, req.params.id);
  const slug = await uniqueSlug(`${course.title} (copy)`);
  const copy = await insertOne('courses', {
    ...course,
    id: undefined, created_at: undefined, updated_at: undefined,
    title: `${course.title} (copy)`, slug, status: 'draft',
    enrollment_count: 0, rating_avg: 0, rating_count: 0, review_count: 0,
  });
  const sections = must(await db.from('sections').select('*').eq('course_id', course.id));
  for (const s of sections) {
    const lessons = must(await db.from('lessons').select('*').eq('section_id', s.id));
    const ns = await insertOne('sections', { ...s, id: undefined, course_id: copy.id, created_at: undefined, updated_at: undefined });
    for (const l of lessons) await insertOne('lessons', { ...l, id: undefined, section_id: ns.id, course_id: copy.id, created_at: undefined, updated_at: undefined });
  }
  res.status(201).json({ course: copy });
});

/** DELETE /api/courses/:id */
export const deleteCourse = asyncHandler(async (req, res) => {
  const course = await assertCanEdit(req, req.params.id);
  await deleteOne('courses', course.id);
  await audit({ actorId: req.user.id, action: 'course.delete', entityType: 'course', entityId: course.id });
  res.json({ deleted: true });
});

/* ── Moderation (staff) ──────────────────────────────────── */

/** GET /api/courses/moderation/queue */
export const moderationQueue = asyncHandler(async (req, res) => {
  const { limit, offset } = pagination(req.query, { defaultLimit: 25 });
  const status = req.query.status || 'submitted';
  const rows = must(await db.from('courses').select(`${COURSE_CARD}, instructor:users(id,display_name,email)`)
    .eq('status', status).order('submitted_at', { ascending: true }).range(offset, offset + limit - 1));
  res.json({ courses: rows });
});

/** POST /api/courses/:id/moderate — { decision: approve|reject, reason } */
export const moderateCourse = asyncHandler(async (req, res) => {
  const { decision, reason } = validate({ decision: 'required|string|in:approve,reject', reason: 'string|max:1000' }, req.body);
  const course = await byId('courses', req.params.id);
  if (!course) throw HttpError.notFound('Course not found');
  const status = decision === 'approve' ? 'approved' : 'rejected';
  const updated = await updateOne('courses', course.id, { status, rejection_reason: decision === 'reject' ? reason : null, reviewed_at: new Date().toISOString(), reviewed_by: req.user.id });
  await audit({ actorId: req.user.id, actorEmail: req.user.email, action: `course.${decision}`, entityType: 'course', entityId: course.id, metadata: { reason } });
  const { notify } = await import('../services/notify.service.js');
  await notify({
    userId: course.instructor_id,
    type: 'course_moderation',
    title: decision === 'approve' ? 'Your course was approved 🎉' : 'Your course needs changes',
    body: decision === 'approve' ? `${course.title} is approved and ready to publish.` : (reason || 'See feedback in your dashboard.'),
    link: `/instructor/courses/${course.id}`,
  });
  res.json({ course: updated });
});

/** PATCH /api/courses/:id/feature — admin toggles featured/sponsored */
export const togglePromotion = asyncHandler(async (req, res) => {
  const course = await byId('courses', req.params.id);
  if (!course) throw HttpError.notFound('Course not found');
  const updated = await updateOne('courses', course.id, {
    is_featured: req.body.is_featured ?? course.is_featured,
    is_sponsored: req.body.is_sponsored ?? course.is_sponsored,
  });
  await audit({ actorId: req.user.id, action: 'course.promotion', entityType: 'course', entityId: course.id, metadata: req.body });
  res.json({ course: updated });
});

/** POST /api/courses/:id/announce — instructor posts a course announcement */
export const createAnnouncement = asyncHandler(async (req, res) => {
  const course = await assertCanEdit(req, req.params.id);
  const { title, body } = validate({ title: 'required|string|max:160', body: 'required|string|max:4000' }, req.body);
  const ann = await insertOne('course_announcements', { course_id: course.id, author_id: req.user.id, title, body });
  await notifyCourseAudience(course.id, { type: 'course_announcement', title, body, link: `/learn/${course.slug}`, emailTemplate: 'announcement', emailData: { title, body } });
  res.status(201).json({ announcement: ann });
});

export { assertCanEdit, isStaff };

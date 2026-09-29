import { db, must, byId, insertOne, updateOne, deleteOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { validate, pagination } from '../utils/validate.js';
import { chat, AI_SYSTEM } from '../lib/openRouter.js';
import { notify } from '../services/notify.service.js';

const isStaff = (u) => ['admin', 'super_admin', 'moderator'].includes(u?.role);

async function recalcRating(courseId) {
  const reviews = must(await db.from('reviews').select('rating,helpful_count').eq('course_id', courseId).eq('is_hidden', false));
  const n = reviews.length;
  const avg = n ? reviews.reduce((a, r) => a + r.rating, 0) / n : 0;
  await updateOne('courses', courseId, { rating_avg: Math.round(avg * 10) / 10, rating_count: n, review_count: n });
  const course = await byId('courses', courseId);
  if (course) {
    const all = must(await db.from('reviews').select('rating').in('course_id', must(await db.from('courses').select('id').eq('instructor_id', course.instructor_id)).map((c) => c.id)));
    const iAvg = all.length ? all.reduce((a, r) => a + r.rating, 0) / all.length : 0;
    await updateOne('users', course.instructor_id, { instructor_rating: Math.round(iAvg * 10) / 10 });
  }
}

/** POST /api/courses/:courseId/reviews — student posts a review (must be enrolled) */
export const createReview = asyncHandler(async (req, res) => {
  const courseId = req.params.courseId;
  const { rating, body } = validate({ rating: 'required|number|min:1|max:5', body: 'string|max:4000' }, req.body);
  const enr = must(await db.from('enrollments').select('id').eq('user_id', req.user.id).eq('course_id', courseId).limit(1));
  if (!enr.length) throw HttpError.forbidden('Only enrolled students can review');
  const existing = must(await db.from('reviews').select('id').eq('course_id', courseId).eq('user_id', req.user.id).limit(1));
  if (existing.length) throw HttpError.conflict('You already reviewed this course');
  const review = await insertOne('reviews', { course_id: courseId, user_id: req.user.id, rating, body, is_verified: true });
  await recalcRating(courseId);
  const course = await byId('courses', courseId);
  await notify({ userId: course.instructor_id, type: 'new_review', title: 'New review', body: `${req.user.display_name} left a ${rating}★ review`, link: `/instructor/courses/${courseId}`, emailTemplate: 'courseReviewed', emailData: { courseTitle: course.title, rating } });
  res.status(201).json({ review });
});

/** PATCH /api/reviews/:id */
export const updateReview = asyncHandler(async (req, res) => {
  const review = await byId('reviews', req.params.id);
  if (!review) throw HttpError.notFound('Review not found');
  if (review.user_id !== req.user.id && !isStaff(req.user)) throw HttpError.forbidden();
  const patch = {};
  if ('rating' in req.body) patch.rating = Math.max(1, Math.min(5, Number(req.body.rating)));
  if ('body' in req.body) patch.body = req.body.body;
  const updated = await updateOne('reviews', review.id, patch);
  await recalcRating(review.course_id);
  res.json({ review: updated });
});

/** DELETE /api/reviews/:id */
export const deleteReview = asyncHandler(async (req, res) => {
  const review = await byId('reviews', req.params.id);
  if (!review) throw HttpError.notFound('Review not found');
  if (review.user_id !== req.user.id && !isStaff(req.user)) throw HttpError.forbidden();
  await deleteOne('reviews', review.id);
  await recalcRating(review.course_id);
  res.json({ deleted: true });
});

/** POST /api/reviews/:id/helpful — upvote */
export const markHelpful = asyncHandler(async (req, res) => {
  const review = await byId('reviews', req.params.id);
  if (!review) throw HttpError.notFound('Review not found');
  const vote = must(await db.from('review_votes').select('*').eq('review_id', review.id).eq('user_id', req.user.id).limit(1))[0];
  if (vote) { await deleteOne('review_votes', vote.id); await updateOne('reviews', review.id, { helpful_count: Math.max(0, (review.helpful_count || 1) - 1) }); return res.json({ voted: false }); }
  await insertOne('review_votes', { review_id: review.id, user_id: req.user.id });
  await updateOne('reviews', review.id, { helpful_count: (review.helpful_count || 0) + 1 });
  res.json({ voted: true });
});

/** POST /api/reviews/:id/respond — instructor replies */
export const respondReview = asyncHandler(async (req, res) => {
  const review = await byId('reviews', req.params.id);
  const course = await byId('courses', review.course_id);
  if (course.instructor_id !== req.user.id && !isStaff(req.user)) throw HttpError.forbidden();
  const updated = await updateOne('reviews', review.id, { instructor_response: req.body.response, responded_at: new Date().toISOString() });
  await notify({ userId: review.user_id, type: 'review_response', title: 'Instructor replied to your review', body: req.body.response });
  res.json({ review: updated });
});

/** POST /api/reviews/:id/report — flag abusive review to moderator queue */
export const reportReview = asyncHandler(async (req, res) => {
  const review = await byId('reviews', req.params.id);
  if (!review) throw HttpError.notFound('Review not found');
  await insertOne('flags', { entity_type: 'review', entity_id: review.id, reporter_id: req.user.id, reason: req.body.reason || 'abusive' });
  await updateOne('reviews', review.id, { reported: true });
  res.status(201).json({ flagged: true });
});

/** GET /api/courses/:courseId/reviews — public, with filters */
export const courseReviews = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query, { defaultLimit: 10 });
  let q = db.from('reviews').select('*, user:users(id,display_name,avatar_url)', { count: 'exact' }).eq('course_id', req.params.courseId).eq('is_hidden', false);
  if (req.query.star) q = q.eq('rating', Number(req.query.star));
  if (req.query.verified === 'true') q = q.eq('is_verified', true);
  const sort = req.query.sort === 'helpful' ? 'helpful_count' : 'created_at';
  const { data, count } = await q.order(sort, { ascending: false }).range(offset, offset + limit - 1);
  const buckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const all = must(await db.from('reviews').select('rating').eq('course_id', req.params.courseId).eq('is_hidden', false));
  for (const r of all) buckets[r.rating] = (buckets[r.rating] || 0) + 1;
  res.json({ reviews: data || [], total: count, page, limit, breakdown: buckets });
});

/** GET /api/courses/:courseId/reviews/ai-summary — cached AI summary */
export const aiReviewSummary = asyncHandler(async (req, res) => {
  const courseId = req.params.courseId;
  const cached = must(await db.from('review_summaries').select('*').eq('course_id', courseId).limit(1))[0];
  if (cached && !req.query.refresh) return res.json({ summary: cached });
  const reviews = must(await db.from('reviews').select('rating,body').eq('course_id', courseId).eq('is_hidden', false).limit(200));
  if (!reviews.length) return res.json({ summary: null });
  const { json } = await chat({
    feature: 'review_summary', response: 'json', courseId, userId: req.user?.id,
    system: AI_SYSTEM.REVIEW_SUMMARY,
    messages: [{ role: 'user', content: JSON.stringify(reviews.map((r) => ({ stars: r.rating, text: r.body }))) }],
  });
  const row = await db.from('review_summaries').upsert({ course_id: courseId, summary: json.summary, sentiment: json.sentiment, top_praises: json.top_praises, top_complaints: json.top_complaints }, { onConflict: 'course_id' }).select().single();
  res.json({ summary: row.data });
});

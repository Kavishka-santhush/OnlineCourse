import { db, must, insertOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { chat, AI_SYSTEM } from '../lib/openRouter.js';

const CARD = 'id,title,slug,subtitle,thumbnail_url,price,is_free,level,rating_avg,category:categories(id,name),instructor:users(id,display_name)';

/** GET /api/ai/recommendations — personalised for the current learner */
export const recommend = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const [enrolled, wishlist, viewed] = [
    must(await db.from('enrollments').select('course:courses(id,title,category_id)').eq('user_id', userId).limit(20)),
    must(await db.from('wishlist').select('course:courses(id,title,category_id)').eq('user_id', userId).limit(20)),
    must(await db.from('recently_viewed').select('course:courses(id,title,category_id)').eq('user_id', userId).order('viewed_at', { ascending: false }).limit(20)),
  ];
  const enrolledIds = new Set([...enrolled, ...wishlist, ...viewed].map((r) => r.course?.id).filter(Boolean));
  const profile = {
    enrolled: enrolled.map((r) => r.course?.title).filter(Boolean),
    wishlist: wishlist.map((r) => r.course?.title).filter(Boolean),
    viewed: viewed.map((r) => r.course?.title).filter(Boolean),
  };
  const candidates = must(await db.from('courses').select(`${CARD}, category_id`).eq('status', 'published').limit(60));
  const catalog = candidates.filter((c) => !enrolledIds.has(c.id)).map((c) => ({ id: c.id, title: c.title, category: c.category?.name, level: c.level, rating: c.rating_avg }));
  try {
    const { json } = await chat({
      feature: 'recommendations', response: 'json', userId, system: AI_SYSTEM.RECOMMEND,
      messages: [{ role: 'user', content: JSON.stringify({ learner_profile: profile, available_courses: catalog }) }],
    });
    const ids = json.recommended_course_ids || [];
    const byId = Object.fromEntries(candidates.map((c) => [c.id, c]));
    const courses = ids.map((id) => byId[id]).filter(Boolean);
    res.json({ courses, reasoning: json.reasoning, fallback: false });
  } catch {
    // deterministic fallback — most-rated courses not already enrolled
    const courses = candidates.filter((c) => !enrolledIds.has(c.id)).sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0)).slice(0, 8);
    res.json({ courses, reasoning: 'Popular highly-rated courses in your areas of interest.', fallback: true });
  }
});

/** POST /api/ai/tutor — { course_id, question, history:[{role,content}] } */
export const tutor = asyncHandler(async (req, res) => {
  const { course_id: courseId, question, history = [] } = req.body;
  if (!question) throw HttpError.badRequest('question required');
  const course = must(await db.from('courses').select('id,title').eq('id', courseId).limit(1))[0];
  if (!course) throw HttpError.notFound('Course not found');
  // Build context from lesson titles + article content (bounded)
  const lessons = must(await db.from('lessons').select('title,content,type').eq('course_id', courseId).limit(40));
  const context = lessons.map((l) => `## ${l.title}\n${l.type === 'article' ? String(l.content || '').slice(0, 800) : ''}`).join('\n').slice(0, 16000);
  const { text } = await chat({
    feature: 'ai_tutor', userId: req.user.id, courseId,
    system: AI_SYSTEM.TUTOR(course.title, context),
    messages: [...history.slice(-6).map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })), { role: 'user', content: question }],
  });
  await insertOne('ai_chat_messages', { user_id: req.user.id, course_id: courseId, role: 'user', content: question });
  await insertOne('ai_chat_messages', { user_id: req.user.id, course_id: courseId, role: 'assistant', content: text });
  res.json({ answer: text });
});

/** POST /api/ai/summarize — { text } or { lesson_id } */
export const summarize = asyncHandler(async (req, res) => {
  let text = req.body.text;
  if (req.body.lesson_id) {
    const lesson = must(await db.from('lessons').select('title,content').eq('id', req.body.lesson_id).limit(1))[0];
    text = `${lesson?.title || ''}\n${lesson?.content || ''}`;
  }
  if (!text) throw HttpError.badRequest('Provide text or lesson_id');
  const { json } = await chat({ feature: 'summarize', response: 'json', userId: req.user.id, system: AI_SYSTEM.SUMMARY, messages: [{ role: 'user', content: String(text).slice(0, 16000) }] });
  res.json({ summary: json.summary, key_points: json.key_points || [] });
});

/** POST /api/ai/learning-path — { goal } */
export const learningPath = asyncHandler(async (req, res) => {
  const { goal } = req.body;
  if (!goal) throw HttpError.badRequest('goal required');
  const { json } = await chat({ feature: 'learning_path', response: 'json', userId: req.user.id, system: AI_SYSTEM.LEARNING_PATH, messages: [{ role: 'user', content: `Career goal: ${goal}` }] });
  res.json(json);
});

/** POST /api/ai/description — instructor draft generator { title, topic, notes } */
export const generateDescription = asyncHandler(async (req, res) => {
  const { title, topic, notes } = req.body;
  if (!title && !topic) throw HttpError.badRequest('Provide title or topic');
  const { json } = await chat({
    feature: 'description_gen', response: 'json', userId: req.user.id, system: AI_SYSTEM.DESCRIPTION,
    messages: [{ role: 'user', content: `Course title: ${title}\nTopic: ${topic || title}\nExtra notes: ${notes || ''}` }],
  });
  res.json(json);
});

/** POST /api/ai/caption-suggestion — flag lessons that likely need captions */
export const captionAudit = asyncHandler(async (req, res) => {
  const courseId = req.body.course_id;
  const lessons = must(await db.from('lessons').select('id,title,type,captions,duration_seconds').eq('course_id', courseId).eq('type', 'video'));
  const needs = lessons.filter((l) => !l.captions || !(l.captions?.tracks?.length));
  res.json({ total: lessons.length, needCaptions: needs, coverage: lessons.length ? Math.round(((lessons.length - needs.length) / lessons.length) * 100) : 100 });
});

/** POST /api/recently-viewed/:courseId — track a view for recommendations */
export const trackView = asyncHandler(async (req, res) => {
  if (!req.user) return res.json({ ok: false });
  await db.from('recently_viewed').upsert({ user_id: req.user.id, course_id: req.params.courseId, viewed_at: new Date().toISOString() }, { onConflict: 'user_id,course_id' });
  res.json({ ok: true });
});

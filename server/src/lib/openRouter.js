import OpenAI from 'openai';
import { env } from '../config/env.js';
import { db } from './supabase.js';

/**
 * OpenRouter client (OpenAI-compatible) used for every AI feature.
 * All calls are logged to the `ai_usage` table for Super Admin monitoring.
 */
export const openRouter = new OpenAI({
  apiKey: env.openRouter.apiKey,
  baseURL: env.openRouter.baseUrl,
  defaultHeaders: {
    'HTTP-Referer': env.frontendUrl,
    'X-Title': 'CourseMarket',
  },
});

/**
 * @param {object} opts
 * @param {string} opts.feature logical feature key (recommendations, quiz_gen, ...)
 * @param {Array<{role:string,content:string}>} opts.messages
 * @param {string} [opts.system] system prompt
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @param {'json'|'text'} [opts.response] force JSON output parsing
 * @param {string|null} [opts.userId] Clerk user id for usage attribution
 * @param {string|null} [opts.courseId]
 */
export async function chat({
  feature,
  messages,
  system,
  temperature = 0.4,
  maxTokens = 1600,
  response = 'text',
  userId = null,
  courseId = null,
}) {
  const started = Date.now();
  const payload = {
    model: env.openRouter.model,
    temperature,
    max_tokens: maxTokens,
    messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
  };
  if (response === 'json') payload.response_format = { type: 'json_object' };

  const completion = await openRouter.chat.completions.create(payload);
  const raw = completion.choices?.[0]?.message?.content ?? '';
  const usage = completion.usage || {};

  // Fire-and-forget usage logging — never blocks the AI response.
  db.from('ai_usage')
    .insert({
      feature,
      user_id: userId,
      course_id: courseId,
      model: completion.model || env.openRouter.model,
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
      latency_ms: Date.now() - started,
      success: true,
    })
    .then(({ error }) => error && console.error('[ai_usage] log failed', error.message))
    .catch(() => {});

  if (response === 'json') {
    try {
      return { text: raw, json: JSON.parse(raw) };
    } catch {
      // tolerate fenced code blocks around JSON
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) return { text: raw, json: JSON.parse(match[1]) };
      throw Object.assign(new Error('AI returned invalid JSON'), { status: 502 });
    }
  }
  return { text: raw, json: null };
}

export const AI_SYSTEM = {
  TUTOR: (courseTitle, context) =>
    `You are an AI tutor for the course "${courseTitle}". Answer ONLY using the provided course material context. ` +
    `If the answer is not covered, say so and suggest which lesson to review. Be concise, encouraging and use examples.\n\n` +
    `COURSE MATERIAL CONTEXT:\n${context}`,
  QUIZ:
    'You are an expert instructional designer. Generate high quality quiz questions. Respond ONLY with a JSON object: ' +
    '{"questions":[{"type":"multiple_choice|true_false|multiple_select|short_answer|code",' +
    '"prompt":string,"options":string[],"correct_answers":number[] or strings,"explanation":string,"difficulty":"easy|medium|hard"}]}',
  RECOMMEND:
    'You are a course recommendation engine. Given a learner profile and a catalogue of courses, return the best matches. ' +
    'Respond ONLY with JSON: {"recommended_course_ids":string[],"reasoning":string}',
  SUMMARY:
    'You summarise educational content into crisp key takeaways. Respond ONLY with JSON: {"summary":string,"key_points":string[]}',
  REVIEW_SUMMARY:
    'You analyse student course reviews. Respond ONLY with JSON: {"summary":string,"sentiment":{"positive":number,"neutral":number,"negative":number},"top_praises":string[],"top_complaints":string[]}',
  LEARNING_PATH:
    'You build learning paths from career goals. Respond ONLY with JSON: {"path":[{"step":number,"title":string,"description":string,"skills":string[]}],"advice":string}',
  DESCRIPTION:
    'You write compelling, SEO-friendly course copy. Respond ONLY with JSON: {"subtitle":string,"description_html":string,"objectives":string[],"requirements":string[],"target_audience":string,"tags":string[],"seo_title":string,"seo_description":string}',
  FEEDBACK:
    'You help instructors write structured, constructive assignment feedback. Respond with plain, well-structured text addressed to the student.',
  SEARCH:
    'You expand a course search query for semantic search. Respond ONLY with JSON: {"expanded_query":string,"keywords":string[],"suggested_category":string|null}',
};

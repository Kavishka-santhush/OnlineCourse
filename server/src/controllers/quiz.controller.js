import { db, must, byId, insertOne, updateOne, deleteOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { validate } from '../utils/validate.js';
import { assertCanEdit } from './course.controller.js';
import { recalcProgress } from './enrollment.controller.js';
import { chat, AI_SYSTEM } from '../lib/openRouter.js';

const isStaff = (u) => ['admin', 'super_admin', 'moderator'].includes(u?.role);

async function ownQuiz(req, quizId) {
  const quiz = await byId('quizzes', quizId);
  if (!quiz) throw HttpError.notFound('Quiz not found');
  if (quiz.instructor_id !== req.user.id && !isStaff(req.user)) throw HttpError.forbidden('Not your quiz');
  return quiz;
}

/** GET /api/quizzes/:id — full quiz (questions hidden answers for students) */
export const getQuiz = asyncHandler(async (req, res) => {
  const quiz = await byId('quizzes', req.params.id, '*, questions:quiz_questions(*)');
  if (!quiz) throw HttpError.notFound('Quiz not found');
  const isOwner = req.user && (quiz.instructor_id === req.user.id || isStaff(req.user));
  if (!isOwner) {
    quiz.questions = (quiz.questions || []).map((q) => ({ ...q, correct_answers: undefined, explanation: undefined }));
  }
  res.json({ quiz });
});

/** POST /api/quizzes — create quiz (optionally attached to a lesson) */
export const createQuiz = asyncHandler(async (req, res) => {
  const data = validate({
    title: 'required|string|max:160',
    lesson_id: 'uuid',
    course_id: 'uuid',
    time_limit_minutes: 'number|min:0',
    max_attempts: 'number|min:0',
    passing_score: 'number|min:0|max:100',
    shuffle_questions: 'bool',
    show_answers_after: 'bool',
  }, req.body);
  if (data.course_id) await assertCanEdit(req, data.course_id);
  const quiz = await insertOne('quizzes', {
    instructor_id: req.user.id,
    time_limit_minutes: 0, max_attempts: 0, passing_score: 70,
    shuffle_questions: false, show_answers_after: true,
    ...data,
  });
  res.status(201).json({ quiz });
});

/** PATCH /api/quizzes/:id */
export const updateQuiz = asyncHandler(async (req, res) => {
  const quiz = await ownQuiz(req, req.params.id);
  const allowed = ['title', 'time_limit_minutes', 'max_attempts', 'passing_score', 'shuffle_questions', 'randomize_options', 'show_answers_after', 'instructions'];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
  res.json({ quiz: await updateOne('quizzes', quiz.id, patch) });
});

/** DELETE /api/quizzes/:id */
export const deleteQuiz = asyncHandler(async (req, res) => {
  const quiz = await ownQuiz(req, req.params.id);
  await deleteOne('quizzes', quiz.id);
  res.json({ deleted: true });
});

/** POST /api/quizzes/:id/questions — add a question */
export const addQuestion = asyncHandler(async (req, res) => {
  const quiz = await ownQuiz(req, req.params.id);
  const data = validate({
    type: 'required|string|in:multiple_choice,true_false,multiple_select,short_answer,code',
    prompt: 'required|string|max:2000',
    options: 'array',
    correct_answers: 'array',
    explanation: 'string|max:2000',
    points: 'number|min:1',
    difficulty: 'string|in:easy,medium,hard',
  }, req.body);
  const { data: last } = await db.from('quiz_questions').select('position').eq('quiz_id', quiz.id).order('position', { ascending: false }).limit(1);
  const question = await insertOne('quiz_questions', {
    quiz_id: quiz.id, position: (last?.[0]?.position ?? 0) + 1, points: 1, difficulty: 'medium',
    options: [], correct_answers: [], ...data,
  });
  res.status(201).json({ question });
});

/** PATCH /api/questions/:id */
export const updateQuestion = asyncHandler(async (req, res) => {
  const q = await byId('quiz_questions', req.params.id);
  if (!q) throw HttpError.notFound('Question not found');
  await ownQuiz(req, q.quiz_id);
  const allowed = ['type', 'prompt', 'options', 'correct_answers', 'explanation', 'points', 'difficulty', 'position'];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
  res.json({ question: await updateOne('quiz_questions', q.id, patch) });
});

/** DELETE /api/questions/:id */
export const deleteQuestion = asyncHandler(async (req, res) => {
  const q = await byId('quiz_questions', req.params.id);
  if (!q) throw HttpError.notFound('Question not found');
  await ownQuiz(req, q.quiz_id);
  await deleteOne('quiz_questions', q.id);
  res.json({ deleted: true });
});

/* ── Question bank ───────────────────────────────────────── */
export const listBank = asyncHandler(async (req, res) => {
  const rows = must(await db.from('question_bank').select('*').eq('instructor_id', req.user.id).order('created_at', { ascending: false }));
  res.json({ questions: rows });
});
export const saveToBank = asyncHandler(async (req, res) => {
  const q = await byId('quiz_questions', req.params.questionId);
  if (!q) throw HttpError.notFound('Question not found');
  await ownQuiz(req, q.quiz_id);
  const row = await insertOne('question_bank', { instructor_id: req.user.id, ...['type', 'prompt', 'options', 'correct_answers', 'explanation', 'difficulty'].reduce((a, k) => ({ ...a, [k]: q[k] }), {}) });
  res.status(201).json({ question: row });
});

/* ── Attempting & grading ────────────────────────────────── */

function autoGrade(question, answer) {
  if (['short_answer', 'code'].includes(question.type)) return null; // manual
  const correct = (question.correct_answers || []).map(String).sort();
  const given = (Array.isArray(answer) ? answer : [answer]).map(String).sort();
  return JSON.stringify(correct) === JSON.stringify(given);
}

/** POST /api/quizzes/:id/attempt/start */
export const startAttempt = asyncHandler(async (req, res) => {
  const quiz = await byId('quizzes', req.params.id, '*, questions:quiz_questions(*)');
  if (!quiz) throw HttpError.notFound('Quiz not found');
  if (quiz.course_id) {
    const enr = must(await db.from('enrollments').select('id').eq('user_id', req.user.id).eq('course_id', quiz.course_id).limit(1));
    if (!enr.length) throw HttpError.forbidden('Enroll to take this quiz');
  }
  const prior = must(await db.from('quiz_attempts').select('*').eq('quiz_id', quiz.id).eq('user_id', req.user.id));
  if (quiz.max_attempts && prior.length >= quiz.max_attempts) throw HttpError.forbidden('Maximum attempts reached');
  const attempt = await insertOne('quiz_attempts', {
    quiz_id: quiz.id, user_id: req.user.id, attempt_number: prior.length + 1,
    status: 'in_progress', started_at: new Date().toISOString(), answers: {},
  });
  const questions = quiz.shuffle_questions ? [...quiz.questions].sort(() => Math.random() - 0.5) : quiz.questions;
  res.status(201).json({ attempt, questions: questions.map((q) => ({ ...q, correct_answers: undefined, explanation: undefined })) });
});

/** POST /api/quizzes/:id/attempt/submit — { attempt_id, answers: {qid: value|array} } */
export const submitAttempt = asyncHandler(async (req, res) => {
  const quiz = await byId('quizzes', req.params.id, '*, questions:quiz_questions(*)');
  const attempt = await byId('quiz_attempts', req.body.attempt_id);
  if (!attempt || attempt.user_id !== req.user.id) throw HttpError.forbidden();
  if (attempt.status === 'submitted') throw HttpError.badRequest('Already submitted');

  const answers = req.body.answers || {};
  let earned = 0;
  let possible = 0;
  const manual = [];
  const breakdown = {};
  for (const q of quiz.questions) {
    possible += q.points || 1;
    const result = autoGrade(q, answers[q.id]);
    breakdown[q.id] = { answer: answers[q.id], auto: result };
    if (result === true) earned += q.points || 1;
    else if (result === null) manual.push(q.id);
  }
  const autoScore = possible ? Math.round((earned / possible) * 100) : 0;
  const needsManual = manual.length > 0;
  const updated = await updateOne('quiz_attempts', attempt.id, {
    status: needsManual ? 'pending_grading' : 'submitted',
    answers,
    auto_score: autoScore,
    score: needsManual ? null : autoScore,
    passed: needsManual ? null : autoScore >= (quiz.passing_score || 70),
    submitted_at: new Date().toISOString(),
    needs_manual_grading: manual,
  });
  if (!needsManual && updated.passed && quiz.lesson_id) {
    await maybeCompleteQuizLesson(req.user.id, quiz);
  }
  res.json({ attempt: updated, summary: { autoScore, possible, passed: updated.passed } });
});

async function maybeCompleteQuizLesson(userId, quiz) {
  const existing = must(await db.from('lesson_progress').select('*').eq('user_id', userId).eq('lesson_id', quiz.lesson_id).limit(1))[0];
  if (existing) await updateOne('lesson_progress', existing.id, { completed: true, completed_at: new Date().toISOString() });
  else await insertOne('lesson_progress', { user_id: userId, course_id: quiz.course_id, lesson_id: quiz.lesson_id, completed: true, completed_at: new Date().toISOString(), watched_seconds: 0, position_seconds: 0 });
  if (quiz.course_id) await recalcProgress(userId, quiz.course_id);
}

/** POST /api/attempts/:id/grade — instructor manual grading { grades: {qid: {score, feedback}}, overall_feedback } */
export const gradeAttempt = asyncHandler(async (req, res) => {
  const attempt = await byId('quiz_attempts', req.params.id);
  if (!attempt) throw HttpError.notFound('Attempt not found');
  const quiz = await byId('quizzes', attempt.quiz_id, '*, questions:quiz_questions(*)');
  if (quiz.instructor_id !== req.user.id && !isStaff(req.user)) throw HttpError.forbidden();

  const grades = req.body.grades || {};
  let total = 0;
  for (const q of quiz.questions) {
    const b = attempt.answers?.[q.id];
    if (grades[q.id]) total += Math.min(q.points || 1, Number(grades[q.id].score) || 0);
    else if (autoGrade(q, Array.isArray(b) ? b.answer : b?.answer) === true) total += q.points || 1;
  }
  const possible = quiz.questions.reduce((a, q) => a + (q.points || 1), 0) || 1;
  const score = Math.round((total / possible) * 100);
  const updated = await updateOne('quiz_attempts', attempt.id, {
    status: 'graded', score, passed: score >= (quiz.passing_score || 70),
    manual_grades: grades, overall_feedback: req.body.overall_feedback || null, graded_at: new Date().toISOString(),
  });
  if (updated.passed && quiz.lesson_id) await maybeCompleteQuizLesson(attempt.user_id, quiz);
  res.json({ attempt: updated });
});

/** GET /api/quizzes/:id/attempts — instructor: list attempts + student answers */
export const quizAttempts = asyncHandler(async (req, res) => {
  const quiz = await ownQuiz(req, req.params.id);
  const rows = must(await db.from('quiz_attempts').select('*, user:users(id,display_name,email)').eq('quiz_id', quiz.id).order('created_at', { ascending: false }));
  res.json({ attempts: rows });
});

/** GET /api/quizzes/me/attempts — student history */
export const myAttempts = asyncHandler(async (req, res) => {
  const rows = must(await db.from('quiz_attempts').select('*, quiz:quizzes(id,title,passing_score,course_id)').eq('user_id', req.user.id).order('created_at', { ascending: false }));
  res.json({ attempts: rows });
});

/* ── AI quiz generator ───────────────────────────────────── */
export const generateQuiz = asyncHandler(async (req, res) => {
  const { source_text, topic, count = 5, quiz_id: quizId } = req.body;
  if (!source_text && !topic) throw HttpError.badRequest('Provide source_text or topic');
  const { json } = await chat({
    feature: 'quiz_gen',
    system: AI_SYSTEM.QUIZ,
    response: 'json',
    userId: req.user.id,
    messages: [{ role: 'user', content: `Generate ${count} quiz questions.\nTOPIC: ${topic || 'from provided material'}\nMATERIAL:\n${(source_text || '').slice(0, 12000)}` }],
  });
  const generated = (json.questions || []).map((q) => ({
    type: ['multiple_choice', 'true_false', 'multiple_select', 'short_answer', 'code'].includes(q.type) ? q.type : 'multiple_choice',
    prompt: q.prompt, options: q.options || [], correct_answers: q.correct_answers || [], explanation: q.explanation || '', points: 1, difficulty: q.difficulty || 'medium',
  }));
  if (quizId) {
    const quiz = await ownQuiz(req, quizId);
    for (const q of generated) await insertOne('quiz_questions', { quiz_id: quiz.id, position: 999, ...q });
  }
  res.json({ questions: generated, saved: Boolean(quizId) });
});

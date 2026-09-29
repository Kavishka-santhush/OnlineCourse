import { db, must, byId, insertOne, updateOne, deleteOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { validate, pagination } from '../utils/validate.js';
import { assertCanEdit } from './course.controller.js';
import { uploadBuffer } from '../lib/storage.js';
import { chat, AI_SYSTEM } from '../lib/openRouter.js';
import { notify } from '../services/notify.service.js';
import { env } from '../config/env.js';

const isStaff = (u) => ['admin', 'super_admin', 'moderator'].includes(u?.role);

async function ownAssignment(req, id) {
  const a = await byId('assignments', id);
  if (!a) throw HttpError.notFound('Assignment not found');
  if (a.instructor_id !== req.user.id && !isStaff(req.user)) throw HttpError.forbidden();
  return a;
}

/** POST /api/assignments — create assignment attached to a lesson/course */
export const createAssignment = asyncHandler(async (req, res) => {
  const data = validate({
    title: 'required|string|max:160',
    course_id: 'required|uuid',
    lesson_id: 'uuid',
    instructions: 'string',
    due_date: 'date',
    max_points: 'number|min:1',
    allow_late: 'bool',
    peer_review: 'bool',
  }, req.body);
  await assertCanEdit(req, data.course_id);
  const assignment = await insertOne('assignments', {
    instructor_id: req.user.id, max_points: 100, allow_late: true, peer_review: false,
    attachments: req.body.attachments || [], rubric: req.body.rubric || [], ...data,
  });
  res.status(201).json({ assignment });
});

/** PATCH /api/assignments/:id */
export const updateAssignment = asyncHandler(async (req, res) => {
  const a = await ownAssignment(req, req.params.id);
  const allowed = ['title', 'instructions', 'due_date', 'max_points', 'allow_late', 'late_penalty_percent', 'peer_review', 'attachments', 'rubric'];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
  res.json({ assignment: await updateOne('assignments', a.id, patch) });
});

/** DELETE /api/assignments/:id */
export const deleteAssignment = asyncHandler(async (req, res) => {
  const a = await ownAssignment(req, req.params.id);
  await deleteOne('assignments', a.id);
  res.json({ deleted: true });
});

/** GET /api/assignments/:id/submissions — instructor view */
export const listSubmissions = asyncHandler(async (req, res) => {
  const a = await ownAssignment(req, req.params.id);
  const rows = must(await db.from('assignment_submissions').select('*, student:users(id,display_name,email)').eq('assignment_id', a.id).order('submitted_at', { ascending: false }));
  res.json({ submissions: rows });
});

/** GET /api/assignments/course/:courseId — student list for a course */
export const courseAssignments = asyncHandler(async (req, res) => {
  const rows = must(await db.from('assignments').select('*, submissions:assignment_submissions(id,user_id,status,score,submitted_at,user_id)').eq('course_id', req.params.courseId));
  const mine = req.user ? rows.map((a) => ({ ...a, my_submission: (a.submissions || []).find((s) => s.user_id === req.user.id) || null })) : rows;
  res.json({ assignments: mine.map(({ submissions, ...a }) => a) });
});

/** POST /api/assignments/:id/submit — student submits (files as base64 or text) */
export const submitAssignment = asyncHandler(async (req, res) => {
  const a = await byId('assignments', req.params.id);
  if (!a) throw HttpError.notFound('Assignment not found');
  const enr = must(await db.from('enrollments').select('id').eq('user_id', req.user.id).eq('course_id', a.course_id).limit(1));
  if (!enr.length) throw HttpError.forbidden('Not enrolled');

  let files = [];
  for (const f of req.body.files || []) {
    const up = await uploadBuffer(env.storage.docs, `submissions/${a.id}/${req.user.id}`, f.name, f.data, f.contentType || 'application/octet-stream');
    files.push({ name: f.name, url: up.url, path: up.path });
  }
  const existing = must(await db.from('assignment_submissions').select('*').eq('assignment_id', a.id).eq('user_id', req.user.id).limit(1))[0];
  const late = a.due_date && new Date() > new Date(a.due_date);
  const payload = {
    assignment_id: a.id, user_id: req.user.id, text_submission: req.body.text || null,
    files, status: late ? 'late' : 'submitted', submitted_at: new Date().toISOString(),
  };
  const submission = existing ? await updateOne('assignment_submissions', existing.id, payload) : await insertOne('assignment_submissions', payload);
  await notify({ userId: a.instructor_id, type: 'assignment_submission', title: 'New submission', body: `${req.user.display_name} submitted "${a.title}"`, link: `/instructor/assignments/${a.id}` });
  res.status(existing ? 200 : 201).json({ submission });
});

/** POST /api/submissions/:id/grade — instructor grades { score, feedback, status } */
export const gradeSubmission = asyncHandler(async (req, res) => {
  const sub = await byId('assignment_submissions', req.params.id);
  if (!sub) throw HttpError.notFound('Submission not found');
  const a = await ownAssignment(req, sub.assignment_id);
  const { score, feedback } = validate({ score: 'required|number|min:0', feedback: 'string|max:4000' }, req.body);
  const updated = await updateOne('assignment_submissions', sub.id, {
    score: Math.min(a.max_points || 100, score), feedback, status: 'graded', graded_at: new Date().toISOString(),
    rubric_scores: req.body.rubric_scores || {},
  });
  await notify({ userId: sub.user_id, type: 'assignment_graded', title: 'Assignment graded', body: `You scored ${updated.score}/${a.max_points} on "${a.title}"`, link: `/learn/${a.course_id}`, emailTemplate: 'assignmentGraded', emailData: { courseTitle: a.title, score: updated.score } });
  res.json({ submission: updated });
});

/** POST /api/submissions/:id/request-resubmit */
export const requestResubmit = asyncHandler(async (req, res) => {
  const sub = await byId('assignment_submissions', req.params.id);
  if (!sub) throw HttpError.notFound('Submission not found');
  await ownAssignment(req, sub.assignment_id);
  const updated = await updateOne('assignment_submissions', sub.id, { status: 'resubmission_requested', feedback: req.body.feedback || null });
  await notify({ userId: sub.user_id, type: 'assignment_resubmit', title: 'Resubmission requested', body: req.body.feedback || 'Please update your submission.' });
  res.json({ submission: updated });
});

/** POST /api/assignments/feedback-assistant — AI drafts structured feedback */
export const aiFeedback = asyncHandler(async (req, res) => {
  const { submission_text, assignment_title, notes } = req.body;
  const { text } = await chat({
    feature: 'assignment_feedback',
    system: AI_SYSTEM.FEEDBACK,
    userId: req.user.id,
    messages: [{ role: 'user', content: `Assignment: ${assignment_title}\nStudent submission:\n${(submission_text || '').slice(0, 8000)}\n\nInstructor notes: ${notes || 'general constructive feedback'}` }],
  });
  res.json({ feedback: text });
});

/** GET /api/assignments/me — student's assignments across courses */
export const myAssignments = asyncHandler(async (req, res) => {
  const { limit, offset } = pagination(req.query, { defaultLimit: 100 });
  const enrolls = must(await db.from('enrollments').select('course_id').eq('user_id', req.user.id).range(0, 999));
  const ids = enrolls.map((e) => e.course_id);
  if (!ids.length) return res.json({ assignments: [] });
  const assignments = must(await db.from('assignments').select('*, submissions:assignment_submissions(id,status,score,submitted_at,user_id)').in('course_id', ids).range(offset, offset + limit - 1));
  res.json({ assignments: assignments.map((a) => ({ ...a, my_submission: (a.submissions || []).find((s) => s.user_id === req.user.id) || null, submissions: undefined })) });
});

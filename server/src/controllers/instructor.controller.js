import { db, must, byId, insertOne, updateOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { validate, pagination } from '../utils/validate.js';
import { audit } from '../utils/audit.js';
import { notify } from '../services/notify.service.js';
import { createExpressAccount, createConnectOnboardingUrl, formatMoney } from '../lib/stripe.js';
import { env } from '../config/env.js';

/**
 * POST /api/instructors/apply — a student applies to become an instructor.
 * Admin reviews & approves in the dashboard.
 */
export const applyInstructor = asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw HttpError.badRequest('Only students can apply');
  const data = validate({
    bio: 'required|string|min:40|max:2000',
    expertise: 'required|array',
    experience: 'string|max:2000',
    sample_content_url: 'string|max:500',
  }, req.body);
  const pending = must(await db.from('instructor_applications').select('id,status').eq('user_id', req.user.id).in('status', ['pending', 'approved']).limit(1));
  if (pending.length) throw HttpError.conflict('You already have an application under review or are approved');
  const app = await insertOne('instructor_applications', { user_id: req.user.id, status: 'pending', ...data });
  const admins = must(await db.from('users').select('id,email,display_name').in('role', ['admin', 'super_admin']));
  for (const a of admins) await notify({ userId: a.id, type: 'instructor_application', title: 'New instructor application', body: `${req.user.display_name} applied to teach`, link: '/admin/applications' });
  res.status(201).json({ application: app });
});

/** GET /api/instructors/apply/status */
export const applicationStatus = asyncHandler(async (req, res) => {
  const app = must(await db.from('instructor_applications').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(1))[0] || null;
  res.json({ application: app, isApproved: req.user.role === 'instructor' || ['admin', 'super_admin', 'moderator'].includes(req.user.role) });
});

/** GET /api/instructors/:id/profile — public instructor page */
export const instructorProfile = asyncHandler(async (req, res) => {
  const user = await byId('users', req.params.id, 'id,display_name,username,avatar_url,bio,website,social_links,is_verified_instructor,instructor_tier,instructor_rating,created_at');
  if (!user || !['instructor', 'admin', 'super_admin'].includes(user.role)) {
    // allow any user with published courses to have a public page
  }
  if (!user) throw HttpError.notFound('Instructor not found');
  const courses = must(await db.from('courses').select('id,title,slug,thumbnail_url,price,is_free,rating_avg,enrollment_count').eq('instructor_id', user.id).eq('status', 'published').order('enrollment_count', { ascending: false }));
  const { count: students } = await db.from('enrollments').select('id', { count: 'exact', head: true }).in('course_id', courses.map((c) => c.id).length ? courses.map((c) => c.id) : ['00000000-0000-0000-0000-000000000000']);
  res.json({ instructor: user, courses, stats: { totalCourses: courses.length, totalStudents: students || 0, avgRating: user.instructor_rating || 0 } });
});

/** GET /api/instructors/me/dashboard */
export const instructorDashboard = asyncHandler(async (req, res) => {
  const id = req.user.id;
  const courses = must(await db.from('courses').select('id,title,slug,status,price,is_free,rating_avg,enrollment_count,created_at').eq('instructor_id', id));
  const courseIds = courses.map((c) => c.id);
  const { count: students } = await db.from('enrollments').select('id', { count: 'exact', head: true }).in('course_id', courseIds.length ? courseIds : ['00000000-0000-0000-0000-000000000000']);
  const earnings = must(await db.from('payouts').select('amount_cents,status').eq('instructor_id', id));
  const sales = must(await db.from('order_items').select('instructor_earnings_cents, created_at, order:orders(status)').in('course_id', courseIds.length ? courseIds : ['00000000-0000-0000-0000-000000000000']));
  const totalEarned = sales.reduce((a, s) => a + (s.instructor_earnings_cents || 0), 0);
  const paidOut = earnings.filter((e) => e.status === 'paid').reduce((a, e) => a + e.amount_cents, 0);
  res.json({
    stats: {
      totalCourses: courses.length,
      publishedCourses: courses.filter((c) => c.status === 'published').length,
      totalStudents: students || 0,
      totalEarnings: totalEarned,
      pendingPayout: Math.max(0, totalEarned - paidOut),
      paidOut,
    },
    courses,
  });
});

/** GET /api/instructors/me/earnings — per-course + monthly revenue series */
export const earnings = asyncHandler(async (req, res) => {
  const id = req.user.id;
  const courseIds = must(await db.from('courses').select('id,title').eq('instructor_id', id));
  const items = must(await db.from('order_items').select('course_id,instructor_earnings_cents,created_at').in('course_id', courseIds.map((c) => c.id).length ? courseIds.map((c) => c.id) : ['00000000-0000-0000-0000-000000000000']));
  const byCourse = {};
  const byMonth = {};
  for (const it of items) {
    byCourse[it.course_id] = (byCourse[it.course_id] || 0) + (it.instructor_earnings_cents || 0);
    const m = String(it.created_at).slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + (it.instructor_earnings_cents || 0);
  }
  res.json({
    perCourse: courseIds.map((c) => ({ course_id: c.id, title: c.title, earnings_cents: byCourse[c.id] || 0 })),
    monthly: Object.entries(byMonth).map(([month, cents]) => ({ month, cents })).sort((a, b) => a.month.localeCompare(b.month)),
  });
});

/** GET /api/instructors/me/payouts */
export const listPayouts = asyncHandler(async (req, res) => {
  const rows = must(await db.from('payouts').select('*').eq('instructor_id', req.user.id).order('created_at', { ascending: false }));
  res.json({ payouts: rows });
});

/** POST /api/instructors/me/payout-request — withdrawal request (min threshold) */
export const requestPayout = asyncHandler(async (req, res) => {
  const settings = await getPlatformSettings();
  const minCents = Number(settings.payout_min_cents || 5000);
  const amount = Number(req.body.amount_cents || 0);
  if (amount < minCents) throw HttpError.badRequest(`Minimum withdrawal is ${formatMoney(minCents)}`);
  const available = await availableBalance(req.user.id);
  if (amount > available) throw HttpError.badRequest(`Only ${formatMoney(available)} available`);
  const payout = await insertOne('payouts', { instructor_id: req.user.id, amount_cents: amount, currency: 'usd', status: 'pending', method: req.body.method || 'bank' });
  await audit({ actorId: req.user.id, action: 'payout.request', entityType: 'payout', entityId: payout.id, metadata: { amount } });
  res.status(201).json({ payout });
});

/** POST /api/instructors/me/stripe-connect — onboard for payouts */
export const setupStripeConnect = asyncHandler(async (req, res) => {
  let user = await byId('users', req.user.id);
  if (!user.stripe_account_id) {
    const account = await createExpressAccount({ email: user.email, metadata: { userId: user.id } });
    user = await updateOne('users', user.id, { stripe_account_id: account.id });
  }
  const url = await createConnectOnboardingUrl(
    user.stripe_account_id,
    `${env.frontendUrl}/instructor/settings?connect=refresh`,
    `${env.frontendUrl}/instructor/settings?connect=success`,
  );
  res.json({ onboardingUrl: url, accountId: user.stripe_account_id });
});

async function getPlatformSettings() {
  const row = await byId('platform_settings', 1, 'settings');
  return row?.settings || {};
}

/** Instructor available balance = earned from paid orders minus payouts already requested/paid */
async function availableBalance(instructorId) {
  const courseIds = must(await db.from('courses').select('id').eq('instructor_id', instructorId)).map((c) => c.id);
  const items = courseIds.length ? must(await db.from('order_items').select('instructor_earnings_cents').in('course_id', courseIds)) : [];
  const earned = items.reduce((a, i) => a + (i.instructor_earnings_cents || 0), 0);
  const payouts = must(await db.from('payouts').select('amount_cents,status').eq('instructor_id', instructorId).in('status', ['pending', 'processing', 'paid']));
  const committed = payouts.reduce((a, p) => a + p.amount_cents, 0);
  return Math.max(0, earned - committed);
}

export { getPlatformSettings, availableBalance };

/* ── Admin: applications & payouts management ────────────── */

export const listApplications = asyncHandler(async (req, res) => {
  const { limit, offset } = pagination(req.query, { defaultLimit: 25 });
  const status = req.query.status || 'pending';
  const rows = must(await db.from('instructor_applications').select('*, user:users(id,display_name,email,avatar_url)').eq('status', status).order('created_at', { ascending: true }).range(offset, offset + limit - 1));
  res.json({ applications: rows });
});

export const decideApplication = asyncHandler(async (req, res) => {
  const { decision, reason } = validate({ decision: 'required|string|in:approve,reject', reason: 'string|max:1000' }, req.body);
  const app = await byId('instructor_applications', req.params.id);
  if (!app) throw HttpError.notFound('Application not found');
  await updateOne('instructor_applications', app.id, { status: decision === 'approve' ? 'approved' : 'rejected', reviewed_by: req.user.id, decision_reason: reason || null });
  if (decision === 'approve') await updateOne('users', app.user_id, { role: 'instructor' });
  const { notify: n } = await import('../services/notify.service.js');
  await n({ userId: app.user_id, type: 'instructor_decision', title: decision === 'approve' ? 'Application approved 🎉' : 'Application declined', body: decision === 'approve' ? 'You can now create courses.' : (reason || 'See your applications.'), emailTemplate: decision === 'approve' ? 'instructorApproved' : null, emailData: { name: 'there' } });
  await audit({ actorId: req.user.id, actorEmail: req.user.email, action: `instructor.${decision}`, entityType: 'instructor_application', entityId: app.id });
  res.json({ ok: true });
});

export const adminListPayouts = asyncHandler(async (req, res) => {
  const rows = must(await db.from('payouts').select('*, instructor:users(id,display_name,email)').in('status', ['pending', 'processing', 'paid', 'failed']).order('created_at', { ascending: false }).limit(200));
  res.json({ payouts: rows });
});

export const decidePayout = asyncHandler(async (req, res) => {
  const { action } = validate({ action: 'required|string|in:approve,pay,reject' }, req.body);
  const payout = await byId('payouts', req.params.id);
  if (!payout) throw HttpError.notFound('Payout not found');
  const instructor = await byId('users', payout.instructor_id);
  let status = payout.status;
  if (action === 'approve') status = 'processing';
  if (action === 'reject') status = 'rejected';
  if (action === 'pay') {
    if (instructor?.stripe_account_id && env.stripe.secretKey && !env.stripe.secretKey.startsWith('your_')) {
      const { stripe } = await import('../lib/stripe.js');
      await stripe.transfers.create({ amount: payout.amount_cents, currency: 'usd', destination: instructor.stripe_account_id });
    }
    status = 'paid';
    await notify({ userId: instructor.id, type: 'payout', title: 'Payout processed 💸', body: `${formatMoney(payout.amount_cents)} has been sent.`, emailTemplate: 'payout', emailData: { name: instructor.display_name, amount: formatMoney(payout.amount_cents) }, email: instructor.email });
  }
  res.json({ payout: await updateOne('payouts', payout.id, { status, processed_by: req.user.id, processed_at: new Date().toISOString() }) });
});

export const setInstructorVerification = asyncHandler(async (req, res) => {
  const user = await updateOne('users', req.params.id, { is_verified_instructor: Boolean(req.body.verified) });
  if (!user) throw HttpError.notFound('User not found');
  await audit({ actorId: req.user.id, action: 'instructor.verification', entityType: 'user', entityId: user.id, metadata: { verified: req.body.verified } });
  res.json({ user });
});

/** Instructor performance analytics */
export const instructorAnalytics = asyncHandler(async (req, res) => {
  const id = req.user.id;
  const courses = must(await db.from('courses').select('id,title,enrollment_count,rating_avg').eq('instructor_id', id));
  const ids = courses.map((c) => c.id);
  const enrollments = ids.length ? must(await db.from('enrollments').select('course_id,progress_percent,status').in('course_id', ids)) : [];
  const completion = {};
  for (const c of courses) {
    const es = enrollments.filter((e) => e.course_id === c.id);
    completion[c.id] = es.length ? Math.round((es.filter((e) => e.status === 'completed').length / es.length) * 100) : 0;
  }
  res.json({ courses: courses.map((c) => ({ ...c, completion_rate: completion[c.id] })) });
});

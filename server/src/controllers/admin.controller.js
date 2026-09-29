import { db, must, byId, insertOne, updateOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { pagination } from '../utils/validate.js';
import { audit } from '../utils/audit.js';
import { renderReportPdf } from '../services/pdf.service.js';
import { uploadBuffer } from '../lib/storage.js';
import { createSignedUrl } from '../lib/storage.js';
import { formatMoney } from '../lib/stripe.js';
import { env } from '../config/env.js';

const headcount = async (table, filter = {}) => {
  let q = db.from(table).select('id', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { count } = await q;
  return count || 0;
};

/** GET /api/admin/dashboard — headline stats + time series for charts */
export const dashboard = asyncHandler(async (req, res) => {
  const [users, instructors, students, courses, published, enrollments, orders] = await Promise.all([
    headcount('users'),
    headcount('users', { role: 'instructor' }),
    headcount('users', { role: 'student' }),
    headcount('courses'),
    headcount('courses', { status: 'published' }),
    headcount('enrollments'),
    db.from('orders').select('total_cents,commission_cents,created_at,status').in('status', ['paid', 'refunded']),
  ]);
  const paid = (orders.data || []).filter((o) => o.status === 'paid');
  const revenueCents = paid.reduce((a, o) => a + o.total_cents, 0);
  const commissionCents = paid.reduce((a, o) => a + (o.commission_cents || Math.round(o.total_cents * ((o.commission_percent ?? 20) / 100))), 0);
  const byMonth = {};
  for (const o of paid) {
    const m = String(o.created_at).slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + o.total_cents;
  }
  res.json({
    stats: {
      users, instructors, students, courses, published, enrollments,
      revenue_cents: revenueCents,
      commission_cents: commissionCents,
      instructor_payouts_cents: revenueCents - commissionCents,
    },
    revenueSeries: Object.entries(byMonth).map(([month, cents]) => ({ month, cents })).sort((a, b) => a.month.localeCompare(b.month)),
  });
});

/** GET /api/admin/flags — flagged content queue */
export const listFlags = asyncHandler(async (req, res) => {
  const { limit, offset } = pagination(req.query, { defaultLimit: 50 });
  const status = req.query.status || 'open';
  const rows = must(await db.from('flags').select('*, reporter:users(id,display_name)').eq('status', status).order('created_at', { ascending: false }).range(offset, offset + limit - 1));
  res.json({ flags: rows });
});

/** POST /api/admin/flags/:id/resolve — { action: dismiss|remove_content|warn_user } */
export const resolveFlag = asyncHandler(async (req, res) => {
  const flag = await byId('flags', req.params.id);
  if (!flag) throw HttpError.notFound('Flag not found');
  const action = req.body.action || 'dismiss';
  if (action === 'remove_content') {
    const table = flag.entity_type === 'review' ? 'reviews' : flag.entity_type === 'question' ? 'qa_threads' : null;
    if (table) await updateOne(table, flag.entity_id, { is_hidden: true });
  }
  await updateOne('flags', flag.id, { status: 'resolved', resolved_by: req.user.id, resolution: action, resolved_at: new Date().toISOString() });
  await audit({ actorId: req.user.id, action: `flag.${action}`, entityType: flag.entity_type, entityId: flag.entity_id });
  res.json({ ok: true });
});

/** GET /api/admin/refunds — pending refund requests */
export const listRefunds = asyncHandler(async (req, res) => {
  const rows = must(await db.from('refund_requests').select('*, user:users(id,display_name,email), order:orders(total_cents,payment_intent_id)').eq('status', 'pending').order('created_at').limit(200));
  res.json({ refunds: rows });
});

/** POST /api/admin/refunds/:id/decide — { approve:bool } */
export const decideRefund = asyncHandler(async (req, res) => {
  const refund = await byId('refund_requests', req.params.id);
  if (!refund) throw HttpError.notFound('Refund not found');
  const approve = Boolean(req.body.approve);
  if (approve) {
    if (env.stripe.secretKey && !env.stripe.secretKey.startsWith('your_') && refund.order?.payment_intent_id) {
      const { stripe } = await import('../lib/stripe.js');
      await stripe.refunds.create({ payment_intent: refund.order.payment_intent_id, amount: refund.amount_cents });
    }
    // revoke access
    const order = await byId('orders', refund.order_id);
    if (order) {
      const enrolls = must(await db.from('enrollments').select('id').eq('user_id', order.user_id).in('course_id', (order.items || []).map((i) => i.course_id)));
      for (const e of enrolls) await updateOne('enrollments', e.id, { status: 'revoked' });
      await updateOne('orders', order.id, { status: 'refunded' });
    }
  }
  await updateOne('refund_requests', refund.id, { status: approve ? 'approved' : 'declined', resolved_by: req.user.id, resolved_at: new Date().toISOString() });
  const user = await byId('users', refund.user_id);
  await updateOne('refund_requests', refund.id, {});
  const { notify } = await import('../services/notify.service.js');
  await notify({ userId: refund.user_id, type: 'refund', title: `Refund ${approve ? 'approved' : 'declined'}`, body: approve ? 'Funds returned in 5-10 business days.' : 'See support for details.', email: user.email, emailTemplate: 'refundResolved', emailData: { courseTitle: 'your order', approved: approve } });
  await audit({ actorId: req.user.id, action: approve ? 'refund.approve' : 'refund.decline', entityType: 'refund', entityId: refund.id });
  res.json({ ok: true });
});

/* ── Platform settings ───────────────────────────────────── */

export const getSettings = asyncHandler(async (req, res) => {
  const row = await byId('platform_settings', 1, 'settings');
  res.json({ settings: row?.settings || {} });
});

export const updateSettings = asyncHandler(async (req, res) => {
  if (!['super_admin'].includes(req.user.role)) throw HttpError.forbidden('Super admin only');
  const current = (await byId('platform_settings', 1, 'settings'))?.settings || {};
  const merged = { ...current, ...req.body.settings };
  await db.from('platform_settings').update({ settings: merged }).eq('id', 1);
  await audit({ actorId: req.user.id, action: 'settings.update', entityType: 'platform_settings', entityId: 1, metadata: req.body.settings });
  res.json({ settings: merged });
});

/* ── AI usage monitoring ─────────────────────────────────── */

export const aiUsage = asyncHandler(async (req, res) => {
  const rows = must(await db.from('ai_usage').select('feature, total_tokens, created_at').order('created_at', { ascending: false }).limit(2000));
  const byFeature = {};
  let totalTokens = 0;
  for (const r of rows) {
    byFeature[r.feature] = (byFeature[r.feature] || 0) + (r.total_tokens || 0);
    totalTokens += r.total_tokens || 0;
  }
  // rough cost estimate: $2.5 / 1M tokens (illustrative)
  res.json({ calls: rows.length, totalTokens, estimatedCostUsd: (totalTokens / 1e6) * 2.5, byFeature });
});

/* ── Revenue reports & export ────────────────────────────── */

export const revenueReport = asyncHandler(async (req, res) => {
  const rows = must(await db.from('orders').select('created_at,total_cents,commission_cents,currency,status').eq('status', 'paid').order('created_at', { ascending: false }).limit(5000));
  const byCategory = must(await db.from('order_items').select('instructor_earnings_cents,price_cents, course:courses(category_id, category:categories(name))'));
  const catTotals = {};
  for (const it of byCategory) {
    const name = it.course?.category?.name || 'Uncategorized';
    catTotals[name] = (catTotals[name] || 0) + (it.price_cents || 0);
  }
  res.json({
    totals: { gross: rows.reduce((a, r) => a + r.total_cents, 0), commission: rows.reduce((a, r) => a + (r.commission_cents || 0), 0) },
    byCategory: Object.entries(catTotals).map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents),
  });
});

/** POST /api/admin/reports/export — { kind, format } returns a Supabase Storage URL */
export const exportReport = asyncHandler(async (req, res) => {
  const kind = req.body.kind || 'revenue';
  const format = req.body.format || 'pdf';
  let columns = ['Date', 'Amount', 'Status'];
  let rows = [];
  if (kind === 'revenue') {
    const orders = must(await db.from('orders').select('created_at,total_cents,status').eq('status', 'paid').order('created_at', { ascending: false }).limit(2000));
    rows = orders.map((o) => [String(o.created_at).slice(0, 10), formatMoney(o.total_cents), o.status]);
  } else if (kind === 'enrollments') {
    columns = ['Date', 'Course', 'Student'];
    const es = must(await db.from('enrollments').select('created_at, course:courses(title), user:users(display_name)').order('created_at', { ascending: false }).limit(2000));
    rows = es.map((e) => [String(e.created_at).slice(0, 10), e.course?.title, e.user?.display_name]);
  }
  if (format === 'csv') {
    const csv = [columns.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const file = await uploadBuffer(env.storage.files, 'reports', `${kind}.csv`, Buffer.from(csv), 'text/csv');
    return res.json({ url: file.url, format: 'csv' });
  }
  const pdf = await renderReportPdf({ title: `${kind} report`, generatedAt: new Date().toISOString(), columns, rows, summary: [{ label: 'Records', value: String(rows.length) }] });
  const file = await uploadBuffer(env.storage.files, 'reports', `${kind}.pdf`, pdf, 'application/pdf');
  res.json({ url: await createSignedUrl(env.storage.files, file.path, 3600), format: 'pdf' });
});

/* ── Flash sale / promotions ─────────────────────────────── */

export const createPromotion = asyncHandler(async (req, res) => {
  const { name, percent_off, starts_at, ends_at, course_ids = [], coupon_code = null } = req.body;
  const promo = await insertOne('promotions', { name, percent_off: Number(percent_off) || 0, starts_at, ends_at, course_ids, coupon_code, created_by: req.user.id, active: true });
  await audit({ actorId: req.user.id, action: 'promotion.create', entityType: 'promotion', entityId: promo.id });
  res.status(201).json({ promotion: promo });
});

export const listPromotions = asyncHandler(async (req, res) => {
  res.json({ promotions: must(await db.from('promotions').select('*').order('created_at', { ascending: false }).limit(100)) });
});

/* ── Coupons (instructor + platform) ─────────────────────── */

export const createCoupon = asyncHandler(async (req, res) => {
  const { code, scope = 'course', course_id: courseId = null, percent_off = null, amount_off = null, expires_at = null, max_redemptions = null, min_order_cents = null } = req.body;
  if (!code) throw HttpError.badRequest('code required');
  const coupon = await insertOne('coupons', {
    code: String(code).toUpperCase(), scope, course_id: courseId,
    percent_off: percent_off != null ? Number(percent_off) : null,
    amount_off: amount_off != null ? Number(amount_off) : null,
    expires_at, max_redemptions: max_redemptions != null ? Number(max_redemptions) : null,
    min_order_cents: min_order_cents != null ? Number(min_order_cents) : null,
    created_by: req.user.id, is_active: true, redeemed_count: 0,
    applicable_instructor_id: scope === 'course' ? req.user.id : null,
  });
  res.status(201).json({ coupon });
});

export const listCoupons = asyncHandler(async (req, res) => {
  let q = db.from('coupons').select('*').order('created_at', { ascending: false });
  if (req.query.mine === 'true' && !['admin', 'super_admin'].includes(req.user.role)) q = q.eq('created_by', req.user.id);
  res.json({ coupons: must(await q.limit(200)) });
});

export const toggleCoupon = asyncHandler(async (req, res) => {
  const coupon = await byId('coupons', req.params.id);
  if (!coupon) throw HttpError.notFound('Coupon not found');
  if (coupon.created_by !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) throw HttpError.forbidden();
  res.json({ coupon: await updateOne('coupons', coupon.id, { is_active: Boolean(req.body.is_active) }) });
});

/** GET /api/admin/audit-log */
export const auditLog = asyncHandler(async (req, res) => {
  const { limit, offset } = pagination(req.query, { defaultLimit: 100 });
  const rows = must(await db.from('audit_logs').select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1));
  res.json({ logs: rows });
});

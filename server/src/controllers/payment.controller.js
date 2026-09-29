import { db, must, byId, insertOne, updateOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { validate, pagination } from '../utils/validate.js';
import { stripe, formatMoney } from '../lib/stripe.js';
import { audit } from '../utils/audit.js';
import { notify } from '../services/notify.service.js';
import { grantEnrollment } from './enrollment.controller.js';
import { getPlatformSettings, availableBalance } from './instructor.controller.js';
import { computeDiscount } from '../services/coupon.service.js';

/**
 * POST /api/payments/checkout
 * body: { course_ids: [], coupon_code?, gift_to_email?, access_type? }
 * Creates a pending order + Stripe PaymentIntent; enrollment happens on webhook.
 */
export const checkout = asyncHandler(async (req, res) => {
  const { course_ids: courseIds = [], coupon_code: couponCode = null, gift_to_email: giftEmail = null } = req.body;
  if (!courseIds.length) throw HttpError.badRequest('Select at least one course');

  const courses = must(await db.from('courses').select('*').in('id', courseIds).eq('status', 'published'));
  if (courses.length !== courseIds.length) throw HttpError.badRequest('One or more courses unavailable');

  const settings = await getPlatformSettings();
  const commissionPct = Number(settings.commission_percent ?? 20);

  let subtotal = courses.reduce((a, c) => a + Math.round((c.is_free ? 0 : c.price) * 100), 0);
  const discount = await computeDiscount({ couponCode, courses, userId: req.user.id, subtotal });
  const total = Math.max(0, subtotal - discount.amountCents);

  if (total === 0) {
    // Free checkout (free courses / 100% coupon) — fulfill immediately
    const order = await fulfillOrder({ userId: req.user.id, courses, discount, subtotal, total, commissionPct, giftEmail });
    return res.json({ order, free: true, clientSecret: null });
  }

  const order = await insertOne('orders', {
    user_id: req.user.id, status: 'pending', currency: 'usd',
    subtotal_cents: subtotal, discount_cents: discount.amountCents, total_cents: total,
    commission_percent: commissionPct, coupon_id: discount.couponId || null, gift_to_email: giftEmail,
    items: courses.map((c) => ({ course_id: c.id, title: c.title, price_cents: Math.round(c.price * 100), instructor_id: c.instructor_id })),
  });

  // Destination-charge split is per-instructor; for multi-instructor carts we
  // charge on the platform and transfer instructor shares via internal ledger.
  const intent = await stripe.paymentIntents.create({
    amount: total,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: { orderId: order.id, userId: req.user.id, kind: 'course_purchase' },
  });
  await updateOne('orders', order.id, { payment_intent_id: intent.id });
  res.json({ orderId: order.id, clientSecret: intent.client_secret, total, formatted: formatMoney(total) });
});

/** Fulfil a zero-cost order immediately. */
async function fulfillOrder({ userId, courses, discount, subtotal, total, commissionPct, giftEmail }) {
  let targetUserId = userId;
  if (giftEmail) {
    const recipient = must(await db.from('users').select('id').eq('email', giftEmail).limit(1))[0];
    if (recipient) targetUserId = recipient.id;
  }
  const order = await insertOne('orders', {
    user_id: userId, status: 'paid', currency: 'usd',
    subtotal_cents: subtotal, discount_cents: discount.amountCents, total_cents: total,
    commission_percent: commissionPct, paid_at: new Date().toISOString(),
    items: courses.map((c) => ({ course_id: c.id, title: c.title, price_cents: 0, instructor_id: c.instructor_id })),
  });
  for (const c of courses) {
    await grantEnrollment({ userId: targetUserId, courseId: c.id, orderId: order.id, source: 'free' });
    await insertOne('order_items', { order_id: order.id, course_id: c.id, price_cents: 0, instructor_earnings_cents: 0 });
  }
  await applyReferralAndLoyalty({ userId, order, paidCents: total });
  return order;
}

/** Shared fulfilment used by the Stripe webhook for paid orders. */
export async function fulfillPaidOrder({ orderId }) {
  const order = await byId('orders', orderId);
  if (!order || order.status === 'paid') return { ok: true, already: order?.status === 'paid' };
  const settings = await getPlatformSettings();
  void settings;
  const commissionPct = Number(order.commission_percent ?? 20);
  const items = must(await db.from('courses').select('id,instructor_id,title').in('id', (order.items || []).map((i) => i.course_id)));
  const grossNet = order.total_cents;
  let targetUserId = order.user_id;
  if (order.gift_to_email) {
    const r = must(await db.from('users').select('id').eq('email', order.gift_to_email).limit(1))[0];
    if (r) targetUserId = r.id;
  }
  const totalList = items.reduce((a, c) => a + Math.round((c.price || 0) * 100), 0) || 1;
  for (const c of items) {
    const share = Math.round((Math.round((await byId('courses', c.id)).price * 100) / totalList) * grossNet);
    const instructorCents = Math.round(share * (1 - commissionPct / 100));
    await grantEnrollment({ userId: targetUserId, courseId: c.id, orderId: order.id, source: 'purchase' });
    await insertOne('order_items', { order_id: order.id, course_id: c.id, price_cents: share, instructor_earnings_cents: instructorCents });
    await notify({ userId: c.instructor_id, type: 'new_enrollment', title: 'New enrollment 🎉', body: `Someone enrolled in ${c.title}` });
  }
  await updateOne('orders', order.id, { status: 'paid', paid_at: new Date().toISOString() });
  const buyer = await byId('users', order.user_id);
  await notify({ userId: buyer.id, type: 'purchase', title: 'Purchase confirmed', body: 'Your courses are unlocked!', link: '/dashboard/my-learning', email: buyer.email, emailTemplate: 'purchase', emailData: { name: buyer.display_name, courseTitle: items.map((i) => i.title).join(', '), amount: formatMoney(order.total_cents) } });
  await applyReferralAndLoyalty({ userId: order.user_id, order, paidCents: order.total_cents });
  return { ok: true };
}

/** GET /api/payments/orders — purchase history + invoices */
export const myOrders = asyncHandler(async (req, res) => {
  const { limit, offset } = pagination(req.query, { defaultLimit: 25 });
  const rows = must(await db.from('orders').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).range(offset, offset + limit - 1));
  res.json({ orders: rows });
});

/** POST /api/payments/refund-request — { order_id } within policy window */
export const requestRefund = asyncHandler(async (req, res) => {
  const { order_id: orderId } = validate({ order_id: 'required|uuid' }, req.body);
  const order = await byId('orders', orderId);
  if (!order || order.user_id !== req.user.id) throw HttpError.forbidden('Order not found');
  if (order.status !== 'paid') throw HttpError.badRequest('Order not refundable');
  const settings = await getPlatformSettings();
  const days = Number(settings.refund_policy_days ?? 30);
  const maxCompletion = Number(settings.refund_max_completion_percent ?? 30);
  const paidAt = new Date(order.paid_at || order.created_at);
  if ((Date.now() - paidAt.getTime()) / 86400000 > days) throw HttpError.badRequest(`Refund window (${days} days) has passed`);
  const items = must(await db.from('enrollments').select('progress_percent').eq('user_id', req.user.id).in('course_id', (order.items || []).map((i) => i.course_id)));
  const maxProgress = Math.max(0, ...items.map((i) => i.progress_percent || 0));
  if (maxProgress > maxCompletion) throw HttpError.badRequest(`Refund not available after ${maxCompletion}% completion`);
  const existing = must(await db.from('refund_requests').select('id,status').eq('order_id', orderId).in('status', ['pending', 'approved']).limit(1));
  if (existing.length) throw HttpError.conflict('A refund request is already open');
  const refund = await insertOne('refund_requests', { order_id: orderId, user_id: req.user.id, amount_cents: order.total_cents, reason: req.body.reason || null, status: 'pending' });
  const admins = must(await db.from('users').select('id').in('role', ['admin', 'super_admin']));
  for (const a of admins) await notify({ userId: a.id, type: 'refund_request', title: 'Refund requested', body: `${formatMoney(order.total_cents)} refund on order ${orderId.slice(0, 8)}` });
  res.status(201).json({ refund });
});

/** GET /api/payments/refunds/me */
export const myRefunds = asyncHandler(async (req, res) => {
  const rows = must(await db.from('refund_requests').select('*, order:orders(total_cents)').eq('user_id', req.user.id).order('created_at', { ascending: false }));
  res.json({ refunds: rows });
});

async function applyReferralAndLoyalty({ userId, order, paidCents }) {
  void order;
  try {
    const points = Math.floor((paidCents || 0) / 100); // 1 point per $1 spent
    if (points > 0) {
      const existing = must(await db.from('loyalty_points').select('*').eq('user_id', userId).limit(1))[0];
      if (existing) await updateOne('loyalty_points', existing.id, { balance: (existing.balance || 0) + points, lifetime_points: (existing.lifetime_points || 0) + points });
      else await insertOne('loyalty_points', { user_id: userId, balance: points, lifetime_points: points });
    }
  } catch (err) {
    console.error('[loyalty] failed', err.message);
  }
}

import { db, must, byId, insertOne, updateOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { stripe } from '../lib/stripe.js';
import { notify } from '../services/notify.service.js';
import { grantEnrollment } from './enrollment.controller.js';

/** GET /api/subscriptions/plans — public pricing page */
export const listPlans = asyncHandler(async (req, res) => {
  const rows = must(await db.from('subscription_plans').select('*').eq('is_active', true).order('price_cents'));
  res.json({ plans: rows });
});

/** Ensure a Stripe customer id exists for the user. */
async function ensureCustomer(user) {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const customer = await stripe.customers.create({ email: user.email, name: user.display_name, metadata: { userId: user.id } });
  await updateOne('users', user.id, { stripe_customer_id: customer.id });
  return customer.id;
}

/**
 * POST /api/subscriptions/subscribe — { plan_id }
 * Creates (or resumes) a subscription via Stripe. Returns clientSecret for
 * the frontend to confirm payment.
 */
export const subscribe = asyncHandler(async (req, res) => {
  const plan = await byId('subscription_plans', req.body.plan_id);
  if (!plan || !plan.is_active) throw HttpError.badRequest('Plan unavailable');
  const customerId = await ensureCustomer(req.user);
  let priceId = plan.stripe_price_id;
  if (!priceId) {
    const product = await stripe.products.create({ name: plan.name });
    const price = await stripe.prices.create({ product: product.id, unit_amount: plan.price_cents, currency: plan.currency, recurring: { interval: plan.interval } });
    priceId = price.id;
    await updateOne('subscription_plans', plan.id, { stripe_price_id: priceId, stripe_product_id: product.id });
  }
  const trialDays = plan.trial_days || 0;
  const sub = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    trial_period_days: trialDays || undefined,
    expand: ['latest_invoice.payment_intent'],
    metadata: { planId: plan.id, userId: req.user.id },
  });
  const row = await insertOne('subscriptions', {
    user_id: req.user.id, plan_id: plan.id, stripe_subscription_id: sub.id, stripe_customer_id: customerId,
    status: sub.status, current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
  });
  res.json({ subscription: row, clientSecret: sub.latest_invoice?.payment_intent?.client_secret || null });
});

/** GET /api/subscriptions/me */
export const mySubscription = asyncHandler(async (req, res) => {
  const row = must(await db.from('subscriptions').select('*, plan:subscription_plans(*)').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(1))[0] || null;
  res.json({ subscription: row });
});

/** POST /api/subscriptions/cancel — cancel at period end */
export const cancelSubscription = asyncHandler(async (req, res) => {
  const row = must(await db.from('subscriptions').select('*').eq('user_id', req.user.id).in('status', ['active', 'trialing']).limit(1))[0];
  if (!row) throw HttpError.notFound('No active subscription');
  await stripe.subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: true });
  res.json({ ok: true, cancelAtPeriodEnd: true });
});

/** POST /api/subscriptions/resume */
export const resumeSubscription = asyncHandler(async (req, res) => {
  const row = must(await db.from('subscriptions').select('*').eq('user_id', req.user.id).eq('cancel_at_period_end', true).limit(1))[0];
  if (!row) throw HttpError.notFound('Nothing to resume');
  await stripe.subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: false });
  res.json({ ok: true });
});

/** Access check for subscription-gated courses. */
export async function hasSubscriptionAccess(userId) {
  const sub = must(await db.from('subscriptions').select('status,current_period_end').eq('user_id', userId).in('status', ['active', 'trialing']).limit(1))[0];
  if (!sub) return false;
  if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) return false;
  return true;
}

/** POST /api/subscriptions/teams/invite — organization bulk enrollment */
export const bulkEnroll = asyncHandler(async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role) && req.body.organizer_id !== req.user.id) throw HttpError.forbidden();
  const { course_id: courseId, emails = [] } = req.body;
  const results = [];
  for (const email of emails) {
    const u = must(await db.from('users').select('id').eq('email', email).limit(1))[0];
    if (!u) { results.push({ email, status: 'not_found' }); continue; }
    await grantEnrollment({ userId: u.id, courseId, source: 'bulk' });
    results.push({ email, status: 'enrolled' });
  }
  res.json({ results });
});

/** Sync helper used by the Stripe webhook for subscription lifecycle events. */
export async function syncSubscription({ stripeSubscriptionId, status, periodEnd }) {
  const row = must(await db.from('subscriptions').select('id,user_id').eq('stripe_subscription_id', stripeSubscriptionId).limit(1))[0];
  if (!row) return { ok: false };
  await updateOne('subscriptions', row.id, { status, current_period_end: periodEnd || null });
  await notify({ userId: row.user_id, type: 'subscription', title: 'Subscription updated', body: `Your subscription is now ${status}.` });
  return { ok: true };
}

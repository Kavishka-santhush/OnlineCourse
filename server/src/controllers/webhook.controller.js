import { db, must, byId, insertOne, updateOne } from '../lib/supabase.js';
import { asyncHandler, HttpError } from '../utils/httpError.js';
import { clerkClient } from '@clerk/express';
import { stripe, STRIPE_WEBHOOK_SECRET } from '../lib/stripe.js';
import { fulfillPaidOrder } from './payment.controller.js';
import { syncSubscription } from './subscription.controller.js';
import { templates } from '../services/emailTemplates.jsx';
import { sendMail } from '../lib/mailer.js';
import { notify } from '../services/notify.service.js';
import { env } from '../config/env.js';

/**
 * CLERK WEBHOOK  (mounted with raw body at /api/webhooks/clerk)
 * Syncs user lifecycle events into the Supabase `users` table.
 * Default role on sign-up is `student`.
 */
export const clerkWebhook = asyncHandler(async (req, res) => {
  if (env.clerk.webhookSecret && !env.clerk.webhookSecret.startsWith('your_')) {
    try {
      await clerkClient(__clerkOpts()).webhooks.verifySignature({
        eventId: req.headers['webhook-id'],
        data: req.rawBody.toString(),
        headers: { 'webhook-signature': req.headers['webhook-signature'], 'webhook-timestamp': req.headers['webhook-timestamp'], 'webhook-id': req.headers['webhook-id'] },
      });
    } catch (e) {
      return res.status(400).send(`Signature verification failed: ${e.message}`);
    }
  }

  const evt = JSON.parse(req.rawBody.toString('utf8'));
  const type = evt.type;
  const data = evt.data || {};

  switch (type) {
    case 'user.created': {
      const email = (data.email_addresses || [])[0]?.email_address || null;
      const primary = data.primary_email_address_id && data.email_addresses?.find((e) => e.id === data.primary_email_address_id)?.email_address || email;
      // A demo/seeded account may already own this e-mail with a
      // placeholder clerk_id. Bind it instead of creating a duplicate.
      if (primary) {
        const bound = must(await db.rpc('bind_seed_accounts', { p_clerk_id: data.id, p_email: primary }));
        if (Number(bound) >= 1) {
          const existing = must(await db.from('users').select('id').eq('clerk_id', data.id).limit(1))[0];
          if (existing) {
            await seedPreferences(existing.id);
            return res.json({ synced: 'claimed', id: existing.id });
          }
        }
      }
      const username = (data.username || (primary ? primary.split('@')[0] : null) || `user_${data.id.slice(-6)}`).toLowerCase();
      const dup = must(await db.from('users').select('id').eq('username', username).limit(1));
      const finalUsername = dup.length ? `${username}_${data.id.slice(-4).toLowerCase()}` : username;
      const user = await insertOne('users', {
        clerk_id: data.id,
        email: primary,
        display_name: [data.first_name, data.last_name].filter(Boolean).join(' ') || finalUsername,
        username: finalUsername,
        avatar_url: data.image_url || null,
        role: 'student',
        onboarded: false,
      });
      await seedPreferences(user.id);
      if (primary) await sendMail({ to: primary, subject: 'Welcome to CourseMarket', html: templates.welcome({ name: user.display_name, email: primary }) });
      return res.json({ synced: 'created', id: user.id });
    }
    case 'user.updated': {
      const local = must(await db.from('users').select('id').eq('clerk_id', data.id).limit(1))[0];
      if (!local) return res.json({ synced: 'noop' });
      const email = (data.email_addresses || []).find((e) => e.id === data.primary_email_address_id)?.email_address || null;
      await updateOne('users', local.id, {
        email: email || undefined,
        display_name: [data.first_name, data.last_name].filter(Boolean).join(' ') || undefined,
        avatar_url: data.image_url || undefined,
      });
      return res.json({ synced: 'updated', id: local.id });
    }
    case 'user.deleted': {
      const local = must(await db.from('users').select('id').eq('clerk_id', data.id).limit(1))[0];
      if (local) {
        await db.from('users').update({ is_suspended: true, deleted_at: new Date().toISOString() }).eq('id', local.id);
      }
      return res.json({ synced: 'deleted' });
    }
    default:
      return res.json({ ignored: type });
  }
});

function __clerkOpts() {
  return { secretKey: env.clerk.secretKey };
}

async function seedPreferences(userId) {
  const types = ['purchase', 'new_lesson', 'quiz_due', 'assignment_graded', 'live_class', 'certificate', 'price_drop', 'announcement', 'new_enrollment', 'new_review', 'course_moderation', 'payout', 'message'];
  await db.from('notification_preferences').insert(types.map((type) => ({ user_id: userId, type, in_app: true, email: true })));
}

/**
 * STRIPE WEBHOOK  (mounted with raw body at /api/webhooks/stripe)
 */
export const stripeWebhook = asyncHandler(async (req, res) => {
  let event = req.body;
  if (STRIPE_WEBHOOK_SECRET && !STRIPE_WEBHOOK_SECRET.startsWith('your_')) {
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
    } catch (e) {
      throw HttpError.badRequest(`Webhook signature verification failed: ${e.message}`);
    }
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const orderId = event.data.object.metadata?.orderId;
      if (orderId) await fulfillPaidOrder({ orderId });
      break;
    }
    case 'checkout.session.completed': {
      const orderId = event.data.object.metadata?.orderId;
      if (orderId) await fulfillPaidOrder({ orderId });
      break;
    }
    case 'payment_intent.payment_failed': {
      const orderId = event.data.object.metadata?.orderId;
      if (orderId) await updateOne('orders', orderId, { status: 'failed' });
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await syncSubscription({ stripeSubscriptionId: sub.id, status: sub.status, periodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null });
      break;
    }
    case 'payout.paid':
      break;
    default:
      break;
  }
  res.json({ received: true });
});

export { notify };

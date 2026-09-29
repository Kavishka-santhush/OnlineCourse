import Stripe from 'stripe';
import { env } from '../config/env.js';

export const stripe = new Stripe(env.stripe.secretKey, {
  apiVersion: '2024-06-20',
  appInfo: { name: 'CourseMarket', version: '1.0.0' },
});

export const STRIPE_WEBHOOK_SECRET = env.stripe.webhookSecret;

/** Format an integer amount in the smallest currency unit to a display string. */
export function formatMoney(amountInCents, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() })
    .format((amountInCents || 0) / 100);
}

/** Create a Stripe Connect onboarding link for an instructor account. */
export async function createConnectOnboardingUrl(accountId, refreshUrl, returnUrl) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
  return accountLink.url;
}

export async function createExpressAccount({ email, country = 'US', businessType = 'individual', metadata = {} }) {
  return stripe.accounts.create({
    type: 'express',
    country,
    email,
    capabilities: { transfers: { requested: true } },
    business_type: businessType,
    metadata,
  });
}

/**
 * Payout split via Application Fees: create a PaymentIntent on the platform
 * with transfer_data to the instructor's connected account and application_fee_amount.
 */
export function buildCoursePaymentIntent({ courseId, studentId, instructorAccountId, grossCents, commissionCents, currency = 'usd' }) {
  const params = {
    amount: grossCents,
    currency,
    automatic_payment_methods: { enabled: true },
    metadata: { courseId: String(courseId), studentId, kind: 'course_purchase' },
  };
  if (instructorAccountId) {
    params.transfer_data = {
      destination: instructorAccountId,
      application_fee_amount: commissionCents,
    };
  }
  return stripe.paymentIntents.create(params);
}

export async function createSubscription({ customerId, priceId, trialDays = 0, metadata = {} }) {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    trial_period_days: trialDays || undefined,
    expand: ['latest_invoice.payment_intent'],
    metadata,
  });
}

export async function createRefund({ paymentIntentId, amount }) {
  return stripe.refunds.create(amount ? { payment_intent: paymentIntentId, amount } : { payment_intent: paymentIntentId });
}

export async function createCoupon({ percentOff, amountOff, duration = 'once', maxRedemptions, redeemBy, name, currency = 'usd' }) {
  return stripe.promotionCodes.create({
    coupon: await stripe.coupons
      .create(
        percentOff
          ? { percent_off: percentOff, duration, max_redemptions: maxRedemptions, redeem_by: redeemBy, name }
          : { amount_off: amountOff, currency, duration, max_redemptions: maxRedemptions, redeem_by: redeemBy, name },
      )
      .then((c) => c.id),
    max_redemptions: maxRedemptions,
    redeem_by: redeemBy,
  });
}

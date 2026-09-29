import { loadStripe } from '@stripe/stripe-js';

const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

let stripePromise = null;

/** Lazily load Stripe.js (returns null when no publishable key is configured). */
export function getStripe() {
  if (!key || key.startsWith('your_')) return null;
  if (!stripePromise) stripePromise = loadStripe(key);
  return stripePromise;
}

export const stripeConfigured = () => !!(key && !key.startsWith('your_'));

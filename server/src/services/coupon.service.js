import { db, must } from '../lib/supabase.js';
import { HttpError } from '../utils/httpError.js';

/**
 * Validate a coupon code and compute a discount against a cart subtotal.
 * Coupon scopes: `course` (tied to a specific course), `platform` (whole cart),
 * `subscription` (rejected here — handled by the subscription controller).
 *
 * @returns {{ amountCents:number, couponId:string|null, code:string|null, percentOff:number }}
 */
export async function computeDiscount({ couponCode, courses = [], subtotal, userId }) {
  if (!couponCode) return { amountCents: 0, couponId: null, code: null, percentOff: 0 };
  const rows = must(await db.from('coupons').select('*').eq('code', String(couponCode).toUpperCase()).limit(1));
  const coupon = rows[0];
  if (!coupon) throw HttpError.badRequest('Invalid coupon code');
  if (!coupon.is_active) throw HttpError.badRequest('This coupon is no longer active');
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) throw HttpError.badRequest('This coupon has expired');
  if (coupon.max_redemptions && coupon.redeemed_count >= coupon.max_redemptions) throw HttpError.badRequest('This coupon has reached its usage limit');
  if (coupon.scope === 'subscription') throw HttpError.badRequest('This coupon is for subscriptions only');
  if (coupon.min_order_cents && subtotal < coupon.min_order_cents) throw HttpError.badRequest(`Minimum order of $${(coupon.min_order_cents / 100).toFixed(2)} required`);
  if (coupon.scope === 'course' && coupon.course_id && !courses.some((c) => c.id === coupon.course_id)) {
    throw HttpError.badRequest('This coupon does not apply to the courses in your cart');
  }
  if (coupon.applicable_instructor_id && !courses.some((c) => c.instructor_id === coupon.applicable_instructor_id)) {
    throw HttpError.badRequest('This coupon does not apply to the selected courses');
  }

  let amountCents = 0;
  if (coupon.percent_off) amountCents = Math.round((subtotal * coupon.percent_off) / 100);
  else if (coupon.amount_off) amountCents = Math.min(subtotal, coupon.amount_off);
  amountCents = Math.min(amountCents, subtotal);

  // Record redemption (best-effort; webhook finalises the order)
  try {
    await db.from('coupon_redemptions').insert({ coupon_id: coupon.id, user_id: userId, discount_cents: amountCents });
    await db.from('coupons').update({ redeemed_count: (coupon.redeemed_count || 0) + 1 }).eq('id', coupon.id);
  } catch { /* non-critical */ }

  return { amountCents, couponId: coupon.id, code: coupon.code, percentOff: coupon.percent_off || 0 };
}

/** POST /api/coupons/validate — used by the checkout UI before payment. */
export async function previewDiscount({ couponCode, courses, subtotal, userId }) {
  try {
    const d = await computeDiscount({ couponCode, courses, subtotal, userId: userId || null });
    // don't count the preview as a redemption — decrement back
    if (d.couponId) {
      const coupon = must(await db.from('coupons').select('redeemed_count').eq('id', d.couponId).limit(1))[0];
      if (coupon) await db.from('coupons').update({ redeemed_count: Math.max(0, (coupon.redeemed_count || 1) - 1) }).eq('id', d.couponId);
    }
    return { valid: true, ...d };
  } catch (err) {
    return { valid: false, message: err.message };
  }
}

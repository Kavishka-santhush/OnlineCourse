import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { api } from '@/lib/api.js';

const KEY = 'cm_cart';

export const useCartStore = defineStore('cart', () => {
  const items = ref(JSON.parse(localStorage.getItem(KEY) || '[]')); // [{course..., price_cents?}]
  const coupon = ref(null);            // { code, amountCents, percentOff }
  const couponError = ref('');

  watch(items, (v) => localStorage.setItem(KEY, JSON.stringify(v)), { deep: true });

  const count = computed(() => items.value.length);
  const has = (id) => items.value.some((i) => i.id === id);
  const subtotal = computed(() => items.value.reduce((s, i) => s + Number(i.price || 0), 0)); // major units
  const paidItems = computed(() => items.value.filter((i) => !i.is_free));

  function add(course) {
    if (has(course.id) || course.is_free) return;
    items.value.push({
      id: course.id, title: course.title, slug: course.slug,
      price: Number(course.price || 0), currency: course.currency || 'usd',
      thumbnail_url: course.thumbnail_url, instructor_id: course.instructor_id, is_free: !!course.is_free,
    });
  }
  function remove(id) { items.value = items.value.filter((i) => i.id !== id); }
  function clear() { items.value = []; coupon.value = null; couponError.value = ''; }

  async function applyCoupon(code) {
    couponError.value = '';
    try {
      const res = await api.post('/coupons/validate', {
        code,
        subtotal: Math.round(subtotal.value * 100),
        courses: items.value.map((i) => ({ id: i.id, price_cents: Math.round(i.price * 100), instructor_id: i.instructor_id })),
      });
      coupon.value = { code, amountCents: res.amountCents || 0, percentOff: res.percentOff || 0 };
      return true;
    } catch (e) {
      coupon.value = null;
      couponError.value = e.message || 'Invalid coupon';
      return false;
    }
  }
  function removeCoupon() { coupon.value = null; couponError.value = ''; }

  const discountCents = computed(() => coupon.value?.amountCents || 0);
  const totalCents = computed(() => Math.max(0, Math.round(subtotal.value * 100) - discountCents.value));

  return {
    items, coupon, couponError, count, subtotal, paidItems, has,
    add, remove, clear, applyCoupon, removeCoupon, discountCents, totalCents,
  };
});

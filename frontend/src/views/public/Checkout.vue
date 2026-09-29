<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { Lock, ShieldCheck, Gift, CheckCircle2 } from 'lucide-vue-next';
import { Button, Card, Input, Label } from '@/components/ui';
import { api } from '@/lib/api.js';
import { getStripe, stripeConfigured } from '@/lib/stripe.js';
import { useCartStore } from '@/stores/cart.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';
import { money, moneyCents } from '@/lib/utils.js';

const cart = useCartStore();
const auth = useAuthStore();
const ui = useUiStore();
const router = useRouter();

const name = ref(auth.displayName || '');
const giftEmail = ref('');
const useGift = ref(false);
const errors = ref({});

const cardEl = ref(null);
const cardMounted = ref(false);
let stripe = null;
let cardComponent = null;

const step = ref('pay'); // pay | done
const paidTotal = ref(0);

const items = computed(() => cart.items);
const hasPaid = computed(() => cart.paidItems.length > 0);

onMounted(async () => {
  if (!auth.isAuthed) return router.replace({ name: 'sign-in', query: { redirect: '/checkout' } });
  if (!cart.count) return router.replace({ name: 'cart' });
  if (hasPaid.value && stripeConfigured()) {
    stripe = await getStripe();
    if (stripe) {
      const elements = stripe.elements();
      cardComponent = elements.create('card', { hidePostalCode: true });
      cardComponent.mount(cardEl.value);
      cardMounted.value = true;
    }
  }
});
onBeforeUnmount(() => cardComponent?.destroy?.());

async function pay() {
  errors.value = {};
  try {
    const res = await api.post('/payments/checkout', {
      course_ids: items.value.map((i) => i.id),
      coupon_code: cart.coupon?.code || null,
      gift_to_email: useGift.value ? giftEmail.value : null,
    });

    // Free / fully-discounted: fulfilled server-side already.
    if (res.free || !res.clientSecret) {
      paidTotal.value = res.total || 0;
      finish();
      return;
    }

    // Requires card payment.
    if (!stripe || !cardComponent) {
      ui.toast.warning('Stripe is not configured on this deployment — set VITE_STRIPE_PUBLISHABLE_KEY to complete paid checkout.');
      return;
    }
    const { error } = await stripe.confirmCardPayment(res.clientSecret, {
      payment_method: { card: cardComponent, billing_details: { name: name.value } },
    });
    if (error) {
      ui.toast.error(error.message || 'Payment failed');
      return;
    }
    paidTotal.value = res.total || 0;
    // Give the webhook a moment to fulfil, then confirm order status.
    await pollOrder(res.orderId);
    finish();
  } catch (e) {
    if (e.status === 400) errors.value.general = e.message;
    else ui.toast.error(e.message || 'Checkout failed');
  }
}

async function pollOrder(orderId) {
  for (let i = 0; i < 6; i++) {
    try {
      const { orders } = await api.get('/payments/orders');
      const o = (orders || []).find((x) => x.id === orderId);
      if (o && o.status === 'paid') return;
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

function finish() {
  cart.clear();
  step.value = 'done';
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
    <!-- success -->
    <div v-if="step === 'done'" class="mx-auto max-w-md py-16 text-center">
      <CheckCircle2 class="mx-auto h-16 w-16 text-emerald-500" />
      <h1 class="mt-4 text-2xl font-bold">You're enrolled!</h1>
      <p class="mt-2 text-muted-foreground">
        {{ paidTotal ? `Payment of ${moneyCents(paidTotal)} confirmed. ` : '' }}Your courses are ready in My Learning.
      </p>
      <div class="mt-6 flex justify-center gap-3">
        <Button :to="{ name: 'my-learning' }">Start learning</Button>
        <Button variant="outline" :to="{ name: 'orders' }">View orders</Button>
      </div>
    </div>

    <template v-else>
      <div class="mb-2 flex items-center gap-2">
        <Lock class="h-5 w-5 text-primary" />
        <h1 class="text-2xl font-bold">Secure checkout</h1>
      </div>
      <p class="mb-8 text-sm text-muted-foreground">Encrypted payment, processed by Stripe. 30-day money-back guarantee.</p>

      <div class="grid gap-8 lg:grid-cols-[1fr_360px]">
        <!-- payment form -->
        <div class="space-y-6">
          <Card class="p-6">
            <h2 class="mb-4 font-semibold">Payment details</h2>
            <div v-if="!hasPaid">
              <p class="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                All items in your cart are free. Click "Complete enrollment" to enroll now.
              </p>
            </div>
            <div v-else-if="cardMounted">
              <Label class="mb-1.5 block">Name on card</Label>
              <Input v-model="name" class="mb-4" placeholder="Full name" />
              <div ref="cardEl" class="rounded-md border p-3" />
              <p class="mt-2 text-xs text-muted-foreground">Test with card 4242 4242 4242 4242, any future date, any CVC.</p>
            </div>
            <div v-else>
              <p class="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                Stripe publishable key is not configured, so card payment is unavailable on this build.
                Free and coupon-covered (100% off) orders can still be completed.
              </p>
            </div>
          </Card>

          <Card class="p-6">
            <label class="flex items-center gap-2">
              <input v-model="useGift" type="checkbox" class="h-4 w-4 rounded border-input" />
              <Gift class="h-4 w-4 text-primary" /> <span class="font-medium">Buy this as a gift</span>
            </label>
            <div v-if="useGift" class="mt-3">
              <Label class="mb-1.5 block">Recipient email</Label>
              <Input v-model="giftEmail" type="email" placeholder="friend@example.com" />
            </div>
          </Card>

          <p v-if="errors.general" class="text-sm text-destructive">{{ errors.general }}</p>
        </div>

        <!-- summary -->
        <div>
          <Card class="sticky top-20 p-6">
            <h2 class="font-semibold">Order summary</h2>
            <ul class="mt-4 space-y-3">
              <li v-for="i in items" :key="i.id" class="flex items-start justify-between gap-3 text-sm">
                <span class="line-clamp-2">{{ i.title }}</span>
                <span class="shrink-0">{{ i.is_free ? 'Free' : money(i.price, i.currency) }}</span>
              </li>
            </ul>
            <dl class="mt-4 space-y-2 border-t pt-4 text-sm">
              <div class="flex justify-between"><dt class="text-muted-foreground">Subtotal</dt><dd>{{ money(cart.subtotal) }}</dd></div>
              <div v-if="cart.discountCents" class="flex justify-between text-emerald-600"><dt>Discount</dt><dd>−{{ moneyCents(cart.discountCents) }}</dd></div>
              <div class="flex justify-between border-t pt-2 text-base font-bold"><dt>Total</dt><dd>{{ moneyCents(cart.totalCents) }}</dd></div>
            </dl>
            <Button class="mt-5 w-full" size="lg" @click="pay">
              <ShieldCheck class="h-4 w-4" /> {{ hasPaid ? `Pay ${moneyCents(cart.totalCents)}` : 'Complete enrollment' }}
            </Button>
          </Card>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Check, Crown, CreditCard } from 'lucide-vue-next';
import { Card, Button, Badge, Modal, Input, Label } from '@/components/ui';
import { api } from '@/lib/api.js';
import { getStripe, stripeConfigured } from '@/lib/stripe.js';
import { moneyCents, formatDate } from '@/lib/utils.js';
import { useUiStore } from '@/stores/ui.js';
import { useAuthStore } from '@/stores/auth.js';

const ui = useUiStore();
const auth = useAuthStore();

const plans = ref([]);
const sub = ref(null);
const loading = ref(true);
const busyPlan = ref(null);

// subscribe modal
const showSub = ref(false);
const chosen = ref(null);
const name = ref('');
const cardEl = ref(null);
const cardReady = ref(false);
let stripe = null;
let cardComponent = null;

const active = computed(() => sub.value && ['active', 'trialing'].includes(sub.value.status));

async function load() {
  loading.value = true;
  try {
    const [p, s] = await Promise.all([api.get('/subscriptions/plans'), api.get('/subscriptions/me')]);
    plans.value = p.plans || [];
    sub.value = s.subscription || null;
  } catch (e) { ui.toast.error(e.message || 'Could not load subscriptions'); }
  finally { loading.value = false; }
}

async function choose(plan) {
  chosen.value = plan;
  name.value = auth.displayName || '';
  showSub.value = true;
  await nextTick();
  if (stripeConfigured()) {
    stripe = await getStripe();
    if (stripe) {
      cardComponent?.destroy?.();
      cardComponent = stripe.elements().create('card', { hidePostalCode: true });
      cardComponent.mount(cardEl.value);
      cardReady.value = true;
    }
  }
}

async function confirmSubscribe() {
  busyPlan.value = chosen.value.id;
  try {
    const res = await api.post('/subscriptions/subscribe', { plan_id: chosen.value.id });
    if (res.clientSecret && stripe) {
      const { error } = await stripe.confirmCardPayment(res.clientSecret, {
        payment_method: { card: cardComponent, billing_details: { name: name.value } },
      });
      if (error) { ui.toast.error(error.message || 'Payment failed'); return; }
    }
    ui.toast.success('Subscription active!');
    showSub.value = false;
    await load();
  } catch (e) { ui.toast.error(e.message || 'Could not subscribe'); }
  finally { busyPlan.value = null; }
}

async function cancel() {
  if (!window.confirm('Cancel your subscription at period end?')) return;
  try { await api.post('/subscriptions/cancel'); ui.toast.info('Will cancel at period end'); await load(); }
  catch (e) { ui.toast.error(e.message); }
}
async function resume() {
  try { await api.post('/subscriptions/resume'); ui.toast.success('Subscription resumed'); await load(); }
  catch (e) { ui.toast.error(e.message); }
}

function feats(p) {
  const f = p.features;
  if (Array.isArray(f)) return f;
  if (typeof f === 'string') { try { return JSON.parse(f); } catch { return []; } }
  return [];
}

onMounted(load);
onBeforeUnmount(() => cardComponent?.destroy?.());
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="flex items-center gap-2 text-2xl font-bold"><Crown class="h-6 w-6 text-amber-500" /> Subscription</h1>
      <p class="mt-1 text-sm text-muted-foreground">Unlimited access to every course on one plan.</p>
    </div>

    <!-- current subscription -->
    <Card v-if="active" class="mb-8 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="flex items-center gap-2">
          <Badge :variant="sub.status === 'trialing' ? 'outline' : 'success'">{{ sub.status }}</Badge>
          <span class="font-semibold">{{ sub.plan?.name }}</span>
        </div>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ sub.cancel_at_period_end ? 'Cancels' : 'Renews' }} {{ formatDate(sub.current_period_end) }}
        </p>
      </div>
      <div class="flex gap-2">
        <Button v-if="sub.cancel_at_period_end" size="sm" @click="resume">Resume plan</Button>
        <Button v-else size="sm" variant="outline" @click="cancel">Cancel</Button>
      </div>
    </Card>

    <div v-if="loading" class="grid gap-4 md:grid-cols-3">
      <div v-for="i in 3" :key="i" class="h-72 animate-pulse rounded-xl bg-muted" />
    </div>

    <!-- plans -->
    <div v-else class="grid gap-4 md:grid-cols-3">
      <Card v-for="p in plans" :key="p.id" class="flex flex-col p-6" :class="active && sub.plan?.id === p.id ? 'ring-2 ring-primary' : ''">
        <h3 class="text-lg font-bold">{{ p.name }}</h3>
        <p v-if="p.description" class="mt-1 text-sm text-muted-foreground">{{ p.description }}</p>
        <div class="mt-4">
          <span class="text-3xl font-extrabold">{{ moneyCents(p.price_cents, p.currency) }}</span>
          <span class="text-sm text-muted-foreground">/{{ p.interval }}</span>
        </div>
        <p v-if="p.trial_days" class="mt-1 text-xs text-emerald-600">{{ p.trial_days }}-day free trial</p>
        <ul class="mt-4 flex-1 space-y-2 text-sm">
          <li v-for="(f, i) in feats(p)" :key="i" class="flex items-start gap-2"><Check class="mt-0.5 h-4 w-4 shrink-0 text-primary" /> <span>{{ typeof f === 'string' ? f : f.label || f.text }}</span></li>
        </ul>
        <Button class="mt-5" :disabled="active && sub.plan?.id === p.id" @click="choose(p)">
          {{ active && sub.plan?.id === p.id ? 'Current plan' : (active ? 'Switch' : 'Choose plan') }}
        </Button>
      </Card>
    </div>

    <p v-if="!stripeConfigured()" class="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
      Stripe is not configured on this build, so paid plan checkout is unavailable.
    </p>

    <!-- subscribe modal -->
    <Modal v-model:open="showSub" :title="`Subscribe to ${chosen?.name || ''}`">
      <div v-if="chosen" class="mb-4 flex items-baseline gap-1">
        <span class="text-2xl font-extrabold">{{ moneyCents(chosen.price_cents, chosen.currency) }}</span>
        <span class="text-sm text-muted-foreground">/{{ chosen.interval }}</span>
      </div>
      <div v-if="cardReady">
        <Label class="mb-1.5 block">Name on card</Label>
        <Input v-model="name" class="mb-4" placeholder="Full name" />
        <div ref="cardEl" class="rounded-md border p-3" />
        <p class="mt-2 text-xs text-muted-foreground">Test with 4242 4242 4242 4242, any future date, any CVC.</p>
      </div>
      <p v-else class="text-sm text-muted-foreground">This plan is free or Stripe is not configured — confirm to activate.</p>
      <template #footer>
        <Button variant="outline" @click="showSub = false">Cancel</Button>
        <Button :loading="!!busyPlan" @click="confirmSubscribe"><CreditCard class="h-4 w-4" /> Confirm subscription</Button>
      </template>
    </Modal>
  </div>
</template>

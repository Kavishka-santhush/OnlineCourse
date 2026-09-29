<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Check, Sparkles } from 'lucide-vue-next';
import { Button, Card, Badge, Skeleton } from '@/components/ui';
import { api } from '@/lib/api.js';
import { moneyCents } from '@/lib/utils.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';

const auth = useAuthStore();
const ui = useUiStore();
const router = useRouter();
const plans = ref([]);
const loading = ref(true);
const busy = ref('');

async function load() {
  loading.value = true;
  try { plans.value = (await api.get('/subscriptions/plans')).plans || []; }
  finally { loading.value = false; }
}
onMounted(load);

async function choose(plan) {
  if (!auth.isAuthed) return router.push({ name: 'sign-in', query: { redirect: '/pricing' } });
  if (plan.price_cents === 0) return router.push({ name: 'student-dashboard' });
  busy.value = plan.id;
  try {
    await api.post('/subscriptions/subscribe', { plan_id: plan.id });
    ui.toast.success(`You're subscribed to ${plan.name}!`);
    await auth.refresh();
    router.push({ name: 'subscriptions' });
  } catch (e) {
    ui.toast.error(e.message || 'Could not start subscription');
  } finally {
    busy.value = '';
  }
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
    <div class="text-center">
      <Badge variant="secondary" class="mb-3 gap-1"><Sparkles class="h-3.5 w-3.5" /> Subscription plans</Badge>
      <h1 class="text-4xl font-extrabold tracking-tight">Unlimited learning, one price</h1>
      <p class="mx-auto mt-3 max-w-2xl text-muted-foreground">
        Subscribe for full access to our catalog, or buy individual courses à la carte.
        Cancel anytime.
      </p>
    </div>

    <div class="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <template v-if="loading">
        <Skeleton v-for="i in 4" :key="i" class="h-96 rounded-2xl" />
      </template>
      <Card v-else v-for="p in plans" :key="p.id"
        :class="['relative flex flex-col p-6', p.slug === 'pro' ? 'ring-2 ring-primary' : '']">
        <Badge v-if="p.slug === 'pro'" class="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>
        <h3 class="text-lg font-bold">{{ p.name }}</h3>
        <p class="mt-1 text-sm text-muted-foreground">{{ p.description }}</p>
        <div class="mt-4 flex items-baseline gap-1">
          <span class="text-4xl font-extrabold">{{ p.price_cents === 0 ? 'Free' : moneyCents(p.price_cents, p.currency) }}</span>
          <span v-if="p.price_cents" class="text-sm text-muted-foreground">/{{ p.interval }}</span>
        </div>
        <ul class="mt-6 flex-1 space-y-2.5 text-sm">
          <li v-for="(f, i) in (Array.isArray(p.features) ? p.features : [])" :key="i" class="flex gap-2">
            <Check class="mt-0.5 h-4 w-4 shrink-0 text-primary" /> <span>{{ typeof f === 'string' ? f : f.label || f.name }}</span>
          </li>
          <li v-if="p.team_seats" class="flex gap-2"><Check class="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {{ p.team_seats }} team seats</li>
        </ul>
        <Button class="mt-6" :variant="p.slug === 'pro' ? 'default' : 'outline'" :loading="busy === p.id" @click="choose(p)">
          {{ p.price_cents === 0 ? 'Get started' : 'Choose ' + p.name }}
        </Button>
      </Card>
    </div>

    <p class="mt-8 text-center text-sm text-muted-foreground">
      Prefer one-off courses? <router-link to="/courses" class="text-primary hover:underline">Browse the catalog →</router-link>
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Wallet, TrendingUp, Landmark, Download, Loader2, CreditCard } from 'lucide-vue-next';
import { Card, Button, Badge, Input, Label, Modal, Select } from '@/components/ui';
import StatCard from '@/components/feature/StatCard.vue';
import BaseChart from '@/components/feature/BaseChart.vue';
import { api } from '@/lib/api.js';
import { moneyCents, formatDate } from '@/lib/utils.js';
import { useUiStore } from '@/stores/ui.js';

const ui = useUiStore();
const loading = ref(true);
const stats = ref(null);
const perCourse = ref([]);
const monthly = ref([]);
const payouts = ref([]);

const requestOpen = ref(false);
const amount = ref('');
const method = ref('bank');
const submitting = ref(false);

const statusVariant = { paid: 'success', pending: 'muted', processing: 'outline', rejected: 'destructive', failed: 'destructive' };

const available = computed(() => stats.value?.pendingPayout || 0);

const chartData = computed(() => ({
  labels: monthly.value.map((m) => m.month),
  datasets: [{ label: 'Earnings', data: monthly.value.map((m) => Math.round(m.cents / 100)) }],
}));

async function load() {
  loading.value = true;
  try {
    const [dash, earn, po] = await Promise.all([
      api.get('/instructors/me/dashboard'),
      api.get('/instructors/me/earnings'),
      api.get('/instructors/me/payouts'),
    ]);
    stats.value = dash.stats;
    perCourse.value = (earn.perCourse || []).filter((c) => c.earnings_cents > 0).sort((a, b) => b.earnings_cents - a.earnings_cents);
    monthly.value = earn.monthly || [];
    payouts.value = po.payouts || [];
  } catch (e) { ui.toast.error(e.message || 'Could not load earnings'); }
  finally { loading.value = false; }
}

async function requestPayout() {
  const cents = Math.round(Number(amount.value) * 100);
  if (!cents || cents <= 0) return ui.toast.error('Enter an amount');
  if (cents > available.value) return ui.toast.error(`Only ${moneyCents(available.value)} available`);
  submitting.value = true;
  try {
    await api.post('/instructors/me/payout-request', { amount_cents: cents, method: method.value });
    ui.toast.success('Payout requested');
    requestOpen.value = false; amount.value = '';
    await load();
  } catch (e) { ui.toast.error(e.message || 'Request failed'); }
  finally { submitting.value = false; }
}

async function connectStripe() {
  try {
    const { onboardingUrl } = await api.post('/instructors/me/stripe-connect');
    if (onboardingUrl) window.location.href = onboardingUrl;
  } catch (e) { ui.toast.error(e.message || 'Stripe Connect unavailable'); }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-bold"><Wallet class="h-6 w-6" /> Earnings & payouts</h1>
        <p class="mt-1 text-sm text-muted-foreground">Track revenue and withdraw your balance.</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" @click="connectStripe"><CreditCard class="h-4 w-4" /> Stripe Connect</Button>
        <Button :disabled="!available" @click="requestOpen = true"><Download class="h-4 w-4" /> Withdraw</Button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-16"><Loader2 class="h-6 w-6 animate-spin text-muted-foreground" /></div>

    <div v-else class="space-y-6">
      <div class="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total earned" :value="moneyCents(stats?.totalEarnings || 0)" :icon="TrendingUp" hint="lifetime gross" />
        <StatCard label="Available" :value="moneyCents(available)" :icon="Wallet" hint="ready to withdraw" />
        <StatCard label="Paid out" :value="moneyCents(stats?.paidOut || 0)" :icon="Landmark" hint="withdrawn" />
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <Card class="p-5">
          <h2 class="mb-3 font-semibold">Monthly earnings</h2>
          <BaseChart v-if="monthly.length" type="bar" :data="chartData" :height="260" />
          <p v-else class="py-10 text-center text-sm text-muted-foreground">No sales yet.</p>
        </Card>
        <Card class="p-5">
          <h2 class="mb-3 font-semibold">By course</h2>
          <div v-if="perCourse.length" class="space-y-2">
            <div v-for="c in perCourse" :key="c.course_id" class="flex items-center justify-between text-sm">
              <span class="truncate pr-3">{{ c.title }}</span>
              <span class="shrink-0 font-semibold">{{ moneyCents(c.earnings_cents) }}</span>
            </div>
          </div>
          <p v-else class="py-10 text-center text-sm text-muted-foreground">No course earnings yet.</p>
        </Card>
      </div>

      <Card class="overflow-hidden">
        <div class="border-b px-5 py-3.5"><h2 class="font-semibold">Payout history</h2></div>
        <table v-if="payouts.length" class="w-full text-sm">
          <thead class="bg-muted/40 text-left text-muted-foreground">
            <tr><th class="px-5 py-2 font-medium">Requested</th><th class="px-5 py-2 font-medium">Amount</th><th class="px-5 py-2 font-medium">Method</th><th class="px-5 py-2 font-medium">Status</th></tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="p in payouts" :key="p.id">
              <td class="px-5 py-2.5 text-muted-foreground">{{ formatDate(p.created_at) }}</td>
              <td class="px-5 py-2.5 font-medium">{{ moneyCents(p.amount_cents, p.currency) }}</td>
              <td class="px-5 py-2.5 capitalize">{{ p.method }}</td>
              <td class="px-5 py-2.5"><Badge :variant="statusVariant[p.status] || 'muted'">{{ p.status }}</Badge></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="px-5 py-8 text-center text-sm text-muted-foreground">No payouts requested yet.</p>
      </Card>
    </div>

    <Modal v-model:open="requestOpen" title="Request a payout">
      <div class="space-y-4">
        <p class="text-sm text-muted-foreground">Available balance: <span class="font-semibold text-foreground">{{ moneyCents(available) }}</span></p>
        <div>
          <Label class="mb-1.5 block">Amount (USD)</Label>
          <Input v-model="amount" type="number" min="0" step="0.01" :placeholder="`Max ${(available / 100).toFixed(2)}`" />
          <button class="mt-1 text-xs text-primary hover:underline" @click="amount = (available / 100).toFixed(2)">Withdraw all</button>
        </div>
        <div>
          <Label class="mb-1.5 block">Method</Label>
          <Select v-model="method" :options="[{ value: 'bank', label: 'Bank transfer' }, { value: 'paypal', label: 'PayPal' }]" />
        </div>
      </div>
      <template #footer>
        <Button variant="outline" @click="requestOpen = false">Cancel</Button>
        <Button :loading="submitting" @click="requestPayout"><Download class="h-4 w-4" /> Request payout</Button>
      </template>
    </Modal>
  </div>
</template>

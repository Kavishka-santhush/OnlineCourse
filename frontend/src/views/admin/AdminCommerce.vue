<script setup>
import { ref, computed, onMounted } from 'vue';
import { Package, Percent, Download, Check, X } from 'lucide-vue-next';
import { Card, Button, Badge, Input, Label, Tabs, Modal, Skeleton } from '@/components/ui';
import StatCard from '@/components/feature/StatCard.vue';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';
import { moneyCents, formatDate } from '@/lib/utils.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';

const auth = useAuthStore();
const ui = useUiStore();
const tab = ref('refunds');
const acting = ref(null);

// ── refunds ──────────────────────────────────────────────
const refundsLoading = ref(true);
const refunds = ref([]);
async function loadRefunds() {
  refundsLoading.value = true;
  try { const d = await api.get('/admin/refunds'); refunds.value = d.refunds || []; }
  catch (e) { ui.toast.error(e.message || 'Could not load refunds'); }
  finally { refundsLoading.value = false; }
}
onMounted(loadRefunds);

async function decideRefund(r, approve) {
  acting.value = r.id;
  try { await api.post(`/admin/refunds/${r.id}/decide`, { approve }); ui.toast.success(approve ? 'Refund approved' : 'Refund declined'); refunds.value = refunds.value.filter((x) => x.id !== r.id); }
  catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { acting.value = null; }
}

// ── promotions ───────────────────────────────────────────
const promosLoading = ref(false);
const promotions = ref([]);
const promoOpen = ref(false);
const promo = ref({ name: '', percent_off: '', starts_at: '', ends_at: '', coupon_code: '' });
const promoBusy = ref(false);

async function loadPromos() {
  promosLoading.value = true;
  try { const d = await api.get('/admin/promotions'); promotions.value = d.promotions || []; }
  catch (e) { ui.toast.error(e.message || 'Could not load promotions'); }
  finally { promosLoading.value = false; }
}

async function createPromo() {
  if (!promo.value.name.trim()) return ui.toast.error('Name is required');
  promoBusy.value = true;
  try {
    await api.post('/admin/promotions', {
      name: promo.value.name.trim(),
      percent_off: Number(promo.value.percent_off) || 0,
      starts_at: promo.value.starts_at ? new Date(promo.value.starts_at).toISOString() : undefined,
      ends_at: promo.value.ends_at ? new Date(promo.value.ends_at).toISOString() : undefined,
      coupon_code: promo.value.coupon_code.trim() || null,
    });
    ui.toast.success('Promotion created');
    promoOpen.value = false;
    promo.value = { name: '', percent_off: '', starts_at: '', ends_at: '', coupon_code: '' };
    await loadPromos();
  } catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { promoBusy.value = false; }
}

// ── reports ──────────────────────────────────────────────
const reportsLoading = ref(false);
const revenue = ref(null);
const exporting = ref(null);
const gross = computed(() => revenue.value?.totals?.gross || 0);
const commission = computed(() => revenue.value?.totals?.commission || 0);
const byCategory = computed(() => revenue.value?.byCategory || []);

async function loadReports() {
  reportsLoading.value = true;
  try { revenue.value = await api.get('/admin/revenue'); }
  catch (e) { ui.toast.error(e.message || 'Could not load revenue'); }
  finally { reportsLoading.value = false; }
}

async function exportReport(kind, format) {
  exporting.value = `${kind}:${format}`;
  try {
    const { url } = await api.post('/admin/reports/export', { kind, format });
    if (url) window.open(url, '_blank');
    else ui.toast.error('No file returned');
  } catch (e) { ui.toast.error(e.message || 'Export failed'); }
  finally { exporting.value = null; }
}

function onTab(v) {
  tab.value = v;
  if (v === 'promotions' && !promotions.value.length) loadPromos();
  if (v === 'reports' && !revenue.value) loadReports();
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="flex items-center gap-2 text-2xl font-bold"><Package class="h-6 w-6" /> Commerce</h1>
      <p class="mt-1 text-sm text-muted-foreground">Refunds, promotions and revenue reporting.</p>
    </div>

    <Tabs :model-value="tab" :tabs="[{ value: 'refunds', label: 'Refunds' }, { value: 'promotions', label: 'Promotions' }, { value: 'reports', label: 'Reports' }]" class="mb-5" @update:model-value="onTab" />

    <!-- Refunds -->
    <div v-if="tab === 'refunds'">
      <div v-if="refundsLoading" class="space-y-3"><Skeleton v-for="i in 4" :key="i" class="h-20 rounded-xl" /></div>
      <div v-else-if="refunds.length" class="space-y-3">
        <Card v-for="r in refunds" :key="r.id" class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <div class="font-medium">{{ r.user?.display_name }} <span class="text-xs font-normal text-muted-foreground">({{ r.user?.email }})</span></div>
            <p class="text-xs text-muted-foreground">Order {{ formatDate(r.created_at) }} · {{ moneyCents(r.amount_cents) }}</p>
          </div>
          <div class="flex shrink-0 gap-2">
            <Button size="sm" :loading="acting === r.id" @click="decideRefund(r, true)"><Check class="h-4 w-4" /> Approve</Button>
            <Button variant="outline" size="sm" :disabled="acting === r.id" @click="decideRefund(r, false)"><X class="h-4 w-4" /> Decline</Button>
          </div>
        </Card>
      </div>
      <EmptyState v-else :icon="Package" title="No pending refunds" description="Refund requests will appear here." />
    </div>

    <!-- Promotions -->
    <div v-else-if="tab === 'promotions'">
      <div class="mb-4 flex justify-end">
        <Button v-if="auth.isSuperAdmin" @click="promoOpen = true"><Percent class="h-4 w-4" /> New promotion</Button>
      </div>
      <div v-if="promosLoading" class="space-y-2"><Skeleton v-for="i in 4" :key="i" class="h-16 rounded-lg" /></div>
      <Card v-else-if="promotions.length" class="overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-muted/40 text-left text-muted-foreground">
            <tr><th class="px-4 py-2.5 font-medium">Name</th><th class="px-4 py-2.5 font-medium">Discount</th><th class="px-4 py-2.5 font-medium">Coupon</th><th class="px-4 py-2.5 font-medium">Window</th><th class="px-4 py-2.5 font-medium">Status</th></tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="p in promotions" :key="p.id">
              <td class="px-4 py-2.5 font-medium">{{ p.name }}</td>
              <td class="px-4 py-2.5">{{ p.percent_off }}%</td>
              <td class="px-4 py-2.5">{{ p.coupon_code || '—' }}</td>
              <td class="px-4 py-2.5 text-muted-foreground">{{ p.starts_at ? formatDate(p.starts_at) : '—' }} → {{ p.ends_at ? formatDate(p.ends_at) : '—' }}</td>
              <td class="px-4 py-2.5"><Badge :variant="p.active ? 'success' : 'muted'">{{ p.active ? 'active' : 'inactive' }}</Badge></td>
            </tr>
          </tbody>
        </table>
      </Card>
      <EmptyState v-else :icon="Percent" title="No promotions" description="Create a flash sale to get started." />
    </div>

    <!-- Reports -->
    <div v-else>
      <div v-if="reportsLoading" class="space-y-4"><Skeleton class="h-28 rounded-xl" /><Skeleton class="h-64 rounded-xl" /></div>
      <div v-else class="space-y-6">
        <div class="grid gap-4 sm:grid-cols-3">
          <StatCard label="Gross revenue" :value="moneyCents(gross)" :icon="Package" hint="all paid orders" />
          <StatCard label="Commission" :value="moneyCents(commission)" :icon="Percent" hint="platform share" />
          <StatCard label="To instructors" :value="moneyCents(gross - commission)" :icon="Download" hint="net payouts" />
        </div>

        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" :loading="exporting === 'revenue:pdf'" @click="exportReport('revenue', 'pdf')"><Download class="h-4 w-4" /> Revenue PDF</Button>
          <Button variant="outline" size="sm" :loading="exporting === 'revenue:csv'" @click="exportReport('revenue', 'csv')"><Download class="h-4 w-4" /> Revenue CSV</Button>
          <Button variant="outline" size="sm" :loading="exporting === 'enrollments:csv'" @click="exportReport('enrollments', 'csv')"><Download class="h-4 w-4" /> Enrollments CSV</Button>
        </div>

        <Card class="overflow-hidden">
          <div class="border-b px-5 py-3.5"><h2 class="font-semibold">Revenue by category</h2></div>
          <table v-if="byCategory.length" class="w-full text-sm">
            <tbody class="divide-y">
              <tr v-for="c in byCategory" :key="c.category">
                <td class="px-5 py-2.5 font-medium">{{ c.category }}</td>
                <td class="px-5 py-2.5 text-right">{{ moneyCents(c.cents) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="px-5 py-8 text-center text-sm text-muted-foreground">No data yet.</p>
        </Card>
      </div>
    </div>

    <!-- Promotion modal -->
    <Modal v-model:open="promoOpen" title="New promotion">
      <div class="space-y-4">
        <div><Label class="mb-1.5 block">Name</Label><Input v-model="promo.name" placeholder="Summer sale" /></div>
        <div><Label class="mb-1.5 block">Percent off</Label><Input v-model="promo.percent_off" type="number" min="0" max="100" placeholder="20" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><Label class="mb-1.5 block">Starts</Label><Input v-model="promo.starts_at" type="datetime-local" /></div>
          <div><Label class="mb-1.5 block">Ends</Label><Input v-model="promo.ends_at" type="datetime-local" /></div>
        </div>
        <div><Label class="mb-1.5 block">Coupon code (optional)</Label><Input v-model="promo.coupon_code" placeholder="SUMMER20" /></div>
      </div>
      <template #footer>
        <Button variant="outline" @click="promoOpen = false">Cancel</Button>
        <Button :loading="promoBusy" @click="createPromo">Create</Button>
      </template>
    </Modal>
  </div>
</template>

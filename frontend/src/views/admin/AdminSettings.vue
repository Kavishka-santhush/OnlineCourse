<script setup>
import { ref, computed, reactive, onMounted } from 'vue';
import { SlidersHorizontal, Cpu, ScrollText, Save } from 'lucide-vue-next';
import { Card, Button, Badge, Input, Label, Tabs, Select, Switch, Skeleton } from '@/components/ui';
import StatCard from '@/components/feature/StatCard.vue';
import BaseChart from '@/components/feature/BaseChart.vue';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';
import { formatDate, compact } from '@/lib/utils.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';

const auth = useAuthStore();
const ui = useUiStore();
const tab = ref('general');

// ── general settings ─────────────────────────────────────
const settingsLoading = ref(true);
const saving = ref(false);
const s = reactive({
  platform_name: '', commission_percent: 20, refund_policy_days: 30, refund_max_completion_percent: 30,
  payout_min_cents: 5000, default_role: 'student', require_instructor_approval: true, ai_enabled: true,
  subscription_enabled: true, referral_reward_cents: 1000, loyalty_point_value_cents: 1,
});
const rawExtra = ref({}); // preserve unknown keys
const roleOptions = [
  { value: 'student', label: 'Student' }, { value: 'instructor', label: 'Instructor' },
];

const KNOWN = Object.keys(s);

async function loadSettings() {
  settingsLoading.value = true;
  try {
    const { settings } = await api.get('/admin/settings');
    for (const k of KNOWN) if (k in settings) s[k] = settings[k];
    rawExtra.value = Object.fromEntries(Object.entries(settings).filter(([k]) => !KNOWN.includes(k)));
  } catch (e) { ui.toast.error(e.message || 'Could not load settings'); }
  finally { settingsLoading.value = false; }
}
onMounted(loadSettings);

async function saveSettings() {
  if (!auth.isSuperAdmin) return;
  saving.value = true;
  try {
    const { settings } = await api.patch('/admin/settings', { settings: { ...rawExtra.value, ...s } });
    rawExtra.value = Object.fromEntries(Object.entries(settings).filter(([k]) => !KNOWN.includes(k)));
    ui.toast.success('Settings saved');
  } catch (e) { ui.toast.error(e.message || 'Save failed'); }
  finally { saving.value = false; }
}

// ── AI usage ─────────────────────────────────────────────
const aiLoading = ref(false);
const ai = ref(null);
const aiChart = computed(() => {
  const entries = Object.entries(ai.value?.byFeature || {});
  return { labels: entries.map(([k]) => k), datasets: [{ label: 'Tokens', data: entries.map(([, v]) => v) }] };
});
async function loadAi() {
  aiLoading.value = true;
  try { ai.value = await api.get('/admin/ai-usage'); }
  catch (e) { ui.toast.error(e.message || 'Could not load AI usage'); }
  finally { aiLoading.value = false; }
}

// ── audit log ────────────────────────────────────────────
const logLoading = ref(false);
const logs = ref([]);
async function loadLogs() {
  logLoading.value = true;
  try { const d = await api.get('/admin/audit-log?limit=100'); logs.value = d.logs || []; }
  catch (e) { ui.toast.error(e.message || 'Could not load audit log'); }
  finally { logLoading.value = false; }
}

function onTab(v) {
  tab.value = v;
  if (v === 'ai' && !ai.value) loadAi();
  if (v === 'audit' && !logs.value.length) loadLogs();
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="flex items-center gap-2 text-2xl font-bold"><SlidersHorizontal class="h-6 w-6" /> Settings</h1>
      <p class="mt-1 text-sm text-muted-foreground">Platform configuration, AI usage and the audit trail.</p>
    </div>

    <Tabs :model-value="tab" :tabs="[{ value: 'general', label: 'General' }, { value: 'ai', label: 'AI usage' }, { value: 'audit', label: 'Audit log' }]" class="mb-5" @update:model-value="onTab" />

    <!-- General -->
    <div v-if="tab === 'general'">
      <p v-if="!auth.isSuperAdmin" class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">You have read-only access. Only super admins can change settings.</p>
      <div v-if="settingsLoading" class="space-y-3"><Skeleton v-for="i in 5" :key="i" class="h-16 rounded-lg" /></div>
      <Card v-else class="max-w-2xl space-y-5 p-5">
        <div><Label class="mb-1.5 block">Platform name</Label><Input v-model="s.platform_name" :disabled="!auth.isSuperAdmin" /></div>
        <div class="grid grid-cols-2 gap-4">
          <div><Label class="mb-1.5 block">Commission %</Label><Input v-model.number="s.commission_percent" type="number" min="0" max="100" :disabled="!auth.isSuperAdmin" /></div>
          <div><Label class="mb-1.5 block">Default role</Label><Select v-model="s.default_role" :options="roleOptions" :disabled="!auth.isSuperAdmin" /></div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div><Label class="mb-1.5 block">Refund window (days)</Label><Input v-model.number="s.refund_policy_days" type="number" min="0" :disabled="!auth.isSuperAdmin" /></div>
          <div><Label class="mb-1.5 block">Refund max completion %</Label><Input v-model.number="s.refund_max_completion_percent" type="number" min="0" max="100" :disabled="!auth.isSuperAdmin" /></div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div><Label class="mb-1.5 block">Min payout (USD)</Label><Input :model-value="(s.payout_min_cents / 100).toFixed(2)" type="number" step="0.01" :disabled="!auth.isSuperAdmin" @update:model-value="(v) => s.payout_min_cents = Math.round(Number(v) * 100)" /></div>
          <div><Label class="mb-1.5 block">Referral reward (USD)</Label><Input :model-value="(s.referral_reward_cents / 100).toFixed(2)" type="number" step="0.01" :disabled="!auth.isSuperAdmin" @update:model-value="(v) => s.referral_reward_cents = Math.round(Number(v) * 100)" /></div>
        </div>
        <div class="space-y-3 border-t pt-4">
          <label class="flex items-center justify-between text-sm"><span>Require instructor approval</span><Switch v-model="s.require_instructor_approval" :disabled="!auth.isSuperAdmin" /></label>
          <label class="flex items-center justify-between text-sm"><span>Enable AI features</span><Switch v-model="s.ai_enabled" :disabled="!auth.isSuperAdmin" /></label>
          <label class="flex items-center justify-between text-sm"><span>Enable subscriptions</span><Switch v-model="s.subscription_enabled" :disabled="!auth.isSuperAdmin" /></label>
        </div>
        <div v-if="auth.isSuperAdmin" class="flex justify-end border-t pt-4"><Button :loading="saving" @click="saveSettings"><Save class="h-4 w-4" /> Save changes</Button></div>
      </Card>
    </div>

    <!-- AI usage -->
    <div v-else-if="tab === 'ai'">
      <div v-if="aiLoading" class="space-y-4"><div class="grid gap-4 sm:grid-cols-3"><Skeleton v-for="i in 3" :key="i" class="h-28 rounded-xl" /></div><Skeleton class="h-72 rounded-xl" /></div>
      <div v-else-if="ai" class="space-y-6">
        <div class="grid gap-4 sm:grid-cols-3">
          <StatCard label="AI calls" :value="compact(ai.calls)" :icon="Cpu" hint="recent" />
          <StatCard label="Total tokens" :value="compact(ai.totalTokens)" :icon="Cpu" />
          <StatCard label="Est. cost" :value="'$' + Number(ai.estimatedCostUsd).toFixed(3)" :icon="Cpu" hint="illustrative" />
        </div>
        <Card class="p-5">
          <h2 class="mb-3 font-semibold">Tokens by feature</h2>
          <BaseChart v-if="aiChart.labels.length" type="bar" :data="aiChart" :height="300" />
          <p v-else class="py-10 text-center text-sm text-muted-foreground">No AI activity recorded yet.</p>
        </Card>
      </div>
      <EmptyState v-else :icon="Cpu" title="No data" description="AI usage will appear once features are used." />
    </div>

    <!-- Audit log -->
    <div v-else>
      <div v-if="logLoading" class="space-y-2 p-4"><Skeleton v-for="i in 8" :key="i" class="h-12 rounded-lg" /></div>
      <Card v-else-if="logs.length" class="overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/40 text-left text-muted-foreground">
              <tr><th class="px-4 py-2.5 font-medium">When</th><th class="px-4 py-2.5 font-medium">Actor</th><th class="px-4 py-2.5 font-medium">Action</th><th class="px-4 py-2.5 font-medium">Entity</th></tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="l in logs" :key="l.id">
                <td class="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{{ formatDate(l.created_at) }}</td>
                <td class="px-4 py-2.5">{{ l.actor_email || '—' }}</td>
                <td class="px-4 py-2.5"><Badge variant="outline">{{ l.action }}</Badge></td>
                <td class="px-4 py-2.5 text-muted-foreground">{{ l.entity_type }}<span v-if="l.entity_id" class="opacity-60"> · {{ String(l.entity_id).slice(0, 8) }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <EmptyState v-else :icon="ScrollText" title="No audit entries" description="Administrative actions are logged here." />
    </div>
  </div>
</template>

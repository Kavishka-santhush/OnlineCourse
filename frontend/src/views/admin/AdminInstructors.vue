<script setup>
import { ref, onMounted } from 'vue';
import { GraduationCap, Wallet, Check, X, ExternalLink } from 'lucide-vue-next';
import { Card, Button, Badge, Avatar, Tabs, Modal, Textarea, Label, Skeleton } from '@/components/ui';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';
import { moneyCents, formatDate } from '@/lib/utils.js';
import { useUiStore } from '@/stores/ui.js';

const ui = useUiStore();
const tab = ref('applications');

// ── applications ─────────────────────────────────────────
const appsLoading = ref(true);
const applications = ref([]);
const appStatus = ref('pending');
const rejecting = ref(null);
const reason = ref('');
const acting = ref(null);

async function loadApps() {
  appsLoading.value = true;
  try { const d = await api.get(`/admin/applications?status=${appStatus.value}`); applications.value = d.applications || []; }
  catch (e) { ui.toast.error(e.message || 'Could not load applications'); }
  finally { appsLoading.value = false; }
}
onMounted(loadApps);

function expertiseList(v) {
  if (Array.isArray(v)) return v;
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
}

async function decide(app, decision) {
  if (decision === 'reject' && !reason.value.trim()) return ui.toast.error('A reason is required');
  acting.value = app.id;
  try {
    await api.post(`/admin/applications/${app.id}/decide`, { decision, reason: reason.value.trim() || undefined });
    ui.toast.success(decision === 'approve' ? 'Applicant approved' : 'Application rejected');
    rejecting.value = null; reason.value = '';
    applications.value = applications.value.filter((a) => a.id !== app.id);
  } catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { acting.value = null; }
}

// ── payouts ──────────────────────────────────────────────
const payLoading = ref(false);
const payouts = ref([]);
const payoutVariant = { pending: 'muted', processing: 'outline', paid: 'success', rejected: 'destructive', failed: 'destructive' };

async function loadPayouts() {
  payLoading.value = true;
  try { const d = await api.get('/admin/payouts'); payouts.value = d.payouts || []; }
  catch (e) { ui.toast.error(e.message || 'Could not load payouts'); }
  finally { payLoading.value = false; }
}

function onTab(v) { tab.value = v; if (v === 'payouts' && !payouts.value.length) loadPayouts(); }

async function payoutAction(p, action) {
  acting.value = p.id;
  try { await api.post(`/admin/payouts/${p.id}/decide`, { action }); ui.toast.success('Payout updated'); await loadPayouts(); }
  catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { acting.value = null; }
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="flex items-center gap-2 text-2xl font-bold"><GraduationCap class="h-6 w-6" /> Instructors</h1>
      <p class="mt-1 text-sm text-muted-foreground">Approve applications and process payout requests.</p>
    </div>

    <Tabs :model-value="tab" :tabs="[{ value: 'applications', label: 'Applications' }, { value: 'payouts', label: 'Payouts' }]" class="mb-5" @update:model-value="onTab" />

    <!-- Applications -->
    <div v-if="tab === 'applications'">
      <div class="mb-4 flex items-center gap-2">
        <span class="text-sm text-muted-foreground">Show:</span>
        <Button :variant="appStatus === 'pending' ? 'default' : 'outline'" size="sm" @click="appStatus = 'pending'; loadApps()">Pending</Button>
        <Button :variant="appStatus === 'approved' ? 'default' : 'outline'" size="sm" @click="appStatus = 'approved'; loadApps()">Approved</Button>
        <Button :variant="appStatus === 'rejected' ? 'default' : 'outline'" size="sm" @click="appStatus = 'rejected'; loadApps()">Rejected</Button>
      </div>

      <div v-if="appsLoading" class="space-y-3"><Skeleton v-for="i in 4" :key="i" class="h-32 rounded-xl" /></div>
      <div v-else-if="applications.length" class="space-y-3">
        <Card v-for="a in applications" :key="a.id" class="p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <Avatar :src="a.user?.avatar_url" :name="a.user?.display_name" size="md" />
              <div>
                <div class="font-semibold">{{ a.user?.display_name }}</div>
                <div class="text-xs text-muted-foreground">{{ a.user?.email }} · applied {{ formatDate(a.created_at) }}</div>
              </div>
            </div>
            <div v-if="appStatus === 'pending'" class="flex gap-2">
              <Button size="sm" :loading="acting === a.id" @click="decide(a, 'approve')"><Check class="h-4 w-4" /> Approve</Button>
              <Button variant="outline" size="sm" :disabled="acting === a.id" @click="rejecting = a; reason = ''"><X class="h-4 w-4" /> Reject</Button>
            </div>
            <Badge v-else :variant="a.status === 'approved' ? 'success' : 'destructive'">{{ a.status }}</Badge>
          </div>
          <p class="mt-3 text-sm text-muted-foreground">{{ a.bio }}</p>
          <div v-if="expertiseList(a.expertise).length" class="mt-2 flex flex-wrap gap-1.5">
            <Badge v-for="t in expertiseList(a.expertise)" :key="t" variant="secondary">{{ t }}</Badge>
          </div>
          <a v-if="a.sample_content_url" :href="a.sample_content_url" target="_blank" rel="noopener" class="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"><ExternalLink class="h-3.5 w-3.5" /> Sample content</a>
        </Card>
      </div>
      <EmptyState v-else :icon="GraduationCap" title="Nothing here" description="No applications with this status." />
    </div>

    <!-- Payouts -->
    <div v-else>
      <div v-if="payLoading" class="space-y-2 p-4"><Skeleton v-for="i in 5" :key="i" class="h-14 rounded-lg" /></div>
      <Card v-else-if="payouts.length" class="overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/40 text-left text-muted-foreground">
              <tr><th class="px-4 py-2.5 font-medium">Instructor</th><th class="px-4 py-2.5 font-medium">Amount</th><th class="px-4 py-2.5 font-medium">Method</th><th class="px-4 py-2.5 font-medium">Status</th><th class="px-4 py-2.5 font-medium">Requested</th><th class="px-4 py-2.5 text-right font-medium">Actions</th></tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="p in payouts" :key="p.id">
                <td class="px-4 py-2.5"><div class="font-medium">{{ p.instructor?.display_name }}</div><div class="text-xs text-muted-foreground">{{ p.instructor?.email }}</div></td>
                <td class="px-4 py-2.5 font-semibold">{{ moneyCents(p.amount_cents, p.currency) }}</td>
                <td class="px-4 py-2.5 capitalize">{{ p.method }}</td>
                <td class="px-4 py-2.5"><Badge :variant="payoutVariant[p.status] || 'muted'">{{ p.status }}</Badge></td>
                <td class="px-4 py-2.5 text-muted-foreground">{{ formatDate(p.created_at) }}</td>
                <td class="px-4 py-2.5">
                  <div class="flex justify-end gap-1">
                    <template v-if="p.status === 'pending'">
                      <Button size="sm" variant="outline" :disabled="acting === p.id" @click="payoutAction(p, 'approve')"><Check class="h-4 w-4" /> Approve</Button>
                      <Button size="sm" variant="destructive" :disabled="acting === p.id" @click="payoutAction(p, 'reject')"><X class="h-4 w-4" /></Button>
                    </template>
                    <Button v-else-if="p.status === 'processing'" size="sm" :disabled="acting === p.id" @click="payoutAction(p, 'pay')"><Wallet class="h-4 w-4" /> Mark paid</Button>
                    <span v-else class="text-xs text-muted-foreground">—</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <EmptyState v-else :icon="Wallet" title="No payouts" description="No payout requests yet." />
    </div>

    <Modal v-model:open="rejecting" title="Reject application">
      <div>
        <Label class="mb-1.5 block">Reason (shared with the applicant)</Label>
        <Textarea v-model="reason" rows="4" placeholder="Why is this being rejected?" />
      </div>
      <template #footer>
        <Button variant="outline" @click="rejecting = null">Cancel</Button>
        <Button variant="destructive" :loading="!!acting" @click="decide(rejecting, 'reject')">Reject</Button>
      </template>
    </Modal>
  </div>
</template>

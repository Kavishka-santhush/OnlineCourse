<script setup>
import { ref, onMounted } from 'vue';
import { Receipt, RotateCcw, Loader2 } from 'lucide-vue-next';
import { Card, Button, Badge, Skeleton } from '@/components/ui';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';
import { moneyCents, formatDate } from '@/lib/utils.js';
import { useUiStore } from '@/stores/ui.js';

const ui = useUiStore();
const orders = ref([]);
const loading = ref(true);
const busy = ref(null);

const statusVariant = { paid: 'success', pending: 'muted', failed: 'destructive', refunded: 'outline', cancelled: 'secondary' };

onMounted(async () => {
  try { orders.value = (await api.get('/payments/orders')).orders || []; }
  catch (e) { ui.toast.error(e.message || 'Could not load orders'); }
  finally { loading.value = false; }
});

async function requestRefund(o) {
  if (!confirm('Request a refund for this order?')) return;
  busy.value = o.id;
  try {
    await api.post('/payments/refund-request', { order_id: o.id });
    ui.toast.success('Refund request submitted for review');
    o.status = 'refunded';
  } catch (e) { ui.toast.error(e.message || 'Refund request failed'); }
  finally { busy.value = null; }
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="flex items-center gap-2 text-2xl font-bold"><Receipt class="h-6 w-6" /> Order history</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ orders.length }} orders</p>
    </div>

    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="i in 4" :key="i" class="h-28 rounded-xl" />
    </div>

    <div v-else-if="orders.length" class="space-y-4">
      <Card v-for="o in orders" :key="o.id" class="overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5 text-sm">
          <div class="flex items-center gap-3">
            <span class="font-medium">Order #{{ o.id.slice(0, 8) }}</span>
            <Badge :variant="statusVariant[o.status] || 'muted'">{{ o.status }}</Badge>
          </div>
          <span class="text-muted-foreground">{{ formatDate(o.created_at) }}</span>
        </div>
        <div class="divide-y">
          <div v-for="(it, i) in (o.items || [])" :key="i" class="flex items-center justify-between px-4 py-3">
            <span class="text-sm">{{ it.title }}</span>
            <span class="text-sm text-muted-foreground">{{ moneyCents(it.price_cents, o.currency) }}</span>
          </div>
          <div v-if="!o.items?.length" class="px-4 py-3 text-sm text-muted-foreground">No line items.</div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
          <div class="text-sm">
            <span v-if="o.discount_cents" class="mr-3 text-emerald-600">−{{ moneyCents(o.discount_cents, o.currency) }} discount</span>
            <span class="font-semibold">Total: {{ moneyCents(o.total_cents, o.currency) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <Button v-if="o.status === 'paid'" size="sm" variant="outline" :disabled="busy === o.id" @click="requestRefund(o)">
              <Loader2 v-if="busy === o.id" class="h-4 w-4 animate-spin" /><RotateCcw v-else class="h-4 w-4" /> Request refund
            </Button>
            <Button v-if="o.status === 'refunded'" size="sm" variant="ghost" disabled><RotateCcw class="h-4 w-4" /> Refunded</Button>
          </div>
        </div>
      </Card>
    </div>

    <EmptyState v-else :icon="Receipt" title="No orders yet"
      description="Your purchases and their receipts will appear here.">
      <RouterLink to="/courses"><Button>Browse the catalog</Button></RouterLink>
    </EmptyState>
  </div>
</template>

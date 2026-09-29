<script setup>
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { Trash2, ShoppingCart, Tag, ArrowRight, X } from 'lucide-vue-next';
import { Button, Card, Input, Badge } from '@/components/ui';
import EmptyState from '@/components/feature/EmptyState.vue';
import { useCartStore } from '@/stores/cart.js';
import { useUiStore } from '@/stores/ui.js';
import { money, moneyCents } from '@/lib/utils.js';

const cart = useCartStore();
const ui = useUiStore();
const router = useRouter();
const code = ref('');
const applying = ref(false);

async function applyCoupon() {
  if (!code.value) return;
  applying.value = true;
  const ok = await cart.applyCoupon(code.value.toUpperCase());
  if (ok) { ui.toast.success('Coupon applied'); code.value = ''; }
  else ui.toast.error(cart.couponError || 'Invalid coupon');
  applying.value = false;
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
    <h1 class="text-2xl font-bold">Shopping cart</h1>

    <div v-if="!cart.count" class="mt-8">
      <EmptyState icon="cart" title="Your cart is empty" description="Browse the catalog and add courses to get started.">
        <Button to="/courses">Explore courses</Button>
      </EmptyState>
    </div>

    <div v-else class="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
      <div class="space-y-4">
        <Card v-for="item in cart.items" :key="item.id" class="flex items-center gap-4 p-4">
          <RouterLink :to="{ name: 'course-detail', params: { slug: item.slug } }" class="shrink-0">
            <div class="h-20 w-32 overflow-hidden rounded-lg bg-muted">
              <img v-if="item.thumbnail_url" :src="item.thumbnail_url" class="h-full w-full object-cover" />
            </div>
          </RouterLink>
          <div class="min-w-0 flex-1">
            <RouterLink :to="{ name: 'course-detail', params: { slug: item.slug } }" class="line-clamp-2 font-semibold hover:text-primary">{{ item.title }}</RouterLink>
            <p class="mt-1 text-sm text-muted-foreground">{{ money(item.price, item.currency) }}</p>
          </div>
          <button class="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-destructive" @click="cart.remove(item.id)" title="Remove">
            <Trash2 class="h-4 w-4" />
          </button>
        </Card>
      </div>

      <!-- summary -->
      <div>
        <Card class="sticky top-20 p-6">
          <h2 class="font-semibold">Order summary</h2>

          <div class="mt-4 flex gap-2">
            <Input v-model="code" placeholder="Coupon code" :disabled="!!cart.coupon" />
            <Button variant="outline" :loading="applying" :disabled="!!cart.coupon" @click="applyCoupon"><Tag class="h-4 w-4" /> Apply</Button>
          </div>
          <p v-if="cart.couponError" class="mt-2 text-sm text-destructive">{{ cart.couponError }}</p>
          <div v-if="cart.coupon" class="mt-2 flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-500/10">
            <span class="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400"><Tag class="h-3.5 w-3.5" /> {{ cart.coupon.code }}</span>
            <button class="text-emerald-700 hover:underline dark:text-emerald-400" @click="cart.removeCoupon()"><X class="h-4 w-4" /></button>
          </div>

          <dl class="mt-4 space-y-2 text-sm">
            <div class="flex justify-between"><dt class="text-muted-foreground">Subtotal ({{ cart.count }})</dt><dd>{{ money(cart.subtotal) }}</dd></div>
            <div v-if="cart.discountCents" class="flex justify-between text-emerald-600"><dt>Discount</dt><dd>−{{ moneyCents(cart.discountCents) }}</dd></div>
            <div class="flex justify-between border-t pt-2 text-base font-bold"><dt>Total</dt><dd>{{ moneyCents(cart.totalCents) }}</dd></div>
          </dl>

          <Button class="mt-5 w-full" size="lg" @click="router.push({ name: 'checkout' })">
            Checkout <ArrowRight class="h-4 w-4" />
          </Button>
          <RouterLink to="/courses" class="mt-3 block text-center text-sm text-primary hover:underline">Continue shopping</RouterLink>
        </Card>
      </div>
    </div>
  </div>
</template>

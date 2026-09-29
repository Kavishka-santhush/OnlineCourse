<script setup>
import { onMounted } from 'vue';
import { Bell, Check, Trash2 } from 'lucide-vue-next';
import { Button } from '@/components/ui';
import EmptyState from '@/components/feature/EmptyState.vue';
import { useNotificationsStore } from '@/stores/notifications.js';
import { fromNow } from '@/lib/utils.js';

const notif = useNotificationsStore();
onMounted(() => notif.fetchList());

function open(n) {
  if (!n.read) notif.markRead(n.id);
  if (n.link) window.location.href = n.link;
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-bold"><Bell class="h-6 w-6" /> Notifications</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ notif.unread }} unread</p>
      </div>
      <Button v-if="notif.unread" variant="outline" size="sm" @click="notif.markAllRead()"><Check class="h-4 w-4" /> Mark all read</Button>
    </div>

    <div v-if="notif.items.length" class="space-y-2">
      <div v-for="n in notif.items" :key="n.id"
        @click="open(n)"
        :class="[
          'group flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition hover:bg-accent',
          n.read ? 'bg-transparent' : 'bg-primary/5 border-primary/20',
        ]">
        <span v-if="!n.read" class="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
        <div class="min-w-0 flex-1" :class="n.read && 'pl-5'">
          <p class="font-medium leading-tight">{{ n.title }}</p>
          <p v-if="n.body" class="mt-0.5 text-sm text-muted-foreground">{{ n.body }}</p>
          <p class="mt-1 text-xs text-muted-foreground">{{ fromNow(n.created_at) }}</p>
        </div>
        <button class="rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          @click.stop="notif.remove(n.id)"><Trash2 class="h-4 w-4" /></button>
      </div>
    </div>

    <EmptyState v-else :icon="Bell" title="You're all caught up" description="New activity will appear here." />
  </div>
</template>

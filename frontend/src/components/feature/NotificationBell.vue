<script setup>
import { Bell, CheckCheck } from 'lucide-vue-next';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui';
import { useNotificationsStore } from '@/stores/notifications.js';
import { fromNow } from '@/lib/utils.js';
import { useRouter } from 'vue-router';
const notif = useNotificationsStore();
const router = useRouter();

async function open(n) {
  await notif.markRead(n.id);
  if (n.link) router.push(n.link.startsWith('/app') ? n.link : n.link);
}
</script>
<template>
  <DropdownMenu align="right">
    <template #trigger>
      <button class="relative rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground">
        <Bell class="h-5 w-5" />
        <span v-if="notif.unread"
          class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {{ notif.unread > 9 ? '9+' : notif.unread }}
        </span>
      </button>
    </template>

    <div class="w-80">
      <div class="flex items-center justify-between px-2 py-1.5">
        <span class="text-sm font-semibold">Notifications</span>
        <button v-if="notif.unread" class="inline-flex items-center gap-1 text-xs text-primary hover:underline" @click.stop="notif.markAllRead()">
          <CheckCheck class="h-3.5 w-3.5" /> Mark all read
        </button>
      </div>
      <div class="max-h-80 overflow-y-auto">
        <p v-if="!notif.items.length" class="px-3 py-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
        <DropdownMenuItem v-for="n in notif.latest" :key="n.id" @click="open(n)"
          class="items-start">
          <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" :class="n.read ? 'bg-transparent' : 'bg-primary'" />
          <span class="min-w-0">
            <span class="block truncate text-sm font-medium">{{ n.title }}</span>
            <span v-if="n.body" class="line-clamp-2 text-xs text-muted-foreground">{{ n.body }}</span>
            <span class="text-[11px] text-muted-foreground">{{ fromNow(n.created_at) }}</span>
          </span>
        </DropdownMenuItem>
      </div>
      <DropdownMenuItem :to="{ name: 'notifications' }" class="justify-center text-center text-primary">
        View all
      </DropdownMenuItem>
    </div>
  </DropdownMenu>
</template>

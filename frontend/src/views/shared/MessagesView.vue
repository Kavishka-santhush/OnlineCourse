<script setup>
import { ref, computed, nextTick, onMounted } from 'vue';
import { MessageSquare, Send, ArrowLeft, Inbox } from 'lucide-vue-next';
import { Avatar, Badge, Button, Textarea, Skeleton } from '@/components/ui';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';
import { fromNow, truncate } from '@/lib/utils.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';

const auth = useAuthStore();
const ui = useUiStore();

const me = computed(() => auth.user?.id);
const loading = ref(true);
const conversations = ref([]);
const active = ref(null); // { user, messages }
const threadLoading = ref(false);
const draft = ref('');
const sending = ref(false);
const mobileView = ref('list'); // 'list' | 'thread'
const scroller = ref(null);

async function loadInbox() {
  loading.value = true;
  try {
    const { conversations: list } = await api.get('/messages');
    conversations.value = list || [];
  } catch (e) { ui.toast.error(e.message || 'Could not load inbox'); }
  finally { loading.value = false; }
}

async function openThread(user) {
  active.value = { user, messages: [] };
  mobileView.value = 'thread';
  threadLoading.value = true;
  try {
    const { messages } = await api.get(`/messages/thread/${user.id}`);
    active.value.messages = messages || [];
    // Mark the sidebar entry read locally.
    const convo = conversations.value.find((c) => c.user.id === user.id);
    if (convo) convo.unread = 0;
    await scrollToEnd();
  } catch (e) { ui.toast.error(e.message || 'Could not load conversation'); }
  finally { threadLoading.value = false; }
}

function closeThread() {
  active.value = null;
  mobileView.value = 'list';
}

async function scrollToEnd() {
  await nextTick();
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
}

function timeOf(d) {
  const date = new Date(d);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function send() {
  const body = draft.value.trim();
  if (!body || !active.value) return;
  sending.value = true;
  try {
    const { message } = await api.post('/messages', { recipient_id: active.value.user.id, body });
    active.value.messages.push(message);
    // Keep the sidebar preview fresh.
    const convo = conversations.value.find((c) => c.user.id === active.value.user.id);
    if (convo) { convo.last = message; }
    draft.value = '';
    await scrollToEnd();
  } catch (e) { ui.toast.error(e.message || 'Message not sent'); }
  finally { sending.value = false; }
}

function onKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send(); }
}

onMounted(loadInbox);
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="flex items-center gap-2 text-2xl font-bold"><MessageSquare class="h-6 w-6" /> Messages</h1>
      <p class="mt-1 text-sm text-muted-foreground">Chat with your instructors and students.</p>
    </div>

    <div v-if="loading" class="grid gap-4 md:grid-cols-[320px_1fr]">
      <Skeleton class="h-[60vh] rounded-xl" />
      <Skeleton class="hidden h-[60vh] rounded-xl md:block" />
    </div>

    <EmptyState v-else-if="!conversations.length" :icon="Inbox" title="No conversations yet" description="Messages from students and instructors will appear here." />

    <div v-else class="grid gap-4 md:grid-cols-[320px_1fr]">
      <!-- Conversation list -->
      <div class="overflow-hidden rounded-xl border" :class="{ 'hidden md:block': mobileView === 'thread' }">
        <div class="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold">Inbox</div>
        <ul class="max-h-[60vh] divide-y overflow-y-auto">
          <li v-for="c in conversations" :key="c.user.id">
            <button
              class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              :class="{ 'bg-muted/60': active?.user.id === c.user.id }"
              @click="openThread(c.user)"
            >
              <Avatar :src="c.user.avatar_url" :name="c.user.display_name" size="md" />
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate text-sm font-semibold">{{ c.user.display_name }}</span>
                  <span class="shrink-0 text-[11px] text-muted-foreground">{{ fromNow(c.last.created_at) }}</span>
                </div>
                <p class="mt-0.5 truncate text-xs text-muted-foreground">{{ truncate(c.last.body, 60) }}</p>
              </div>
              <Badge v-if="c.unread" class="ml-1 shrink-0">{{ c.unread }}</Badge>
            </button>
          </li>
        </ul>
      </div>

      <!-- Thread pane -->
      <div class="flex h-[60vh] flex-col overflow-hidden rounded-xl border" :class="{ 'hidden md:flex': mobileView === 'list' }">
        <template v-if="active">
          <div class="flex items-center gap-3 border-b bg-muted/40 px-4 py-2.5">
            <Button variant="ghost" size="sm" class="md:hidden" @click="closeThread"><ArrowLeft class="h-4 w-4" /> Back</Button>
            <Avatar :src="active.user.avatar_url" :name="active.user.display_name" size="sm" />
            <span class="text-sm font-semibold">{{ active.user.display_name }}</span>
          </div>

          <div ref="scroller" class="flex-1 space-y-3 overflow-y-auto p-4">
            <div v-if="threadLoading" class="grid place-items-center py-10 text-sm text-muted-foreground">Loading…</div>
            <template v-else>
              <div v-for="m in active.messages" :key="m.id" class="flex" :class="m.sender_id === me ? 'justify-end' : 'justify-start'">
                <div
                  class="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm"
                  :class="m.sender_id === me ? 'bg-primary text-primary-foreground' : 'bg-muted'"
                >
                  <p class="whitespace-pre-wrap break-words">{{ m.body }}</p>
                  <span class="mt-1 block text-right text-[10px] opacity-70">{{ timeOf(m.created_at) }}</span>
                </div>
              </div>
            </template>
          </div>

          <div class="border-t p-3">
            <Textarea
              v-model="draft"
              rows="2"
              placeholder="Write a message…  (Ctrl/⌘ + Enter to send)"
              class="resize-none"
              @keydown="onKeydown"
            />
            <div class="mt-2 flex justify-end">
              <Button size="sm" :loading="sending" :disabled="!draft.trim()" @click="send"><Send class="h-4 w-4" /> Send</Button>
            </div>
          </div>
        </template>

        <div v-else class="grid flex-1 place-items-center p-8 text-center text-sm text-muted-foreground">
          Select a conversation to start reading.
        </div>
      </div>
    </div>
  </div>
</template>

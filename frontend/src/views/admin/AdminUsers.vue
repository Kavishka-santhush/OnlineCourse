<script setup>
import { ref, onMounted } from 'vue';
import { Users, Search, Ban, Trash2, ShieldCheck, BadgeCheck } from 'lucide-vue-next';
import { Card, Button, Badge, Input, Avatar, Select, Skeleton } from '@/components/ui';
import EmptyState from '@/components/feature/EmptyState.vue';
import { api } from '@/lib/api.js';
import { formatDate } from '@/lib/utils.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';

const auth = useAuthStore();
const ui = useUiStore();

const loading = ref(true);
const users = ref([]);
const total = ref(0);
const limit = 25;
const offset = ref(0);
const q = ref('');
const roleFilter = ref('');
const busy = ref(null); // user id being mutated

const roleOptions = [
  { value: '', label: 'All roles' },
  { value: 'student', label: 'Student' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super admin' },
];
const assignable = [
  { value: 'student', label: 'Student' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'moderator', label: 'Moderator' },
  ...(auth.isSuperAdmin ? [{ value: 'admin', label: 'Admin' }, { value: 'super_admin', label: 'Super admin' }] : []),
];
const roleVariant = { super_admin: 'destructive', admin: 'secondary', moderator: 'outline', instructor: 'default', student: 'muted' };

const page = ref(1);

async function load() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ limit, offset: offset.value });
    if (q.value.trim()) params.set('q', q.value.trim());
    if (roleFilter.value) params.set('role', roleFilter.value);
    const d = await api.get(`/admin/users?${params}`);
    users.value = d.users || [];
    total.value = d.total || 0;
    page.value = Math.floor(offset.value / limit) + 1;
  } catch (e) { ui.toast.error(e.message || 'Could not load users'); }
  finally { loading.value = false; }
}

function search() { offset.value = 0; load(); }
function go(o) { offset.value = Math.max(0, o); load(); }

async function changeRole(u, role) {
  if (!role || role === u.role) return;
  busy.value = u.id;
  try { const { user } = await api.patch(`/admin/users/${u.id}/role`, { role }); u.role = user.role; ui.toast.success('Role updated'); }
  catch (e) { ui.toast.error(e.message || 'Failed'); load(); }
  finally { busy.value = null; }
}

async function toggleSuspend(u) {
  busy.value = u.id;
  try {
    const next = u.is_suspended ? 'unsuspend' : 'suspend';
    const body = next === 'suspend' ? { reason: 'Suspended by admin' } : {};
    const { user } = await api.post(`/admin/users/${u.id}/${next}`, body);
    u.is_suspended = user.is_suspended;
    ui.toast.success(user.is_suspended ? 'User suspended' : 'User reactivated');
  } catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { busy.value = null; }
}

async function verify(u) {
  busy.value = u.id;
  try {
    const { user } = await api.post(`/admin/instructors/${u.id}/verify`, { verified: !u.is_verified_instructor });
    u.is_verified_instructor = user.is_verified_instructor;
    ui.toast.success('Updated');
  } catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { busy.value = null; }
}

async function remove(u) {
  if (!window.confirm(`Permanently delete ${u.display_name || u.email}? This cannot be undone.`)) return;
  busy.value = u.id;
  try { await api.delete(`/admin/users/${u.id}`); ui.toast.success('User deleted'); await load(); }
  catch (e) { ui.toast.error(e.message || 'Failed'); }
  finally { busy.value = null; }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="flex items-center gap-2 text-2xl font-bold"><Users class="h-6 w-6" /> Users</h1>
      <p class="mt-1 text-sm text-muted-foreground">Manage accounts, roles and access.</p>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <div class="relative flex-1 min-w-[200px]">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="q" placeholder="Search name or email…" class="pl-9" @keyup.enter="search" />
      </div>
      <Select v-model="roleFilter" :options="roleOptions" class="w-44" @update:model-value="search" />
      <Button variant="outline" @click="search">Apply</Button>
    </div>

    <Card class="overflow-hidden">
      <div v-if="loading" class="space-y-2 p-4"><Skeleton v-for="i in 6" :key="i" class="h-14 rounded-lg" /></div>
      <template v-else-if="users.length">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th class="px-4 py-2.5 font-medium">User</th>
                <th class="px-4 py-2.5 font-medium">Role</th>
                <th class="px-4 py-2.5 font-medium">Status</th>
                <th class="px-4 py-2.5 font-medium">Joined</th>
                <th class="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="u in users" :key="u.id" :class="u.is_suspended ? 'opacity-60' : ''">
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-3">
                    <Avatar :src="u.avatar_url" :name="u.display_name" size="sm" />
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5 font-medium">
                        {{ u.display_name }}
                        <BadgeCheck v-if="u.is_verified_instructor" class="h-3.5 w-3.5 text-sky-500" />
                      </div>
                      <div class="truncate text-xs text-muted-foreground">{{ u.email }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-2.5">
                  <Select :model-value="u.role" :options="assignable" :disabled="busy === u.id" class="w-36" @update:model-value="(v) => changeRole(u, v)" />
                </td>
                <td class="px-4 py-2.5">
                  <Badge :variant="u.is_suspended ? 'destructive' : (roleVariant[u.role] || 'muted')">{{ u.is_suspended ? 'suspended' : u.role }}</Badge>
                </td>
                <td class="px-4 py-2.5 text-muted-foreground">{{ formatDate(u.created_at) }}</td>
                <td class="px-4 py-2.5">
                  <div class="flex justify-end gap-1">
                    <Button v-if="u.role === 'instructor' || u.is_verified_instructor" variant="ghost" size="icon" :disabled="busy === u.id" title="Toggle verification" @click="verify(u)"><ShieldCheck class="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" :disabled="busy === u.id" :title="u.is_suspended ? 'Reactivate' : 'Suspend'" @click="toggleSuspend(u)"><Ban class="h-4 w-4" /></Button>
                    <Button v-if="auth.isSuperAdmin" variant="ghost" size="icon" class="text-red-600" :disabled="busy === u.id" title="Delete" @click="remove(u)"><Trash2 class="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
          <span>{{ total }} users · page {{ page }}</span>
          <div class="flex gap-2">
            <Button variant="outline" size="sm" :disabled="offset === 0" @click="go(offset - limit)">Prev</Button>
            <Button variant="outline" size="sm" :disabled="offset + limit >= total" @click="go(offset + limit)">Next</Button>
          </div>
        </div>
      </template>
      <EmptyState v-else :icon="Users" title="No users found" description="Try a different search or filter." />
    </Card>
  </div>
</template>

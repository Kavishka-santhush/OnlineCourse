<script setup>
import { ref, reactive, onMounted } from 'vue';
import { User, Bell, Camera, Save, Loader2 } from 'lucide-vue-next';
import { Card, Button, Input, Textarea, Label, Switch, Tabs, Avatar } from '@/components/ui';
import { api } from '@/lib/api.js';
import { useAuthStore } from '@/stores/auth.js';
import { useUiStore } from '@/stores/ui.js';

const auth = useAuthStore();
const ui = useUiStore();

const tab = ref('profile');
const savingProfile = ref(false);
const savingPrefs = ref(false);
const uploading = ref(false);

// profile form
const profile = reactive({
  display_name: '', username: '', bio: '', website: '', timezone: '', language: '',
});

// notification + privacy prefs
const NOTIF_TYPES = [
  { key: 'course_updates', label: 'Course & lesson updates' },
  { key: 'announcement', label: 'Announcements' },
  { key: 'review', label: 'Review replies' },
  { key: 'enrollment', label: 'Enrollment & orders' },
  { key: 'certificate', label: 'Certificates' },
  { key: 'message', label: 'Direct messages' },
];
const prefs = reactive({ notifications: {}, privacy: { profile_public: true, show_email: false } });

function seedPrefs() {
  for (const t of NOTIF_TYPES) prefs.notifications[t.key] = { in_app: true, email: true };
}
seedPrefs();

async function loadProfile() {
  const u = auth.profile || {};
  Object.assign(profile, {
    display_name: u.display_name || '', username: u.username || '', bio: u.bio || '',
    website: u.website || '', timezone: u.timezone || '', language: u.language || '',
  });
}

async function loadPrefs() {
  try {
    const { preferences } = await api.get('/notifications/preferences');
    for (const row of preferences || []) {
      prefs.notifications[row.type] = { in_app: !!row.in_app, email: !!row.email };
    }
    const p = auth.profile?.privacy_settings;
    if (p) Object.assign(prefs.privacy, p);
  } catch { /* defaults stand */ }
}

async function saveProfile() {
  savingProfile.value = true;
  try {
    const { user } = await api.patch('/users/me', { ...profile });
    auth.profile = user;
    ui.toast.success('Profile saved');
  } catch (e) { ui.toast.error(e.message || 'Could not save profile'); }
  finally { savingProfile.value = false; }
}

async function savePrefs() {
  savingPrefs.value = true;
  try {
    await api.patch('/users/me/settings', { notifications: prefs.notifications, privacy: prefs.privacy });
    ui.toast.success('Preferences saved');
  } catch (e) { ui.toast.error(e.message || 'Could not save preferences'); }
  finally { savingPrefs.value = false; }
}

async function onAvatar(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const { user } = await api.post('/users/me/avatar', {
      data: (await uploadBase64(file)).base64, contentType: file.type || 'image/png',
    });
    auth.profile = user;
    ui.toast.success('Avatar updated');
  } catch (err) { ui.toast.error(err.message || 'Avatar upload failed'); }
  finally { uploading.value = false; e.target.value = ''; }
}

async function uploadBase64(file) {
  // reuse the generic uploader against the dedicated avatar endpoint shape
  const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
  return { base64: (dataUrl.split(',')[1] || dataUrl) };
}

onMounted(async () => { await auth.refresh?.(); loadProfile(); loadPrefs(); });
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <h1 class="mb-1 text-2xl font-bold">Settings</h1>
    <p class="mb-6 text-sm text-muted-foreground">Manage your profile, avatar and notification preferences.</p>

    <Tabs v-model="tab" class="mb-6" :tabs="[
      { value: 'profile', label: 'Profile' },
      { value: 'notifications', label: 'Notifications' },
    ]" />

    <!-- profile -->
    <Card v-if="tab === 'profile'" class="p-6">
      <div class="mb-6 flex items-center gap-4">
        <div class="relative">
          <Avatar :src="auth.avatarUrl" :name="auth.displayName" size="xl" />
          <label class="absolute -bottom-1 -right-1 grid h-7 w-7 cursor-pointer place-items-center rounded-full border bg-background shadow hover:bg-accent">
            <Camera class="h-3.5 w-3.5" />
            <input type="file" accept="image/*" class="hidden" @change="onAvatar" :disabled="uploading" />
          </label>
        </div>
        <div>
          <p class="font-medium">{{ auth.displayName }}</p>
          <p class="text-sm text-muted-foreground">{{ auth.profile?.email }}</p>
          <p v-if="uploading" class="mt-1 flex items-center gap-1 text-xs text-primary"><Loader2 class="h-3 w-3 animate-spin" /> Uploading…</p>
        </div>
      </div>

      <div class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <Label class="mb-1.5 block">Display name</Label>
            <Input v-model="profile.display_name" placeholder="Your name" />
          </div>
          <div>
            <Label class="mb-1.5 block">Username</Label>
            <Input v-model="profile.username" placeholder="public handle" />
          </div>
        </div>
        <div>
          <Label class="mb-1.5 block">Bio</Label>
          <Textarea v-model="profile.bio" rows="3" placeholder="A short about you…" />
        </div>
        <div class="grid gap-4 sm:grid-cols-3">
          <div>
            <Label class="mb-1.5 block">Website</Label>
            <Input v-model="profile.website" placeholder="https://…" />
          </div>
          <div>
            <Label class="mb-1.5 block">Timezone</Label>
            <Input v-model="profile.timezone" placeholder="Europe/London" />
          </div>
          <div>
            <Label class="mb-1.5 block">Language</Label>
            <Input v-model="profile.language" placeholder="en" />
          </div>
        </div>
      </div>
      <div class="mt-6 flex justify-end">
        <Button :loading="savingProfile" @click="saveProfile"><Save class="h-4 w-4" /> Save profile</Button>
      </div>
    </Card>

    <!-- notifications -->
    <Card v-else class="p-6">
      <h2 class="mb-1 flex items-center gap-2 font-semibold"><Bell class="h-4 w-4" /> Email & in-app</h2>
      <p class="mb-4 text-sm text-muted-foreground">Choose what you want to hear about.</p>
      <div class="divide-y">
        <div v-for="t in NOTIF_TYPES" :key="t.key" class="flex items-center justify-between py-3">
          <span class="text-sm">{{ t.label }}</span>
          <div class="flex items-center gap-6">
            <label class="flex items-center gap-2 text-xs text-muted-foreground">In-app
              <Switch v-model="prefs.notifications[t.key].in_app" />
            </label>
            <label class="flex items-center gap-2 text-xs text-muted-foreground">Email
              <Switch v-model="prefs.notifications[t.key].email" />
            </label>
          </div>
        </div>
      </div>

      <h2 class="mb-3 mt-8 flex items-center gap-2 font-semibold"><User class="h-4 w-4" /> Privacy</h2>
      <div class="space-y-3">
        <label class="flex items-center justify-between text-sm">Public profile
          <Switch v-model="prefs.privacy.profile_public" />
        </label>
        <label class="flex items-center justify-between text-sm">Show email to others
          <Switch v-model="prefs.privacy.show_email" />
        </label>
      </div>

      <div class="mt-6 flex justify-end">
        <Button :loading="savingPrefs" @click="savePrefs"><Save class="h-4 w-4" /> Save preferences</Button>
      </div>
    </Card>
  </div>
</template>

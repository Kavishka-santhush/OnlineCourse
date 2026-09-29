import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  clerk, initClerk, getClerkToken, openSignIn as clerkOpenSignIn,
  openSignUp as clerkOpenSignUp, signOut as clerkSignOut, clerkUserSnapshot,
} from '@/lib/clerk.js';
import { syncSupabaseSession, clearSupabaseSession } from '@/lib/supabase.js';
import { api } from '@/lib/api.js';

const ROLE_RANK = { guest: 0, student: 1, instructor: 2, moderator: 3, admin: 4, super_admin: 5 };

export const useAuthStore = defineStore('auth', () => {
  // ── state ────────────────────────────────────────────────────────────
  const ready = ref(false);            // Clerk loaded + first /users/me resolved
  const signedIn = ref(false);         // Clerk session present
  const profile = ref(null);           // Supabase `users` row (via GET /users/me)

  // ── getters ──────────────────────────────────────────────────────────
  const user = computed(() => profile.value);
  const role = computed(() => profile.value?.role || 'guest');
  const isAuthed = computed(() => signedIn.value && !!profile.value);
  const rank = computed(() => ROLE_RANK[role.value] ?? 0);
  const displayName = computed(() => profile.value?.display_name || clerkUserSnapshot()?.fullName || 'Student');
  const avatarUrl = computed(() => profile.value?.avatar_url || clerkUserSnapshot()?.imageUrl || null);
  const isInstructor = computed(() => rank.value >= ROLE_RANK.instructor);
  const isModerator = computed(() => rank.value >= ROLE_RANK.moderator);
  const isAdmin = computed(() => rank.value >= ROLE_RANK.admin);
  const isSuperAdmin = computed(() => role.value === 'super_admin');

  function hasRole(minRole) { return rank.value >= (ROLE_RANK[minRole] ?? 99); }

  // ── internal ─────────────────────────────────────────────────────────
  async function loadProfile() {
    if (!signedIn.value) { profile.value = null; return; }
    try {
      const { user: u } = await api.get('/users/me');
      profile.value = u;
      // Best-effort: hand the Clerk JWT to Supabase for Realtime/RLS access.
      const token = await getClerkToken();
      syncSupabaseSession(token);
    } catch (e) {
      // Signed in at Clerk but no local row yet (webhook still syncing) — retry once.
      if (e.status === 401 || e.status === 404) {
        setTimeout(() => loadProfile(), 1500);
      }
      profile.value = null;
    }
  }

  function syncFromClerk() {
    signedIn.value = !!clerk.session;
    ready.value = true;
    loadProfile();
  }

  // ── boot ─────────────────────────────────────────────────────────────
  async function boot() {
    await initClerk();
    try {
      clerk.addListener(syncFromClerk);
    } catch { /* key missing / not loaded */ }
    syncFromClerk();
  }

  // ── actions ──────────────────────────────────────────────────────────
  async function signIn() { await clerkOpenSignIn(); }
  async function signUp() { await clerkOpenSignUp(); }
  async function signOut() {
    await clerkSignOut();
    await clearSupabaseSession();
    signedIn.value = false;
    profile.value = null;
  }
  async function refresh() { await loadProfile(); }

  return {
    ready, signedIn, profile, user, role, isAuthed, rank, displayName, avatarUrl,
    isInstructor, isModerator, isAdmin, isSuperAdmin, hasRole,
    boot, signIn, signUp, signOut, refresh,
  };
});

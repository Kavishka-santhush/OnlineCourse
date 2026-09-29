// Supabase browser client.
//
// Primary data access goes through the Node API (service role). The browser
// client is used for:
//   * Realtime (in-app notifications, live-class presence/chat)
//   * Reading the signed-in user's own rows directly, guarded by RLS
//     (see migration 020) once we exchange the Clerk JWT for a Supabase
//     session via Third-Party Auth.
//
// Prerequisite: enable Supabase → Auth → Third-Party Auth and register
// Clerk's JWKS public key so Supabase accepts Clerk tokens (README explains).
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const configured = url && !url.startsWith('your_') && anonKey && !anonKey.startsWith('your_');

export const supabase = configured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;

let boundToken = null;

/**
 * Exchange a Clerk session token for a Supabase session so RLS policies
 * resolve `auth.jwt() ->> 'sub'` to the Clerk user id. No-ops when Supabase
 * is not configured or the token has not changed.
 */
export async function syncSupabaseSession(clerkToken) {
  if (!supabase || !clerkToken) return;
  if (clerkToken === boundToken && supabase.auth.getSession) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return;
  }
  try {
    // setSession wraps an externally-validated JWT as a Supabase session.
    await supabase.auth.setSession({ access_token: clerkToken, refresh_token: '' });
    boundToken = clerkToken;
  } catch (e) {
    console.warn('[Supabase] third-party session sync failed (Realtime will be read-only):', e?.message || e);
  }
}

export async function clearSupabaseSession() {
  if (!supabase) return;
  boundToken = null;
  try { await supabase.auth.signOut(); } catch { /* noop */ }
}

/**
 * Subscribe to the current user's notifications table (in-app bell).
 * Returns an unsubscribe fn. Requires a synced session (RLS owner check).
 */
export function onUserNotifications(userId, cb) {
  if (!supabase || !userId) return () => {};
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => cb(payload.new))
    .subscribe();
  return () => supabase.removeChannel(channel);
}

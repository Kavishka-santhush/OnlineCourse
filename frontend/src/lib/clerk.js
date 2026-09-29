// Clerk browser SDK (headless) wrapper.
//
// We use the framework-agnostic @clerk/clerk-js singleton and expose a tiny
// reactive bridge that the Pinia auth store consumes. Auth (email + Google /
// Facebook / GitHub OAuth) is fully owned by Clerk — the app never handles
// passwords. The JWT obtained here is sent to the Node API and also handed to
// Supabase (see lib/supabase.js) for Realtime / RLS.
import { Clerk } from '@clerk/clerk-js';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export const clerk = new Clerk(publishableKey);

let loaded = false;

/** Load Clerk once. Safe to await repeatedly. */
export async function initClerk() {
  if (loaded) return;
  if (!publishableKey || publishableKey.startsWith('your_')) {
    console.warn('[Clerk] VITE_CLERK_PUBLISHABLE_KEY is not set — auth UI disabled.');
    loaded = true;
    return;
  }
  await clerk.load();
  loaded = true;
}

/** Current session token (null when signed out). Sent as `Authorization: Bearer`. */
export async function getClerkToken() {
  if (!clerk.session) return null;
  try {
    return await clerk.session.getToken();
  } catch {
    return null;
  }
}

export function openSignIn() {
  return clerk.openSignIn?.();
}

export function openSignUp() {
  return clerk.openSignUp?.();
}

export function signOut() {
  return clerk.signOut?.();
}

/** Snapshot of the signed-in user mapped to the shape the API/webhook expects. */
export function clerkUserSnapshot() {
  if (!clerk.user) return null;
  const primaryEmail =
    clerk.user.primaryEmailAddressId &&
    clerk.user.emailAddresses.find((e) => e.id === clerk.user.primaryEmailAddressId)?.emailAddress;
  return {
    id: clerk.user.id,
    email: primaryEmail || clerk.user.primaryEmailAddress?.emailAddress || null,
    firstName: clerk.user.firstName,
    lastName: clerk.user.lastName,
    fullName: clerk.user.fullName,
    imageUrl: clerk.user.imageUrl,
    username: clerk.user.username,
  };
}

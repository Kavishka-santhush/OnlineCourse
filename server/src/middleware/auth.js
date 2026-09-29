import { getAuth } from '@clerk/express';
import { db, must } from '../lib/supabase.js';
import { HttpError } from '../utils/httpError.js';

export const ROLES = ['guest', 'student', 'instructor', 'moderator', 'admin', 'super_admin'];
const RANK = Object.fromEntries(ROLES.map((r, i) => [r, i]));

/**
 * requireAuth — verifies the Clerk JWT, loads the synced Supabase user and
 * attaches `req.user`. Rejects suspended accounts. Clerk owns authentication;
 * this only resolves the *application* user record + role.
 */
export async function requireAuth(req, res, next) {
  try {
    const { userId } = getAuth(req);
    if (!userId) throw HttpError.unauthorized();
    const rows = must(await db.from('users').select('*').eq('clerk_id', userId).limit(1));
    const user = rows[0];
    if (!user) throw HttpError.unauthorized('Profile not found — complete registration first');
    if (user.is_suspended) throw HttpError.forbidden('Account suspended. Contact support.');
    req.user = user;
    req.clerkId = userId;
    next();
  } catch (err) {
    next(err);
  }
}

/** Optional auth — attaches req.user when a valid session exists, otherwise continues. */
export async function optionalAuth(req, res, next) {
  try {
    const { userId } = getAuth(req);
    if (userId) {
      const rows = must(await db.from('users').select('*').eq('clerk_id', userId).limit(1));
      if (rows[0] && !rows[0].is_suspended) req.user = rows[0];
    }
  } catch {
    /* ignore — optional */
  }
  next();
}

/** requireRole('instructor','admin',...) — minimum role using hierarchy OR explicit list. */
export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return next(HttpError.unauthorized());
    const role = req.user.role;
    const ok = allowed.includes(role) || (allowed.length === 1 && RANK[role] >= RANK[allowed[0]]);
    if (!ok) return next(HttpError.forbidden(`Requires role: ${allowed.join(' or ')}`));
    next();
  };
}

/** Explicit minimum-rank guard: requireAtLeast('moderator') allows moderator+admin+super_admin. */
export function requireAtLeast(minRole) {
  return (req, res, next) => {
    if (!req.user) return next(HttpError.unauthorized());
    if ((RANK[req.user.role] ?? -1) < (RANK[minRole] ?? 99)) return next(HttpError.forbidden());
    next();
  };
}

export const requireAdmin = requireAtLeast('admin');
export const requireSuperAdmin = requireRole('super_admin');
export const requireModerator = requireAtLeast('moderator');

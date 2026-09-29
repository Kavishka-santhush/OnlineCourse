import { db } from '../lib/supabase.js';

/**
 * Append an immutable audit log entry for administrative actions.
 * Never throws — auditing must not break the request it describes.
 */
export async function audit({ actorId, actorEmail, action, entityType, entityId, metadata, ip }) {
  try {
    await db.from('audit_logs').insert({
      actor_id: actorId || null,
      actor_email: actorEmail || null,
      action,
      entity_type: entityType || null,
      entity_id: entityId ? String(entityId) : null,
      metadata: metadata || {},
      ip_address: ip || null,
    });
  } catch (err) {
    console.error('[audit] failed', err.message);
  }
}

/** Lightweight user activity log (login, page-level events, purchases, etc.). */
export async function activity({ userId, action, description, metadata }) {
  try {
    await db.from('user_activity').insert({
      user_id: userId,
      action,
      description: description || null,
      metadata: metadata || {},
    });
  } catch (err) {
    console.error('[activity] failed', err.message);
  }
}

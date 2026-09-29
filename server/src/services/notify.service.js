import { db, must } from '../lib/supabase.js';
import { sendMail } from '../lib/mailer.js';
import { templates } from './emailTemplates.jsx';

/**
 * Unified notification dispatcher.
 * - Persists an in-app notification row (Supabase Realtime streams it to the client)
 * - Optionally sends an email using a React Email template
 * - Respects per-user notification preferences (notification_preferences table)
 *
 * Fire-and-forget: callers should `await notify(...)` but it never throws.
 */
export async function notify({
  userId,
  type,
  title,
  body,
  link = null,
  email = null,
  emailTemplate = null,
  emailData = null,
  emitRealtime = true,
}) {
  try {
    const pref = await getUserPreference(userId, type);
    const inAppEnabled = pref?.in_app !== false;
    const emailEnabled = pref?.email !== false;

    if (inAppEnabled) {
      must(await db.from('notifications').insert({
        user_id: userId,
        type,
        title,
        body,
        link,
        read: false,
      }));
      // Supabase Realtime broadcasts the INSERT automatically to subscribers
      // on the notifications channel filtered by user_id. `emitRealtime` is a
      // no-op hook kept for socket.io based live class notifications.
      if (emitRealtime) {
        const { getIo } = await import('../lib/socket.js');
        getIo()?.to(`user:${userId}`).emit('notification', { type, title, body, link });
      }
    }

    if (emailEnabled && email && emailTemplate && templates[emailTemplate]) {
      const html = templates[emailTemplate]({ name: emailData?.name || 'there', ...emailData });
      await sendMail({ to: email, subject: title, html });
    }
    return { ok: true };
  } catch (err) {
    console.error('[notify] failed:', err.message);
    return { ok: false, error: err.message };
  }
}

const prefCache = new Map();
async function getUserPreference(userId, type) {
  const key = `${userId}:${type}`;
  if (prefCache.has(key)) return prefCache.get(key);
  const rows = must(await db.from('notification_preferences').select('in_app,email').eq('user_id', userId).eq('type', type).limit(1));
  const value = rows[0] || null;
  prefCache.set(key, value);
  return value;
}

/** Bulk notify every enrolled student of a course (used for announcements / new lessons). */
export async function notifyCourseAudience(courseId, payload) {
  const students = must(await db.from('enrollments').select('user_id').eq('course_id', courseId));
  const emails = await db.from('users').select('id,email').in('id', students.map((s) => s.user_id));
  const emailById = Object.fromEntries((emails.data || []).map((u) => [u.id, u.email]));
  await Promise.all(
    students.map((s) => notify({ ...payload, userId: s.user_id, email: emailById[s.user_id] })),
  );
  return { notified: students.length };
}

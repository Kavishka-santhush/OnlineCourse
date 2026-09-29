import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Supabase admin client — uses the service-role key and bypasses RLS.
 * ALL server-side DB access goes through this client. RLS is enforced for
 * direct client/browser access only (see migrations). Never expose this key
 * to the frontend.
 */
export const db = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { 'x-application-name': 'coursemarket-server' } },
});

/**
 * Throw a structured error if a Supabase call failed.
 * @param {{error?: {message:string, code?:string, details?:string, hint?:string}}} result
 */
export function must(result) {
  if (result.error) {
    const err = new Error(result.error.message || 'Supabase query failed');
    err.code = result.error.code;
    err.details = result.error.details;
    err.hint = result.error.hint;
    if (err.code === '23505') err.status = 409; // unique_violation
    else if (err.code === '23503') err.status = 400; // foreign_key_violation
    else err.status = 500;
    throw err;
  }
  return result.data;
}

export async function list(table, { select = '*', filter = {}, order, limit = 1000, offset = 0 } = {}) {
  let q = db.from(table).select(select);
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  if (order) q = q.order(order.column, { ascending: order.ascending ?? false });
  q = q.range(offset, offset + limit - 1);
  return must(await q);
}

export async function byId(table, id, select = '*') {
  const rows = must(await db.from(table).select(select).eq('id', id).limit(1));
  return rows[0] || null;
}

export async function insertOne(table, payload) {
  const rows = must(await db.from(table).insert(payload).select().limit(1));
  return rows[0];
}

export async function updateOne(table, id, patch) {
  const rows = must(await db.from(table).update(patch).eq('id', id).select().limit(1));
  return rows[0] || null;
}

export async function deleteOne(table, id) {
  must(await db.from(table).delete().eq('id', id));
  return { id };
}

export async function count(table, filter = {}) {
  let q = db.from(table).select('id', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const res = await q;
  if (res.error) throw new Error(res.error.message);
  return res.count ?? 0;
}

import http from 'http';
import { createApp } from './app.js';
import { initSocket } from './lib/socket.js';
import { env } from './config/env.js';
import { db, must } from './lib/supabase.js';
import { notify } from './services/notify.service.js';

const app = createApp();
const server = http.createServer(app);
initSocket(server);

server.listen(env.port, () => {
  console.log(`✅ CourseMarket API listening on http://localhost:${env.port}`);
  console.log(`   CORS origin: ${env.frontendUrl}`);
});

/**
 * Lightweight scheduler (no external cron dep). Runs every 5 minutes:
 *  - Live class reminders (T-15 min) → email + in-app
 *  - Wishlist price-drop alerts
 * In production move this to a dedicated worker / Supabase cron + pg_cron.
 */
async function tick() {
  try {
    await remindLiveClasses();
    await priceDropAlerts();
  } catch (err) {
    console.error('[scheduler] tick failed', err.message);
  }
}

async function remindLiveClasses() {
  const now = Date.now();
  const soon = new Date(now + 15 * 60_000).toISOString();
  const upNext = must(await db.from('live_classes').select('id,title,description,starts_at,course_id,reminded_at').eq('status', 'scheduled').is('reminded_at', null).lte('starts_at', soon));
  for (const lc of upNext) {
    if (!lc.course_id) continue;
    const students = must(await db.from('enrollments').select('user_id').eq('course_id', lc.course_id));
    for (const s of students) {
      await notify({ userId: s.user_id, type: 'live_class', title: 'Live class starting soon', body: `${lc.title} starts in ~15 minutes`, link: `/live/${lc.id}`, emailTemplate: 'liveClassReminder', emailData: { title: lc.title, startsAt: lc.starts_at } });
    }
    await db.from('live_classes').update({ reminded_at: new Date().toISOString() }).eq('id', lc.id);
  }
}

async function priceDropAlerts() {
  const rows = must(await db.from('wishlist').select('*').is('notified_at', null));
  for (const w of rows) {
    const course = must(await db.from('courses').select('id,title,slug,price').eq('id', w.course_id).limit(1))[0];
    if (!course) continue;
    if (w.price_at_add != null && course.price < w.price_at_add) {
      await notify({ userId: w.user_id, type: 'price_drop', title: 'Price drop!', body: `${course.title} is now $${course.price}`, link: `/course/${course.slug}`, emailTemplate: 'priceDrop', emailData: { courseTitle: course.title, price: `$${course.price}` } });
      await db.from('wishlist').update({ notified_at: new Date().toISOString(), price_at_add: course.price }).eq('id', w.id);
    } else if (w.price_at_add == null) {
      await db.from('wishlist').update({ price_at_add: course.price }).eq('id', w.id);
    }
  }
}

setInterval(tick, 5 * 60_000);

async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
}
['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));

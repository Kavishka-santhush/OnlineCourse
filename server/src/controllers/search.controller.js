import { db, must } from '../lib/supabase.js';
import { asyncHandler } from '../utils/httpError.js';
import { pagination } from '../utils/validate.js';
import { chat, AI_SYSTEM } from '../lib/openRouter.js';

const CARD = 'id,title,slug,subtitle,thumbnail_url,price,is_free,level,language,rating_avg,rating_count,enrollment_count,category:categories(id,name),instructor:users(id,display_name,avatar_url)';

/**
 * GET /api/search?q=&category=&level=&language=&free=&min=&max=&sort=&page=
 * Uses the `search_courses` Postgres full-text function when a query is present,
 * otherwise a filtered catalog query. Optional AI semantic expansion (?ai=true).
 */
export const search = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  let q = req.query.q || '';
  if (req.query.ai === 'true' && q && req.user) {
    try {
      const { json } = await chat({ feature: 'search_semantic', response: 'json', userId: req.user.id, system: AI_SYSTEM.SEARCH, messages: [{ role: 'user', content: q }] });
      if (json?.keywords?.length) q = json.keywords.join(' ');
    } catch { /* fall back to raw query */ }
  }

  if (q) {
    const { data, error } = await db.rpc('search_courses', {
      search_term: q, filter_category: req.query.category || null,
      filter_level: req.query.level || null, filter_language: req.query.language || null,
      result_limit: limit, result_offset: offset,
    });
    if (!error) return res.json({ courses: data || [], page, limit, mode: 'fulltext' });
  }

  let query = db.from('courses').select(CARD, { count: 'exact' }).eq('status', 'published');
  if (q) query = query.or(`title.ilike.%${q}%,subtitle.ilike.%${q}%,description.ilike.%${q}%`);
  if (req.query.category) query = query.eq('category_id', req.query.category);
  if (req.query.level) query = query.eq('level', req.query.level);
  if (req.query.language) query = query.eq('language', req.query.language);
  if (req.query.free === 'true') query = query.eq('is_free', true);
  const sortMap = { newest: ['created_at', false], popular: ['enrollment_count', false], rating: ['rating_avg', false], price_low: ['price', true], price_high: ['price', false] };
  const [col, asc] = sortMap[req.query.sort] || ['rating_avg', false];
  query = query.order(col, { ascending: asc }).range(offset, offset + limit - 1);
  const { data, count } = await query;
  res.json({ courses: data || [], total: count, page, limit, mode: 'filters' });
});

/** GET /api/search/suggest?q= — autocomplete titles */
export const suggest = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').slice(0, 40);
  if (!q) return res.json({ suggestions: [] });
  const rows = must(await db.from('courses').select('title,slug').eq('status', 'published').ilike('title', `%${q}%`).limit(8));
  res.json({ suggestions: rows });
});

/** GET /api/search/trending — trending courses */
export const trending = asyncHandler(async (req, res) => {
  const rows = must(await db.from('courses').select(CARD).eq('status', 'published').eq('is_featured', false).order('enrollment_count', { ascending: false }).limit(12));
  res.json({ courses: rows });
});

/** GET /api/search/featured — homepage featured */
export const featured = asyncHandler(async (req, res) => {
  const rows = must(await db.from('courses').select(CARD).eq('status', 'published').eq('is_featured', true).order('created_at', { ascending: false }).limit(8));
  res.json({ courses: rows });
});

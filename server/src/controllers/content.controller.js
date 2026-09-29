import slugify from 'slugify';
import { db, must, byId, insertOne, updateOne, deleteOne } from '../lib/supabase.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { validate, pagination } from '../utils/validate.js';
import { uploadBuffer } from '../lib/storage.js';
import { env } from '../config/env.js';

/* ── Blog / resource centre ──────────────────────────────── */

export const listPosts = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query, { defaultLimit: 12 });
  let q = db.from('blog_posts').select('id,title,slug,excerpt,cover_image_url,author:users(id,display_name,avatar_url),published_at,tags', { count: 'exact' }).eq('is_published', true).order('published_at', { ascending: false });
  if (req.query.tag) q = q.contains('tags', [req.query.tag]);
  const { data, count } = await q.range(offset, offset + limit - 1);
  res.json({ posts: data || [], total: count, page, limit });
});

export const getPost = asyncHandler(async (req, res) => {
  const post = must(await db.from('blog_posts').select('*, author:users(id,display_name,avatar_url,bio)').eq('slug', req.params.slug).limit(1))[0];
  if (!post || (!post.is_published && !['admin', 'super_admin'].includes(req.user?.role))) throw HttpError.notFound('Post not found');
  res.json({ post });
});

export const createPost = asyncHandler(async (req, res) => {
  const data = validate({ title: 'required|string|max:160', body: 'required|string' }, req.body);
  const slug = slugify(data.title, { lower: true, strict: true });
  const post = await insertOne('blog_posts', { ...data, slug, author_id: req.user.id, is_published: req.body.is_published ?? false, excerpt: req.body.excerpt || null, tags: req.body.tags || [], cover_image_url: req.body.cover_image_url || null, published_at: new Date().toISOString() });
  res.status(201).json({ post });
});

export const updatePost = asyncHandler(async (req, res) => {
  const post = await byId('blog_posts', req.params.id);
  if (!post) throw HttpError.notFound('Post not found');
  const patch = {};
  for (const k of ['title', 'body', 'excerpt', 'tags', 'is_published', 'cover_image_url']) if (k in req.body) patch[k] = req.body[k];
  if (patch.title) patch.slug = slugify(patch.title, { lower: true, strict: true });
  res.json({ post: await updateOne('blog_posts', post.id, patch) });
});

export const deletePost = asyncHandler(async (req, res) => {
  await deleteOne('blog_posts', req.params.id);
  res.json({ deleted: true });
});

/* ── Static pages (About/Contact/FAQ/Sitemap) ────────────── */

export const getPage = asyncHandler(async (req, res) => {
  const page = must(await db.from('cms_pages').select('*').eq('slug', req.params.slug).limit(1))[0];
  if (!page) throw HttpError.notFound('Page not found');
  res.json({ page });
});

export const upsertPage = asyncHandler(async (req, res) => {
  const { slug, title, content } = validate({ slug: 'required|string|max:80', title: 'required|string|max:160', content: 'required|string' }, req.body);
  const existing = must(await db.from('cms_pages').select('id').eq('slug', slug).limit(1))[0];
  if (existing) return res.json({ page: await updateOne('cms_pages', existing.id, { title, content }) });
  res.status(201).json({ page: await insertOne('cms_pages', { slug, title, content }) });
});

/** FAQ items */
export const listFaqs = asyncHandler(async (req, res) => {
  res.json({ faqs: must(await db.from('faqs').select('*').order('sort_order')) });
});
export const createFaq = asyncHandler(async (req, res) => {
  const { question, answer, category = 'general', sort_order = 0 } = req.body;
  res.status(201).json({ faq: await insertOne('faqs', { question, answer, category, sort_order }) });
});
export const deleteFaq = asyncHandler(async (req, res) => {
  await deleteOne('faqs', req.params.id);
  res.json({ deleted: true });
});

/** POST /api/content/upload-image — blog covers, page inline images */
export const uploadImage = asyncHandler(async (req, res) => {
  const { data, contentType = 'image/png' } = req.body;
  if (!data) throw HttpError.badRequest('Missing data');
  const file = await uploadBuffer(env.storage.media, 'cms', 'image', data, contentType);
  res.status(201).json({ url: file.url, path: file.path });
});

/** GET /api/sitemap — machine-readable URLs for SEO */
export const sitemap = asyncHandler(async (req, res) => {
  const courses = must(await db.from('courses').select('slug,updated_at').eq('status', 'published'));
  const posts = must(await db.from('blog_posts').select('slug,published_at').eq('is_published', true));
  res.format({
    'application/json': () => res.json({ courses: courses.map((c) => `/course/${c.slug}`), posts: posts.map((p) => `/blog/${p.slug}`) }),
    'text/xml': () => res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
      [...courses.map((c) => `<url><loc>/course/${c.slug}</loc></url>`), ...posts.map((p) => `<url><loc>/blog/${p.slug}</loc></url>`)].join('') +
      `</urlset>`,
    ),
  });
});

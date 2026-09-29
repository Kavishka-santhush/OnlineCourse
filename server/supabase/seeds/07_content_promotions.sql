-- =====================================================================
-- SEED 07 · CMS content, FAQs, platform announcements, promotions,
--           bundles & collections
--
-- Depends on 02 (users), 03 (courses).
-- Fixed UUID bases:
--   blog_posts        d1d1d1d1-...   cms_pages   d2d2d2d2-...
--   faqs              d3d3d3d3-...   platform_ann d4d4d4d4-...
--   promotions        d5d5d5d5-...   bundles      d6d6d6d6-...
--   collections       d7d7d7d7-...   collection_items d8d8d8d8-...
-- =====================================================================

-- ---------------------------------------------------------------------
-- Blog / resource centre
-- ---------------------------------------------------------------------
insert into public.blog_posts (id, title, slug, excerpt, body, cover_image_url, author_id, tags, is_published, published_at) values
  ('d1d1d1d1-d1d1-4d1a-8d1a-d1d1d1d1d101','How to Build a Course That Sells','how-to-build-a-course-that-sells',
   'A practical checklist for new instructors.','<h2>Start with outcomes</h2><p>Great courses promise one clear outcome and deliver it faster than any free alternative.</p>',
   'https://picsum.photos/seed/blog1/1200/630','11111111-1111-4111-8111-111111111102','["teaching","instructor"]',true, now() - interval '12 days'),
  ('d1d1d1d1-d1d1-4d1a-8d1a-d1d1d1d1d102','Why Vue 3 Composition API Matters','why-vue3-composition-api',
   'Reusability, tree-shaking and better TS support explained.','<h2>Composition API</h2><p>Logic reuse without mixins, first-class TypeScript and smaller bundles.</p>',
   'https://picsum.photos/seed/blog2/1200/630','11111111-1111-4111-8111-111111111111','["vue","frontend"]',true, now() - interval '5 days'),
  ('d1d1d1d1-d1d1-4d1a-8d1a-d1d1d1d1d103','Draft: Platform Roadmap Q3','draft-roadmap-q3',
   'Internal draft, not yet published.','<p>Upcoming: cohorts, mobile apps, and offline mode.</p>',
   null,'11111111-1111-4111-8111-111111111101','["roadmap"]',false, null)
on conflict (slug) do update
  set title = excluded.title, excerpt = excluded.excerpt, body = excluded.body,
      cover_image_url = excluded.cover_image_url, tags = excluded.tags,
      is_published = excluded.is_published, published_at = excluded.published_at;

-- ---------------------------------------------------------------------
-- Static CMS pages
-- ---------------------------------------------------------------------
insert into public.cms_pages (id, slug, title, content) values
  ('d2d2d2d2-d2d2-4d2a-8d2a-d2d2d2d2d201','about','About CourseMarket','<h1>Our mission</h1><p>CourseMarket connects expert instructors with curious learners worldwide.</p>'),
  ('d2d2d2d2-d2d2-4d2a-8d2a-d2d2d2d2d202','contact','Contact Us','<h1>Get in touch</h1><p>Email us at support@coursemarket.test.</p>'),
  ('d2d2d2d2-d2d2-4d2a-8d2a-d2d2d2d2d203','terms','Terms of Service','<h1>Terms</h1><p>By using CourseMarket you agree to these terms.</p>'),
  ('d2d2d2d2-d2d2-4d2a-8d2a-d2d2d2d2d204','privacy','Privacy Policy','<h1>Privacy</h1><p>We respect your data. Here is how we handle it.</p>')
on conflict (slug) do update set title = excluded.title, content = excluded.content;

-- ---------------------------------------------------------------------
-- FAQs
-- ---------------------------------------------------------------------
insert into public.faqs (id, question, answer, category, sort_order) values
  ('d3d3d3d3-d3d3-4d3a-8d3a-d3d3d3d3d301','How do refunds work?','Most courses are refundable within the window set by the instructor if you have completed under the completion threshold.','billing',1),
  ('d3d3d3d3-d3d3-4d3a-8d3a-d3d3d3d3d302','Do I get a certificate?','Yes — you receive a verifiable certificate of completion when you finish a course to 100%.','learning',2),
  ('d3d3d3d3-d3d3-4d3a-8d3a-d3d3d3d3d303','How do I become an instructor?','Apply from your dashboard; our team reviews applications and responds by email.','teaching',3),
  ('d3d3d3d3-d3d3-4d3a-8d3a-d3d3d3d3d304','What is included in Pro?','Unlimited access to the full catalogue, downloadable resources and certificates.','subscriptions',4)
on conflict (id) do update set question = excluded.question, answer = excluded.answer,
  category = excluded.category, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------
-- Platform announcements (banner / modal)
-- ---------------------------------------------------------------------
insert into public.platform_announcements (id, author_id, title, body, level, active, starts_at, ends_at) values
  ('d4d4d4d4-d4d4-4d4a-8d4a-d4d4d4d4d401','11111111-1111-4111-8111-111111111102',
   'Summer Sale — 20% off sitewide','Use code WELCOME10 at checkout. Ends soon!','success',true, now() - interval '1 day', now() + interval '20 days'),
  ('d4d4d4d4-d4d4-4d4a-8d4a-d4d4d4d4d402','11111111-1111-4111-8111-111111111101',
   'Scheduled maintenance','We will perform a brief maintenance window this Sunday 02:00 UTC.','warning',false, now() + interval '6 days', now() + interval '7 days')
on conflict (id) do update set title = excluded.title, body = excluded.body, level = excluded.level, active = excluded.active;

-- ---------------------------------------------------------------------
-- Promotions (flash sale) & a course bundle
-- ---------------------------------------------------------------------
insert into public.promotions (id, name, percent_off, starts_at, ends_at, course_ids, coupon_code, active, created_by) values
  ('d5d5d5d5-d5d5-4d5a-8d5a-d5d5d5d5d501','Summer Launch',20, now() - interval '1 day', now() + interval '20 days',
   '["44444444-4444-4444-8444-444444444401","44444444-4444-4444-8444-444444444402"]'::jsonb,'WELCOME10',true,'11111111-1111-4111-8111-111111111102')
on conflict (id) do update set name = excluded.name, percent_off = excluded.percent_off, active = excluded.active;

insert into public.bundles (id, title, description, course_ids, discount_percent, created_by, status) values
  ('d6d6d6d6-d6d6-4d6a-8d6a-d6d6d6d6d601','Full-Stack JavaScript Bundle','Build both ends of a modern web app: Vue 3 frontend + Node/Express backend.',
   '["44444444-4444-4444-8444-444444444401","44444444-4444-4444-8444-444444444402"]'::jsonb,15,'11111111-1111-4111-8111-111111111102','approved')
on conflict (id) do update set title = excluded.title, description = excluded.description,
  course_ids = excluded.course_ids, discount_percent = excluded.discount_percent, status = excluded.status;

-- ---------------------------------------------------------------------
-- A public collection ("learning path")
-- ---------------------------------------------------------------------
insert into public.collections (id, user_id, title, description, is_public) values
  ('d7d7d7d7-d7d7-4d7a-8d7a-d7d7d7d7d701','11111111-1111-4111-8111-111111111121','My Frontend Path','Everything I am studying to become a front-end dev.',true)
on conflict (id) do update set title = excluded.title, description = excluded.description, is_public = excluded.is_public;

insert into public.collection_items (id, collection_id, course_id, position) values
  ('d8d8d8d8-d8d8-4d8a-8d8a-d8d8d8d8d801','d7d7d7d7-d7d7-4d7a-8d7a-d7d7d7d7d701','44444444-4444-4444-8444-444444444401',1),
  ('d8d8d8d8-d8d8-4d8a-8d8a-d8d8d8d8d802','d7d7d7d7-d7d7-4d7a-8d7a-d7d7d7d7d701','44444444-4444-4444-8444-444444444402',2)
on conflict (collection_id, course_id) do update set position = excluded.position;

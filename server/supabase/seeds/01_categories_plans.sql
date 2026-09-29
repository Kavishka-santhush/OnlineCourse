-- =====================================================================
-- SEED 01 · Categories, subcategories & subscription plans
--
-- Run in Supabase Dashboard → SQL Editor AFTER all migrations and
-- AFTER 02_users.sql is NOT required here (no user FKs in this file).
-- Idempotent: safe to run multiple times (upsert on natural keys).
--
-- Fixed UUIDs are used so later seed files can reference them safely.
--   categories          22222222-...
--   subscription_plans  33333333-...
-- =====================================================================

-- ---------------------------------------------------------------------
-- Top-level categories
-- ---------------------------------------------------------------------
insert into public.categories (id, name, slug, parent_id, icon, description, sort_order) values
  ('22222222-2222-4222-8222-222222222201', 'Development',            'development',            null, 'code',        'Web, mobile, software engineering & data',        1),
  ('22222222-2222-4222-8222-222222222202', 'Business',              'business',                null, 'briefcase',   'Entrepreneurship, finance, strategy & management', 2),
  ('22222222-2222-4222-8222-222222222203', 'Design',                'design',                  null, 'palette',     'Graphic, UI/UX, 3D & animation',                   3),
  ('22222222-2222-4222-8222-222222222204', 'Marketing',             'marketing',               null, 'megaphone',   'Digital, SEO, social & brand marketing',           4),
  ('22222222-2222-4222-8222-222222222205', 'Photography & Video',   'photography-video',       null, 'camera',      'Cameras, editing & filmmaking',                    5),
  ('22222222-2222-4222-8222-222222222206', 'Music',                 'music',                   null, 'music',       'Production, instruments & theory',                 6),
  ('22222222-2222-4222-8222-222222222207', 'Health & Fitness',      'health-fitness',          null, 'heart',       'Wellness, nutrition & training',                   7),
  ('22222222-2222-4222-8222-222222222208', 'Data Science',          'data-science',            null, 'database',    'ML, analytics & big data',                         8)
on conflict (slug) do update
  set name = excluded.name, icon = excluded.icon, description = excluded.description,
      sort_order = excluded.sort_order, is_active = true;

-- ---------------------------------------------------------------------
-- Subcategories
-- ---------------------------------------------------------------------
insert into public.categories (id, name, slug, parent_id, icon, sort_order) values
  ('22222222-2222-4222-8222-222222222301', 'Web Development',   'web-development',   '22222222-2222-4222-8222-222222222201', 'globe',      1),
  ('22222222-2222-4222-8222-222222222302', 'Mobile Development','mobile-development','22222222-2222-4222-8222-222222222201', 'smartphone', 2),
  ('22222222-2222-4222-8222-222222222303', 'Databases',         'databases',         '22222222-2222-4222-8222-222222222201', 'database',   3),
  ('22222222-2222-4222-8222-222222222304', 'DevOps & Cloud',    'devops-cloud',      '22222222-2222-4222-8222-222222222201', 'cloud',      4),
  ('22222222-2222-4222-8222-222222222305', 'Finance',           'finance',           '22222222-2222-4222-8222-222222222202', 'coins',      1),
  ('22222222-2222-4222-8222-222222222306', 'Entrepreneurship',  'entrepreneurship',  '22222222-2222-4222-8222-222222222202', 'rocket',     2),
  ('22222222-2222-4222-8222-222222222307', 'UI / UX Design',    'ui-ux-design',      '22222222-2222-4222-8222-222222222203', 'figma',      1),
  ('22222222-2222-4222-8222-222222222308', 'Graphic Design',    'graphic-design',    '22222222-2222-4222-8222-222222222203', 'pen',        2),
  ('22222222-2222-4222-8222-222222222309', 'Digital Marketing', 'digital-marketing', '22222222-2222-4222-8222-222222222204', 'share',      1),
  ('22222222-2222-4222-8222-222222222310', 'SEO',               'seo',               '22222222-2222-4222-8222-222222222204', 'search',     2),
  ('22222222-2222-4222-8222-222222222311', 'Video Editing',     'video-editing',     '22222222-2222-4222-8222-222222222205', 'film',       1),
  ('22222222-2222-4222-8222-222222222312', 'Machine Learning',  'machine-learning',  '22222222-2222-4222-8222-222222222208', 'brain',      1)
on conflict (slug) do update
  set name = excluded.name, parent_id = excluded.parent_id, icon = excluded.icon, is_active = true;

-- ---------------------------------------------------------------------
-- Subscription plans (Free / Pro / Team / Enterprise)
-- ---------------------------------------------------------------------
insert into public.subscription_plans
  (id, name, slug, description, price_cents, currency, "interval", trial_days, course_access, team_seats, features, is_active, sort_order) values
  ('33333333-3333-4333-8333-333333333301', 'Free',       'free',       'Browse the catalogue and buy courses individually.', 0,      'usd', 'month', 0,  'none',     0,
    '["Access to free courses","Wishlist & collections","Community Q&A"]', true, 1),
  ('33333333-3333-4333-8333-333333333302', 'Pro',        'pro',        'Unlimited streaming of the full course library.',    1999,   'usd', 'month', 7,  'all',      0,
    '["Unlimited course access","Downloadable resources","Certificates of completion","AI tutor (fair use)"]', true, 2),
  ('33333333-3333-4333-8333-333333333303', 'Team',       'team',       'For small teams that learn together.',               9999,   'usd', 'month', 14, 'all',      5,
    '["5 seats included","Team dashboard & reporting","Shared collections","Priority support"]', true, 3),
  ('33333333-3333-4333-8333-333333333304', 'Enterprise', 'enterprise', 'Custom scaling for large organisations.',            49900,  'usd', 'year',  14, 'all',      25,
    '["25 seats included","SSO & advanced controls","Dedicated success manager","Custom integrations"]', true, 4)
on conflict (slug) do update
  set name = excluded.name, description = excluded.description, price_cents = excluded.price_cents,
      "interval" = excluded."interval", course_access = excluded.course_access,
      team_seats = excluded.team_seats, features = excluded.features,
      is_active = true, sort_order = excluded.sort_order;

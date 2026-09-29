-- =====================================================================
-- SEED 02 · Demo users (staff, instructors, students)
--
-- Auth is owned by Clerk, so these rows carry PLACEHOLDER clerk_id
-- values ('seed_*'). When a real person signs up in Clerk with one of
-- these e-mail addresses, the server's user.created webhook calls
-- public.bind_seed_accounts() (see migration 022) and re-points the
-- clerk_id to the real account — keeping all seeded data.
--
-- Fixed UUID base: 11111111-1111-4111-8111-1111111111NN
--   staff:      ..01 super_admin, ..02 admin, ..03 moderator
--   instructors:..11 ..12 ..13 ..14
--   students:   ..21 ..22 ..23 ..24 ..25
-- Idempotent (upsert on e-mail).
-- =====================================================================

insert into public.users
  (id, clerk_id, email, username, display_name, avatar_url, bio, website, role,
   is_verified_instructor, instructor_tier, instructor_rating, referral_code, onboarded) values

  -- ── Staff ──────────────────────────────────────────────────────────
  ('11111111-1111-4111-8111-111111111101', 'seed_superadmin', 'owner@coursemarket.test',   'owner',       'Olivia Owner',    'https://i.pravatar.cc/150?img=47', 'Platform super administrator.',            'https://coursemarket.test', 'super_admin', false, 'new',     0,    'SUPER-OLIVIA',   true),
  ('11111111-1111-4111-8111-111111111102', 'seed_admin',      'admin@coursemarket.test',   'admin',       'Adam Admin',      'https://i.pravatar.cc/150?img=12', 'Marketplace operations lead.',             null,                      'admin',       false, 'new',     0,    null,             true),
  ('11111111-1111-4111-8111-111111111103', 'seed_mod',        'mod@coursemarket.test',     'moderator',   'Mia Moderator',   'https://i.pravatar.cc/150?img=32', 'Content moderation & trust & safety.',     null,                      'moderator',   false, 'new',     0,    null,             true),

  -- ── Instructors ────────────────────────────────────────────────────
  ('11111111-1111-4111-8111-111111111111', 'seed_inst_alice', 'alice.dev@gmail.test',      'alicedev',    'Alice Nguyen',    'https://i.pravatar.cc/150?img=5',  'Full-stack engineer & Vue/React educator.', 'https://alice.dev',      'instructor', true,  'elite',   4.85, 'ALICE-REF-01',   true),
  ('11111111-1111-4111-8111-111111111112', 'seed_inst_brian', 'brian.data@gmail.test',     'briandata',   'Brian Cole',      'https://i.pravatar.cc/150?img=15', 'Data scientist, ex-FAANG. ML & Python.',     null,                     'instructor', true,  'pro',     4.62, 'BRIAN-REF-02',   true),
  ('11111111-1111-4111-8111-111111111113', 'seed_inst_carla', 'carla.design@gmail.test',   'carladesign', 'Carla Mendes',    'https://i.pravatar.cc/150?img=45', 'Product designer teaching UI/UX.',           null,                     'instructor', true,  'rising',  4.71, null,             true),
  ('11111111-1111-4111-8111-111111111114', 'seed_inst_dave',  'dave.biz@gmail.test',       'davebiz',     'Dave Robinson',   'https://i.pravatar.cc/150?img=68', 'Entrepreneur & marketing strategist.',       null,                     'instructor', false, 'new',     0,    null,             true),

  -- ── Students ───────────────────────────────────────────────────────
  ('11111111-1111-4111-8111-111111111121', 'seed_stu_eve',    'eve.student@gmail.test',    'evastudent',  'Eve Martinez',    'https://i.pravatar.cc/150?img=20', 'Career switcher learning to code.',          null,                     'student',    false, 'new',     0,    null,             true),
  ('11111111-1111-4111-8111-111111111122', 'seed_stu_frank',  'frank.student@gmail.test',  'frankstudent','Frank Lee',       'https://i.pravatar.cc/150?img=33', 'Backend developer upskilling in ML.',        null,                     'student',    false, 'new',     0,    null,             true),
  ('11111111-1111-4111-8111-111111111123', 'seed_stu_grace',  'grace.student@gmail.test',  'gracestudent','Grace Kim',       'https://i.pravatar.cc/150?img=44', 'Designer exploring front-end.',              null,                     'student',    false, 'new',     0,    null,             true),
  ('11111111-1111-4111-8111-111111111124', 'seed_stu_henry',  'henry.student@gmail.test',  'henrystudent','Henry Ford',      'https://i.pravatar.cc/150?img=51', 'Founder improving marketing skills.',        null,                     'student',    false, 'new',     0,    null,             true),
  ('11111111-1111-4111-8111-111111111125', 'seed_stu_irene',  'irene.student@gmail.test',  'irenestudent','Irene Vera',      'https://i.pravatar.cc/150?img=9',  'Photographer moving into video.',            null,                     'student',    false, 'new',     0,    null,             true)
on conflict (email) do update
  set display_name = excluded.display_name,
      avatar_url   = excluded.avatar_url,
      bio          = excluded.bio,
      website      = excluded.website,
      role                     = excluded.role,
      is_verified_instructor   = excluded.is_verified_instructor,
      instructor_tier          = excluded.instructor_tier,
      instructor_rating        = excluded.instructor_rating,
      referral_code            = coalesce(public.users.referral_code, excluded.referral_code),
      onboarded                = true;

-- ---------------------------------------------------------------------
-- Notification preferences (default all-on) for every seeded user
-- ---------------------------------------------------------------------
insert into public.notification_preferences (user_id, type, in_app, email)
select u.id, t.type, true, true
  from public.users u
 cross join (values
    ('purchase'),('new_lesson'),('quiz_due'),('assignment_graded'),('live_class'),
    ('certificate'),('price_drop'),('announcement'),('new_enrollment'),('new_review'),
    ('course_moderation'),('payout'),('message')
 ) as t(type)
where u.clerk_id like 'seed_%'
on conflict (user_id, type) do nothing;

-- ---------------------------------------------------------------------
-- Instructor applications (Dave pending; others approved)
-- ---------------------------------------------------------------------
insert into public.instructor_applications (id, user_id, bio, expertise, experience, sample_content_url, status, reviewed_by) values
  ('11111111-1111-4111-8111-111111111a11', '11111111-1111-4111-8111-111111111114', 'I want to teach business and marketing to aspiring entrepreneurs.', '["Business","Marketing"]'::jsonb, '8 years running online businesses.', 'https://youtube.com/watch?v=dave-demo', 'pending', null),
  ('11111111-1111-4111-8111-111111111a12', '11111111-1111-4111-8111-111111111111', 'Full-stack engineer with 12 years of production experience.',          '["Development","Web"]'::jsonb,          'Senior engineer at multiple startups.',    'https://youtube.com/watch?v=alice-demo','approved', '11111111-1111-4111-8111-111111111102'),
  ('11111111-1111-4111-8111-111111111a13', '11111111-1111-4111-8111-111111111112', 'Data scientist passionate about practical machine learning.',          '["Data Science","ML"]'::jsonb,            'PhD, ex-FAANG data scientist.',            'https://youtube.com/watch?v=brian-demo','approved', '11111111-1111-4111-8111-111111111102')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Learning stats skeleton for students
-- ---------------------------------------------------------------------
insert into public.learning_stats (user_id, total_seconds, streak_days, last_active_date, courses_completed) values
  ('11111111-1111-4111-8111-111111111121', 42000, 5,  current_date,      1),
  ('11111111-1111-4111-8111-111111111122', 98000, 12, current_date,      2),
  ('11111111-1111-4111-8111-111111111123', 15000, 2,  current_date - 1,  0),
  ('11111111-1111-4111-8111-111111111124', 60000, 8,  current_date,      1),
  ('11111111-1111-4111-8111-111111111125', 5000,  1,  current_date - 3,  0)
on conflict (user_id) do update
  set total_seconds = excluded.total_seconds,
      streak_days = excluded.streak_days,
      courses_completed = excluded.courses_completed;

-- ---------------------------------------------------------------------
-- Loyalty balances
-- ---------------------------------------------------------------------
insert into public.loyalty_points (user_id, balance, lifetime_points) values
  ('11111111-1111-4111-8111-111111111121', 320, 320),
  ('11111111-1111-4111-8111-111111111122', 1250, 1250),
  ('11111111-1111-4111-8111-111111111124', 640, 640)
on conflict (user_id) do update
  set balance = excluded.balance, lifetime_points = excluded.lifetime_points;

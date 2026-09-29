-- =====================================================================
-- SEED 06 · Orders, coupons, notifications, Q&A, messages,
--           course announcements & a live class
--
-- Depends on 02 (users), 03 (courses/lessons), 05 (enrollments).
-- Fixed UUID bases:
--   orders            a1a1a1a1-...   order_items       a2a2a2a2-...
--   coupons           a3a3a3a3-...   notifications     c1c1c1c1-...
--   qa_threads        c2c2c2c2-...   messages          c3c3c3c3-...
--   course_announce   c4c4c4c4-...   live_classes      c5c5c5c5-...
-- =====================================================================

-- ---------------------------------------------------------------------
-- Paid orders (history) with per-item instructor earnings
--   commission 20% -> instructor keeps 80%
-- ---------------------------------------------------------------------
insert into public.orders
  (id, user_id, status, currency, subtotal_cents, discount_cents, total_cents,
   commission_percent, commission_cents, items, paid_at, created_at) values
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a101','11111111-1111-4111-8111-111111111121','paid','usd',8999,0,8999,20,1800,
   '[{"course_id":"44444444-4444-4444-8444-444444444401","title":"Vue 3 & Pinia","price_cents":8999,"instructor_id":"11111111-1111-4111-8111-111111111111"}]'::jsonb,
   now() - interval '4 days', now() - interval '4 days'),
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a102','11111111-1111-4111-8111-111111111122','paid','usd',9499,950,8549,20,1710,
   '[{"course_id":"44444444-4444-4444-8444-444444444402","title":"Node.js & Express","price_cents":9499,"instructor_id":"11111111-1111-4111-8111-111111111111"}]'::jsonb,
   now() - interval '2 days', now() - interval '2 days'),
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a103','11111111-1111-4111-8111-111111111123','paid','usd',7499,0,7499,20,1500,
   '[{"course_id":"44444444-4444-4444-8444-444444444404","title":"UI/UX Design System","price_cents":7499,"instructor_id":"11111111-1111-4111-8111-111111111113"}]'::jsonb,
   now() - interval '3 days', now() - interval '3 days'),
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a104','11111111-1111-4111-8111-111111111124','pending','usd',8999,0,8999,20,0,
   '[{"course_id":"44444444-4444-4444-8444-444444444401","title":"Vue 3 & Pinia","price_cents":8999,"instructor_id":"11111111-1111-4111-8111-111111111111"}]'::jsonb,
   null, now() - interval '20 minutes')
on conflict (id) do update
  set status = excluded.status, total_cents = excluded.total_cents, paid_at = excluded.paid_at;

insert into public.order_items (id, order_id, course_id, price_cents, instructor_earnings_cents) values
  ('a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a201','a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a101','44444444-4444-4444-8444-444444444401',8999,7199),
  ('a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a202','a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a102','44444444-4444-4444-8444-444444444402',8549,6839),
  ('a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a203','a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a103','44444444-4444-4444-8444-444444444404',7499,5999)
on conflict (id) do nothing;

-- link those orders to the matching enrollments
update public.enrollments set order_id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a101'
 where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb01';
update public.enrollments set order_id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a102'
 where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb03';
update public.enrollments set order_id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a103'
 where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb05';

-- ---------------------------------------------------------------------
-- Coupons
-- ---------------------------------------------------------------------
insert into public.coupons
  (id, code, scope, course_id, applicable_instructor_id, percent_off, amount_off,
   min_order_cents, max_redemptions, expires_at, is_active, created_by) values
  ('a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a301','WELCOME10','platform',null,null,10,null,2000,1000, now() + interval '90 days', true,'11111111-1111-4111-8111-111111111102'),
  ('a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a302','VUECOURSE25','course','44444444-4444-4444-8444-444444444401',null,25,null,null, now() + interval '30 days', true,'11111111-1111-4111-8111-111111111111'),
  ('a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a303','ALICE5','platform',null,'11111111-1111-4111-8111-111111111111',null,500,5000, null, true,'11111111-1111-4111-8111-111111111111')
on conflict (code) do update
  set percent_off = excluded.percent_off, amount_off = excluded.amount_off, is_active = excluded.is_active;

-- ---------------------------------------------------------------------
-- Notifications (in-app bell)
-- ---------------------------------------------------------------------
insert into public.notifications (id, user_id, type, title, body, link, read) values
  ('c1c1c1c1-c1c1-4c1a-8c1c-c1c1c1c1c101','11111111-1111-4111-8111-111111111121','purchase','Order confirmed','You are enrolled in Vue 3 & Pinia. Happy learning!','/student/dashboard',false),
  ('c1c1c1c1-c1c1-4c1a-8c1c-c1c1c1c1c102','11111111-1111-4111-8111-111111111121','certificate','Certificate issued','Your certificate for Practical Machine Learning is ready.','/student/certificates',false),
  ('c1c1c1c1-c1c1-4c1a-8c1c-c1c1c1c1c103','11111111-1111-4111-8111-111111111111','new_enrollment','New student','Eve Martinez enrolled in Vue 3 & Pinia.','/instructor/courses',true),
  ('c1c1c1c1-c1c1-4c1a-8c1c-c1c1c1c1c104','11111111-1111-4111-8111-111111111114','course_moderation','Course awaiting review','Digital Marketing Bootcamp 2025 is in the moderation queue.','/admin/moderation',false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Q&A thread (question + instructor answer)
-- ---------------------------------------------------------------------
insert into public.qa_threads (id, course_id, lesson_id, author_id, parent_id, question, answer, is_instructor_answer, upvotes, accepted) values
  ('c2c2c2c2-c2c2-4c2a-8c2c-c2c2c2c2c201','44444444-4444-4444-8444-444444444401','66666666-6666-4666-8666-666666666603','11111111-1111-4111-8111-111111111121',null,
   'When should I use ref vs reactive?', null, false, 4, false),
  ('c2c2c2c2-c2c2-4c2a-8c2c-c2c2c2c2c202','44444444-4444-4444-8444-444444444401','66666666-6666-4666-8666-666666666603','11111111-1111-4111-8111-111111111111','c2c2c2c2-c2c2-4c2a-8c2c-c2c2c2c2c201',
   null,'Use ref() for primitives and reactive() for objects. ref works everywhere; reactive cannot be reassigned.', true, 9, true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Direct message (student -> instructor)
-- ---------------------------------------------------------------------
insert into public.messages (id, sender_id, recipient_id, course_id, body, read) values
  ('c3c3c3c3-c3c3-4c3a-8c3c-c3c3c3c3c301','11111111-1111-4111-8111-111111111123','11111111-1111-4111-8111-111111111113','44444444-4444-4444-8444-444444444404',
   'Hi Carla, will there be a Figma components file in the resources?', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Course announcement
-- ---------------------------------------------------------------------
insert into public.course_announcements (id, course_id, author_id, title, body) values
  ('c4c4c4c4-c4c4-4c4a-8c4c-c4c4c4c4c401','44444444-4444-4444-8444-444444444401','11111111-1111-4111-8111-111111111111',
   'New module: advanced Pinia patterns','A new section on plugin authoring and SSR-safe stores is live. Enjoy!')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Live class (scheduled) + one enrolled attendee
-- ---------------------------------------------------------------------
insert into public.live_classes
  (id, instructor_id, course_id, title, description, starts_at, duration_minutes, is_public, status) values
  ('c5c5c5c5-c5c5-4c5a-8c5c-c5c5c5c5c501','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444401',
   'Q&A: Build a Dashboard Live','Bring your questions — we will wire up a real dashboard together.',
   now() + interval '2 days', 90, false, 'scheduled')
on conflict (id) do update set title = excluded.title, starts_at = excluded.starts_at;

insert into public.live_class_attendance (id, live_class_id, user_id) values
  ('c5c5c5c5-c5c5-4c5b-8c5b-b5b5b5b5b501','c5c5c5c5-c5c5-4c5a-8c5c-c5c5c5c5c501','11111111-1111-4111-8111-111111111121')
on conflict (live_class_id, user_id) do nothing;

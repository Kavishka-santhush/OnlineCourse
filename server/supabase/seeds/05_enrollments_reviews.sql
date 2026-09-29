-- =====================================================================
-- SEED 05 · Enrollments, progress, certificates, reviews & wishlist
--
-- Depends on 02 (users), 03 (courses/lessons).
-- Fixed UUID bases:
--   enrollments      bbbbbbbb-...
--   lesson_progress  cccccccc-...
--   certificates     dddddddd-...
--   reviews          eeeeeeee-...
--   wishlist         ffffffff-...
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enrollments
-- ---------------------------------------------------------------------
insert into public.enrollments
  (id, user_id, course_id, source, status, progress_percent, last_accessed_at, completed_at) values
  -- Eve: Vue in progress, ML completed
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb01','11111111-1111-4111-8111-111111111121','44444444-4444-4444-8444-444444444401','purchase','active',42, now() - interval '1 day', null),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb02','11111111-1111-4111-8111-111111111121','44444444-4444-4444-8444-444444444403','free','completed',100, now() - interval '6 days', now() - interval '6 days'),
  -- Frank: Node in progress, ML completed
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb03','11111111-1111-4111-8111-111111111122','44444444-4444-4444-8444-444444444402','purchase','active',65, now() - interval '2 hours', null),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb04','11111111-1111-4111-8111-111111111122','44444444-4444-4444-8444-444444444403','free','completed',100, now() - interval '9 days', now() - interval '9 days'),
  -- Grace: UI/UX just started
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb05','11111111-1111-4111-8111-111111111123','44444444-4444-4444-8444-444444444404','purchase','active',10, now() - interval '3 days', null),
  -- Henry: Vue enrolled, barely started
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb06','11111111-1111-4111-8111-111111111124','44444444-4444-4444-8444-444444444401','purchase','active',5, now() - interval '5 days', null),
  -- Irene: ML in progress
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb07','11111111-1111-4111-8111-111111111125','44444444-4444-4444-8444-444444444403','free','active',33, now() - interval '1 day', null)
on conflict (user_id, course_id) do update
  set status = excluded.status, progress_percent = excluded.progress_percent,
      completed_at = excluded.completed_at;

-- ---------------------------------------------------------------------
-- Lesson progress (per completed/started lesson)
-- ---------------------------------------------------------------------
insert into public.lesson_progress (id, user_id, course_id, lesson_id, completed, position_seconds, watched_seconds, completed_at) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc01','11111111-1111-4111-8111-111111111121','44444444-4444-4444-8444-444444444401','66666666-6666-4666-8666-666666666601',true,0,240, now() - interval '4 days'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc02','11111111-1111-4111-8111-111111111121','44444444-4444-4444-8444-444444444401','66666666-6666-4666-8666-666666666602',true,0,720, now() - interval '3 days'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc03','11111111-1111-4111-8111-111111111121','44444444-4444-4444-8444-444444444401','66666666-6666-4666-8666-666666666603',false,410,410,null),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc04','11111111-1111-4111-8111-111111111122','44444444-4444-4444-8444-444444444402','66666666-6666-4666-8666-666666666611',true,0,900, now() - interval '2 days'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc05','11111111-1111-4111-8111-111111111122','44444444-4444-4444-8444-444444444402','66666666-6666-4666-8666-666666666612',true,0,780, now() - interval '1 day')
on conflict (user_id, lesson_id) do update
  set completed = excluded.completed, position_seconds = excluded.position_seconds,
      watched_seconds = excluded.watched_seconds;

-- ---------------------------------------------------------------------
-- Certificates for completed enrollments
-- ---------------------------------------------------------------------
insert into public.certificates
  (id, user_id, course_id, student_name, course_title, instructor_name, issued_at, verify_url) values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd01','11111111-1111-4111-8111-111111111121','44444444-4444-4444-8444-444444444403','Eve Martinez','Practical Machine Learning with Python','Brian Cole', to_char(now() - interval '6 days','DD Mon YYYY'), null),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd02','11111111-1111-4111-8111-111111111122','44444444-4444-4444-8444-444444444403','Frank Lee','Practical Machine Learning with Python','Brian Cole', to_char(now() - interval '9 days','DD Mon YYYY'), null)
on conflict (user_id, course_id) do nothing;

-- ---------------------------------------------------------------------
-- Reviews (only from enrolled students)
-- ---------------------------------------------------------------------
insert into public.reviews (id, course_id, user_id, rating, body, is_verified, helpful_count) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee01','44444444-4444-4444-8444-444444444401','11111111-1111-4111-8111-111111111121',5,'Crystal clear explanations, the Pinia section finally made state click for me.',true,14),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee02','44444444-4444-4444-8444-444444444402','11111111-1111-4111-8111-111111111122',4,'Great backend walkthrough. Would love even more on WebSockets.',true,6),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee03','44444444-4444-4444-8444-444444444403','11111111-1111-4111-8111-111111111121',5,'Best free intro to pandas I have found. Highly recommend.',true,22),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee04','44444444-4444-4444-8444-444444444404','11111111-1111-4111-8111-111111111123',5,'The design-token chapter reshaped how I build UI kits.',true,3)
on conflict (course_id, user_id) do update
  set rating = excluded.rating, body = excluded.body;

-- one instructor reply
update public.reviews
   set instructor_response = 'Thank you Eve! The next module goes deeper into stores.', responded_at = now() - interval '1 day'
 where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee01';

-- ---------------------------------------------------------------------
-- Wishlist (price snapshot for price-drop alerts)
-- ---------------------------------------------------------------------
insert into public.wishlist (id, user_id, course_id, price_at_add) values
  ('ffffffff-ffff-4fff-8fff-ffffffffffff01','11111111-1111-4111-8111-111111111123','44444444-4444-4444-8444-444444444401',89.99),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff02','11111111-1111-4111-8111-111111111123','44444444-4444-4444-8444-444444444402',94.99),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff03','11111111-1111-4111-8111-111111111124','44444444-4444-4444-8444-444444444404',74.99),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff04','11111111-1111-4111-8111-111111111125','44444444-4444-4444-8444-444444444401',89.99)
on conflict (user_id, course_id) do update set price_at_add = excluded.price_at_add;

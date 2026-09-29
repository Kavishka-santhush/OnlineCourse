-- =====================================================================
-- SEED 04 · Quizzes, questions, question bank & assignments
--
-- Depends on 02 (users) and 03 (courses/lessons).
-- Fixed UUID bases:
--   quizzes                77777777-7777-4777-8777-7777777777NN
--   quiz_questions         88888888-8888-4888-8888-8888888888NN
--   question_bank          8bbbbbbb-...
--   assignments            99999999-9999-4999-8999-9999999999NN
--   assignment_submissions aaaaaaaa-...
-- =====================================================================

-- ---------------------------------------------------------------------
-- Quizzes (linked to the 'quiz' lesson of the Vue course)
-- ---------------------------------------------------------------------
insert into public.quizzes
  (id, course_id, lesson_id, instructor_id, title, instructions,
   time_limit_minutes, max_attempts, passing_score, shuffle_questions, show_answers_after) values
  ('77777777-7777-4777-8777-777777777701','44444444-4444-4444-8444-444444444401','66666666-6666-4666-8666-666666666606','11111111-1111-4111-8111-111111111111',
   'Reactivity & Pinia Checkpoint','Answer every question. You need 70% to pass.',10,3,70,true,true)
on conflict (id) do update set title = excluded.title, instructions = excluded.instructions;

insert into public.quiz_questions
  (id, quiz_id, type, prompt, options, correct_answers, explanation, points, difficulty, position) values
  ('88888888-8888-4888-8888-888888888801','77777777-7777-4777-8777-777777777701','multiple_choice',
   'Which API creates a reactive primitive in Vue 3?', '["react()","ref()","signal()","observable()"]'::jsonb, '[1]'::jsonb,
   'ref() wraps a primitive in a reactive object you access via .value.',1,'easy',1),
  ('88888888-8888-4888-8888-888888888802','77777777-7777-4777-8777-777777777701','multiple_select',
   'Which are Pinia store options?', '["state","getters","actions","reducers"]'::jsonb, '[0,1,2]'::jsonb,
   'Pinia stores use state, getters and actions (no reducers — that is Redux).',2,'medium',2),
  ('88888888-8888-4888-8888-888888888803','77777777-7777-4777-8777-777777777701','true_false',
   'computed() in Vue re-evaluates on every render.', '["True","False"]'::jsonb, '[1]'::jsonb,
   'computed values are cached and only recompute when a dependency changes.',1,'easy',3),
  ('88888888-8888-4888-8888-888888888804','77777777-7777-4777-8777-777777777701','short_answer',
   'Name the Composition API function used to run code after the DOM is ready.', '[]'::jsonb, '["onmounted","on mount","onmount"]'::jsonb,
   'onMounted fires after the component is mounted to the DOM.',2,'medium',4)
on conflict (id) do update set prompt = excluded.prompt, options = excluded.options,
  correct_answers = excluded.correct_answers;

-- ---------------------------------------------------------------------
-- Reusable question bank entries
-- ---------------------------------------------------------------------
insert into public.question_bank (id, instructor_id, type, prompt, options, correct_answers, explanation, difficulty) values
  ('8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','11111111-1111-4111-8111-111111111111','multiple_choice',
   'What does v-model do?','["Binds two-way data","Loops a list","Conditionally renders","Refs an element"]'::jsonb,'[0]'::jsonb,
   'v-model creates two-way binding on a form element or component.','easy'),
  ('8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','11111111-1111-4111-8111-111111111112','multiple_choice',
   'Which pandas method shows dataset summary statistics?','["describe()","info()","head()","sum()"]'::jsonb,'[0]'::jsonb,
   'DataFrame.describe() returns count/mean/std/min/max/quartiles.','easy')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Assignments (linked to the 'assignment' lesson of the Vue course)
-- ---------------------------------------------------------------------
insert into public.assignments
  (id, course_id, lesson_id, instructor_id, title, instructions, due_date,
   max_points, allow_late, late_penalty_percent, peer_review, rubric) values
  ('99999999-9999-4999-8999-999999999901','44444444-4444-4444-8444-444444444401','66666666-6666-4666-8666-666666666607','11111111-1111-4111-8111-111111111111',
   'Build a Pinia Counter Store',
   '<p>Create a store with <code>count</code> state, an <code>increment</code> action and a <code>doubled</code> getter. Upload the file and a short note.</p>',
   now() + interval '14 days', 100, true, 10, false,
   '[{"criterion":"Correct state","max_points":40},{"criterion":"Action works","max_points":30},{"criterion":"Getter correct","max_points":30}]'::jsonb)
on conflict (id) do update set title = excluded.title, instructions = excluded.instructions;

insert into public.assignment_submissions
  (id, assignment_id, user_id, text_submission, files, status, score, feedback, submitted_at, graded_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','99999999-9999-4999-8999-999999999901','11111111-1111-4111-8111-111111111121',
   'Here is my counter store implementation.',
   '[{"name":"counter.js","url":"files/seed/counter.js","path":"files/seed/users/11111111-1111-4111-8111-111111111121/counter.js"}]'::jsonb,
   'graded', 92, 'Nicely done — the getter could use a computed for clarity.',
   now() - interval '3 days', now() - interval '2 days')
on conflict (id) do nothing;

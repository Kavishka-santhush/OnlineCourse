-- =====================================================================
-- SEED 03 · Courses + curriculum (sections & lessons)
--
-- Depends on 01 (categories) and 02 (users).
-- Fixed UUID bases:
--   courses   44444444-4444-4444-8444-4444444444NN
--   sections  55555555-5555-4555-8555-5555555555NN
--   lessons   66666666-6666-4666-8666-6666666666NN
--
-- Lessons are inserted with status='published' so the
-- recalc_course_totals trigger keeps total_lessons / duration accurate.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------
insert into public.courses
  (id, instructor_id, title, subtitle, description, slug, category_id, subcategory_id, tags,
   level, language, price, currency, is_free, learning_objectives, requirements, target_audience,
   thumbnail_url, status, is_featured, published_at,
   enrollment_count, rating_avg, rating_count, review_count) values

  ('44444444-4444-4444-8444-444444444401','11111111-1111-4111-8111-111111111111',
   'Vue 3 & Pinia: The Complete Frontend Guide','Build production SPA dashboards with the Composition API',
   '<p>Master Vue 3 from the ground up: reactivity, the Composition API, components, Vue Router, Pinia state management, and deploying a real dashboard. Includes a full marketplace UI project.</p>',
   'vue3-pinia-complete','22222222-2222-4222-8222-222222222201','22222222-2222-4222-8222-222222222301',
   array['vue','javascript','frontend','pinia','spa'],'Beginner','English',89.99,'usd',false,
   array['Build SPAs with Vue 3 Composition API','Manage state with Pinia','Route with Vue Router 4','Ship a production dashboard'],
   array['Basic HTML/CSS/JS'],'Aspiring front-end developers',
   'https://picsum.photos/seed/vue3/640/360','published',true, now() - interval '30 days',
   1280, 4.80, 342, 342),

  ('44444444-4444-4444-8444-444444444402','11111111-1111-4111-8111-111111111111',
   'Node.js & Express REST API Mastery','Design secure, scalable APIs with auth, uploads & payments',
   '<p>A hands-on backend course: Express architecture, JWT/Clerk auth, Supabase, Stripe payments, file uploads, WebSockets and testing. You will build the exact API that powers this marketplace.</p>',
   'node-express-rest-mastery','22222222-2222-4222-8222-222222222201','22222222-2222-4222-8222-222222222301',
   array['node','express','backend','rest','api'],'Intermediate','English',94.99,'usd',false,
   array['Design REST APIs','Add auth & role checks','Integrate Stripe & uploads','Realtime with WebSockets'],
   array['Comfortable with JavaScript'],'Backend & full-stack developers',
   'https://picsum.photos/seed/node/640/360','published',true, now() - interval '21 days',
   940, 4.70, 210, 210),

  ('44444444-4444-4444-8444-444444444403','11111111-1111-4111-8111-111111111112',
   'Practical Machine Learning with Python','From pandas to production models — no fluff',
   '<p>Learn applied ML: data wrangling with pandas, scikit-learn models, feature engineering, evaluation and deploying a model. Free beginner course to grow your audience.</p>',
   'practical-machine-learning-python','22222222-2222-4222-8222-222222222208','22222222-2222-4222-8222-222222222312',
   array['python','machine-learning','data-science','pandas'],'All Levels','English',0,'usd',true,
   array['Wrangle data with pandas','Train & evaluate models','Deploy a model'],
   array['Basic Python'],'Analysts & developers new to ML',
   'https://picsum.photos/seed/ml/640/360','published',true, now() - interval '14 days',
   3120, 4.60, 588, 588),

  ('44444444-4444-4444-8444-444444444404','11111111-1111-4111-8111-111111111113',
   'UI/UX Design System from Scratch','Design accessible, consistent product interfaces',
   '<p>Build a complete design system: tokens, components, accessibility, and prototyping in Figma. Great for designers and front-end devs who want pixel-perfect UIs.</p>',
   'uiux-design-system-scratch','22222222-2222-4222-8222-222222222203','22222222-2222-4222-8222-222222222307',
   array['design','ui','ux','figma','accessibility'],'Intermediate','English',74.99,'usd',false,
   array['Define design tokens','Build a component library','Prototype & hand off'],
   array['An eye for detail'],'Designers & front-end devs',
   'https://picsum.photos/seed/uiux/640/360','published',false, now() - interval '10 days',
   512, 4.75, 96, 96),

  ('44444444-4444-4444-8444-444444444405','11111111-1111-4111-8111-111111111114',
   'Digital Marketing Bootcamp 2025','SEO, funnels & paid ads that actually convert',
   '<p>A practical marketing program: positioning, SEO, email funnels and paid acquisition. Awaiting moderation approval before going live.</p>',
   'digital-marketing-bootcamp-2025','22222222-2222-4222-8222-222222222204','22222222-2222-4222-8222-222222222309',
   array['marketing','seo','funnels','ads'],'Beginner','English',69.99,'usd',false,
   array['Build a marketing funnel','Rank with SEO','Run profitable ads'],
   array['None'],'Founders & marketers',
   'https://picsum.photos/seed/mkt/640/360','submitted',false, null,
   0, 0, 0, 0),

  ('44444444-4444-4444-8444-444444444406','11111111-1111-4111-8111-111111111111',
   'TypeScript Deep Dive','Type-safe JavaScript for large applications',
   '<p>Work-in-progress draft: generics, discriminated unions, utility types and advanced inference. Currently only visible to its instructor.</p>',
   'typescript-deep-dive','22222222-2222-4222-8222-222222222201','22222222-2222-4222-8222-222222222301',
   array['typescript','javascript'],'Advanced','English',79.99,'usd',false,
   array['Model domains with types','Master generics'],'Experienced JS developers',
   'https://picsum.photos/seed/ts/640/360','draft',false, null,
   0, 0, 0, 0)
on conflict (slug) do update
  set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description,
      category_id = excluded.category_id, subcategory_id = excluded.subcategory_id,
      tags = excluded.tags, level = excluded.level, price = excluded.price, is_free = excluded.is_free,
      thumbnail_url = excluded.thumbnail_url, status = excluded.status, is_featured = excluded.is_featured;

-- ---------------------------------------------------------------------
-- Sections
-- ---------------------------------------------------------------------
insert into public.sections (id, course_id, title, position) values
  ('55555555-5555-4555-8555-555555555501','44444444-4444-4444-8444-444444444401','Getting Started',1),
  ('55555555-5555-4555-8555-555555555502','44444444-4444-4444-8444-444444444401','Reactivity & Composition API',2),
  ('55555555-5555-4555-8555-555555555503','44444444-4444-4444-8444-444444444401','State with Pinia',3),
  ('55555555-5555-4555-8555-555555555511','44444444-4444-4444-8444-444444444402','Express Fundamentals',1),
  ('55555555-5555-4555-8555-555555555512','44444444-4444-4444-8444-444444444402','Auth, Payments & Realtime',2),
  ('55555555-5555-4555-8555-555555555521','44444444-4444-4444-8444-444444444403','Data Wrangling',1),
  ('55555555-5555-4555-8555-555555555522','44444444-4444-4444-8444-444444444403','Modelling',2),
  ('55555555-5555-4555-8555-555555555531','44444444-4444-4444-8444-444444444404','Foundations',1),
  ('55555555-5555-4555-8555-555555555541','44444444-4444-4444-8444-444444444405','Strategy & SEO',1)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Lessons (video / article / pdf / quiz / assignment)
--   first lesson of the first section of featured courses is a preview
-- ---------------------------------------------------------------------
insert into public.lessons
  (id, course_id, section_id, title, type, content, position, duration_seconds, is_preview,
   requires_completion, video_url, video_path, status) values

  -- Course 1 (Vue)
  ('66666666-6666-4666-8666-666666666601','44444444-4444-4444-8444-444444444401','55555555-5555-4555-8555-555555555501','Welcome & Course Overview','video',null,1,240,true,true,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4','videos/seed/vue-welcome.mp4','published'),
  ('66666666-6666-4666-8666-666666666602','44444444-4444-4444-8444-444444444401','55555555-5555-4555-8555-555555555501','Setting Up Vite & DevTools','video',null,2,720,false,true,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4','videos/seed/vue-setup.mp4','published'),
  ('66666666-6666-4666-8666-666666666603','44444444-4444-4444-8444-444444444401','55555555-5555-4555-8555-555555555502','ref, reactive & computed','video',null,1,980,false,true,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4','videos/seed/vue-reactivity.mp4','published'),
  ('66666666-6666-4666-8666-666666666604','44444444-4444-4444-8444-444444444401','55555555-5555-4555-8555-555555555502','Lifecycle & Watchers (article)','article','<h2>Lifecycle hooks</h2><p>Vue runs setup once; onMounted/onUnmounted manage side effects. Use watch/watchEffect to react to state changes.</p>',2,0,false,true,null,null,'published'),
  ('66666666-6666-4666-8666-666666666605','44444444-4444-4444-8444-444444444401','55555555-5555-4555-8555-555555555503','Stores, actions & getters','video',null,1,860,false,true,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4','videos/seed/vue-pinia.mp4','published'),
  ('66666666-6666-4666-8666-666666666606','44444444-4444-4444-8444-444444444401','55555555-5555-4555-8555-555555555503','Quiz: Reactivity & Pinia','quiz',null,2,0,false,false,null,null,'published'),
  ('66666666-6666-4666-8666-666666666607','44444444-4444-4444-8444-444444444401','55555555-5555-4555-8555-555555555503','Assignment: Build a counter store','assignment','<p>Create a Pinia store with a count, an increment action and a doubled getter. Submit the file.</p>',3,0,false,true,null,null,'published'),

  -- Course 2 (Node)
  ('66666666-6666-4666-8666-666666666611','44444444-4444-4444-8444-444444444402','55555555-5555-4555-8555-555555555511','Routing & Middleware','video',null,1,900,true,true,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4','videos/seed/node-routing.mp4','published'),
  ('66666666-6666-4666-8666-666666666612','44444444-4444-4444-8444-444444444402','55555555-5555-4555-8555-555555555511','Connecting Supabase','video',null,2,780,false,true,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4','videos/seed/node-supabase.mp4','published'),
  ('66666666-6666-4666-8666-666666666613','44444444-4444-4444-8444-444444444402','55555555-5555-4555-8555-555555555512','Clerk Auth & Roles (article)','article','<h2>Auth model</h2><p>Use Clerk to authenticate, then map the Clerk subject to an app user and enforce a role hierarchy in middleware.</p>',1,0,false,true,null,null,'published'),
  ('66666666-6666-4666-8666-666666666614','44444444-4444-4444-8444-444444444402','55555555-5555-4555-8555-555555555512','Stripe Payments','video',null,2,1100,false,true,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4','videos/seed/node-stripe.mp4','published'),

  -- Course 3 (ML, free)
  ('66666666-6666-4666-8666-666666666621','44444444-4444-4444-8444-444444444403','55555555-5555-4555-8555-555555555521','pandas Crash Course','video',null,1,990,true,true,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4','videos/seed/ml-pandas.mp4','published'),
  ('66666666-6666-4666-8666-666666666622','44444444-4444-4444-8444-444444444403','55555555-5555-4555-8555-555555555521','Data Cleaning Cheatsheet (pdf)','pdf','<p>Download the data-cleaning cheatsheet PDF.</p>',2,0,false,false,null,null,'published'),
  ('66666666-6666-4666-8666-666666666623','44444444-4444-4444-8444-444444444403','55555555-5555-4555-8555-555555555522','Training your first model','video',null,1,1200,false,true,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4','videos/seed/ml-model.mp4','published'),

  -- Course 4 (UI/UX)
  ('66666666-6666-4666-8666-666666666631','44444444-4444-4444-8444-444444444404','55555555-5555-4555-8555-555555555531','Design Tokens','video',null,1,640,true,true,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4','videos/seed/ui-tokens.mp4','published'),
  ('66666666-6666-4666-8666-666666666632','44444444-4444-4444-8444-444444444404','55555555-5555-4555-8555-555555555531','Accessibility Basics (article)','article','<h2>WCAG</h2><p>Contrast, focus order, semantics and keyboard support are the four pillars to start with.</p>',2,0,false,true,null,null,'published'),

  -- Course 5 (Marketing, submitted — lessons still draft so hidden until publish)
  ('66666666-6666-4666-8666-666666666641','44444444-4444-4444-8444-444444444405','55555555-5555-4555-8555-555555555541','Positioning & ICP','video',null,1,700,false,true,
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4','videos/seed/mkt-positioning.mp4','draft')
on conflict (id) do update
  set title = excluded.title, type = excluded.type, content = excluded.content,
      duration_seconds = excluded.duration_seconds, is_preview = excluded.is_preview,
      status = excluded.status;

-- attach a resource + captions sample to one lesson
update public.lessons
   set resources = '[{"name":"Starter repo","url":"https://github.com/vuejs/vue","path":"files/seed/vue-starter.zip"}]'::jsonb,
       captions  = '{"tracks":[{"lang":"en","url":"files/seed/vue-en.vtt"}]}'::jsonb
 where id = '66666666-6666-4666-8666-666666666601';

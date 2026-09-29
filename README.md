# CourseMarket — Online Course Marketplace Platform

A complete, enterprise-grade **Udemy / Coursera-style** learning marketplace.
It ships as two independent projects:

| Folder | Stack | Role |
| ------ | ----- | ---- |
| [`server/`](server/) | Node.js · Express · Supabase · Clerk · Stripe · Socket.io · OpenRouter · Nodemailer · Puppeteer | REST API + webhooks + realtime + PDF/email services |
| [`frontend/`](frontend/) | Vue 3 (`<script setup>`) · Vue Router 4 · Pinia · Tailwind CSS · shadcn-vue · Chart.js · video.js | Single-page application (student, instructor & admin experiences) |

> Data layer is **Supabase Postgres** accessed through the Express API. SQL-only
> migrations and seeds live under [`server/supabase/`](server/supabase/) and can be
> run **directly in the Supabase SQL Editor** — no CLI required.

---

## Table of contents

1. [Feature highlights](#feature-highlights)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Provision the third-party services](#provision-the-third-party-services)
5. [Database setup (migrations & seeds)](#database-setup-migrations--seeds)
6. [Wire Clerk → Supabase (Third-Party Auth) — REQUIRED for RLS](#wire-clerk--supabase-third-party-auth)
7. [Backend setup](#backend-setup)
8. [Frontend setup](#frontend-setup)
9. [Configure webhooks (Clerk & Stripe)](#configure-webhooks-clerk--stripe)
10. [Roles & permissions](#roles--permissions)
11. [Seeded demo accounts](#seeded-demo-accounts)
12. [Available scripts](#available-scripts)
13. [Environment variable reference](#environment-variable-reference)
14. [Troubleshooting](#troubleshooting)

---

## Feature highlights

- **Catalogue & discovery** — categories/subcategories, search & filters, featured
  courses, wishlists, collections, course detail with curriculum preview & Q&A.
- **Learning** — video/audio/article/PDF lessons, resume-with-progress, notes,
  captions, quizzes (MC / multi-select / true-false / short answer / code),
  assignments with submissions & grading, certificates of completion (PDF).
- **Live classes** — Socket.io rooms, chat, participant presence, hands-up, screen-share
  signalling.
- **Instructor studio** — drag-style curriculum builder, media uploads, quiz/assignment
  managers, grading queue, earnings & payouts (Stripe Connect), analytics.
- **Commerce** — Stripe PaymentIntents, coupons, promotions/flash sales, refunds,
  subscriptions (recurring), wallets/loyalty, invoices.
- **AI layer (OpenRouter)** — course descriptions, quiz generation, tutor, summaries,
  learning paths, grading-feedback assistant, caption audit.
- **Administration** — user/role management, instructor applications & verification,
  course moderation queue, content flags, refunds & payout approvals, CMS (categories,
  pages, FAQs, blog), platform announcements, revenue reports & exports, AI-usage
  monitoring, audit log, platform settings.
- **6 roles** — Super Admin · Admin · Moderator · Instructor · Student · Guest.

---

## Architecture

```
┌──────────────┐   HTTPS/JWT    ┌──────────────────┐   service-role    ┌───────────────────┐
│  Vue 3 SPA   │ ─────────────▶ │  Express API     │ ────────────────▶ │  Supabase          │
│  (Vite)      │  /api/*        │  (Node 18+)      │                   │  Postgres + RLS    │
└──────┬───────┘                └───────┬──────────┘                   │  Storage buckets   │
       │  Clerk.js (auth UI)            │                              └───────────────────┘
       ▼                                ├─▶ Stripe (payments / connect / subscriptions)
 ┌──────────────┐                       ├─▶ OpenRouter (AI)
 │    Clerk     │  webhooks             ├─▶ SMTP / Nodemailer (transactional email)
 │  (identity)  │ ────────────────────▶ │└─▶ Puppeteer (certificate & report PDFs)
 └──────────────┘  /api/webhooks/clerk  │
       Stripe      /api/webhooks/stripe ┘─ Socket.io (live classes)  ◀── browser
```

- **Authentication is owned by Clerk.** The API verifies the Clerk session JWT on every
  request, then exchanges it for a scoped Supabase connection.
- **Authorization is enforced twice**: Express route guards (`requireAuth`,
  `requireAdmin`, `requireModerator`, `requireSuperAdmin`) **and** Postgres RLS policies
  (see [`server/supabase/migrations/020_rls.sql`](server/supabase/migrations/020_rls.sql)).
- Realtime/RLS for the browser depend on **Supabase Third-Party Auth** being configured
  with Clerk — see [step 6](#wire-clerk--supabase-third-party-auth).

---

## Prerequisites

- **Node.js ≥ 18** and npm.
- A **Supabase** project (free tier is fine) — provides Postgres, Storage and Realtime.
- A **Clerk** application (for sign-up / sign-in).
- A **Stripe** account (payments + Connect + subscriptions).
- An **OpenRouter** API key (optional; AI features degrade gracefully if unset).
- An **SMTP** server (optional; email is logged to the console if unset).

> You do **not** need the Supabase CLI. Everything runs through the SQL Editor and the
> two `.env` files.

---

## Provision the third-party services

1. **Supabase** → create a project. Collect from *Project Settings → API*:
   `Project URL`, `anon` public key, and `service_role` secret key.
2. **Clerk** → create an application. Collect the **publishable key** (frontend) and
   **secret key** (server).
3. **Stripe** → collect the **secret key**, a **publishable key**, and (for instructor
   payouts) a **Connect client ID**.
4. **OpenRouter** → create an API key.
5. **SMTP** → gather host / port / user / password / from-address.

Fill these into [`server/.env`](server/.env.example) and
[`frontend/.env`](frontend/.env.example) (copy from the `.env.example` files — full
reference in [step 13](#environment-variable-reference)).

---

## Database setup (migrations & seeds)

All SQL is plain, idempotent Postgres. **Run in the Supabase Dashboard → SQL Editor,
one file at a time, top-to-bottom**, in the exact order below. You can paste several
files into a single query and run them together as long as the order is preserved.

### 1 · Migrations — `server/supabase/migrations/`

| Order | File | Creates |
| ----- | ---- | ------- |
| 1 | `001_functions.sql` | shared helpers (`touch_updated_at`, `auth_user_id()`, `is_staff()`, triggers) |
| 2 | `002_users.sql` | `users` (roles, settings, socials) |
| 3 | `003_categories.sql` | `categories` (self-referencing tree) |
| 4 | `004_courses.sql` | `courses` |
| 5 | `005_curriculum.sql` | `sections`, `lessons`, `resources` |
| 6 | `006_quizzes.sql` | `quizzes`, `questions`, `quiz_attempts` |
| 7 | `007_assignments.sql` | `assignments`, `assignment_submissions` |
| 8 | `008_enrollment_progress.sql` | `enrollments`, `lesson_progress`, `notes`, `lecture_qa` |
| 9 | `010_reviews.sql` | `reviews`, `review_votes` |
| 10 | `011_wishlist_collections.sql` | `wishlists`, `collections` |
| 11 | `012_payments.sql` | `orders`, `order_items`, `coupons`, `payouts`, `refund_requests`, … |
| 12 | `013_subscriptions.sql` | `subscription_plans`, `subscriptions` |
| 13 | `014_live_classes.sql` | `live_classes` |
| 14 | `015_notifications.sql` | `notifications`, `notification_preferences` |
| 15 | `016_engagement.sql` | `messages`, `flags`, `certificates`, platform stuff |
| 16 | `017_ai.sql` | `ai_usage` |
| 17 | `018_content.sql` | `blog_posts`, `cms_pages`, `faqs`, `platform_settings`, `audit_logs`, `promotions` |
| 18 | `020_rls.sql` | **Row Level Security policies** for every table |
| 19 | `021_storage_buckets.sql` | Storage buckets: `videos`, `files`, `media`, `avatars`, `certs`, `docs` |
| 20 | `022_seed_bind.sql` | `bind_seed_accounts()` RPC (links Clerk signups to seeded rows) |

> Files are numbered intentionally with gaps (there is no `009`/`019`) — the sequence
> numbers just mirror logical domains. **Do not renumber them.**

### 2 · Seeds — `server/supabase/seeds/`

Run **only after all migrations succeed**, in this order (foreign keys depend on it):

1. `01_categories_plans.sql` — categories + subscription plans
2. `02_users.sql` — staff, instructors, students (placeholder Clerk ids)
3. `03_courses_curriculum.sql` — courses, sections, lessons
4. `04_quizzes_assignments.sql` — quizzes, questions, assignments
5. `05_enrollments_reviews.sql` — enrollments, progress, reviews
6. `06_commerce_engagement.sql` — orders, messages, notifications, certificates
7. `07_content_promotions.sql` — blog, pages, FAQs, promotions, announcements, settings

All seeds are **idempotent** (upserts / `on conflict do nothing`), so you may re-run
them safely.

### 3 · Storage

`021_storage_buckets.sql` creates the six buckets and their access policies. If you
override any bucket name via the `STORAGE_BUCKET_*` env vars, **change the migration and
the env var to match** — the API resolves logical keys (`videos`, `files`, …) to the
configured names at runtime.

---

## Wire Clerk → Supabase (Third-Party Auth)

This is **required** so that direct browser connections (Realtime chat in live classes,
and any client-side RLS reads) authenticate as the correct user.

1. Supabase Dashboard → **Project Settings → Authentication → Third-party Auth**.
2. **Add new instance → Clerk.** Paste your Clerk **secret key** and grant the requested
   permissions.
3. Ensure the JWT **Audience** used by the backend matches. The API mints Supabase
   requests using the verified Clerk JWT; the `users.clerk_id` column links each Supabase
   row to its Clerk subject (`auth_user_id()` reads the `sub` claim).

No further token-exchange configuration is needed — the API handles the service-role
writes; the browser uses the anon key + Clerk session for Realtime.

---

## Backend setup

```bash
cd server
npm install
cp .env.example .env      # then fill in real values
npm run dev               # nodemon → http://localhost:5000
```

- Health/root: `GET http://localhost:5000/api/…` (all REST endpoints live under `/api`).
- Webhook endpoints (mounted with **raw body**, before the JSON parser):
  - `POST /api/webhooks/clerk`
  - `POST /api/webhooks/stripe`
- Socket.io attaches to the same HTTP server for `/live-class` rooms.

---

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env      # then fill in real (public) values
npm run dev               # Vite → http://localhost:5173
```

The SPA calls `VITE_API_URL` (default `http://localhost:5000`) and appends `/api`.
Enable CORS for `http://localhost:5173` on the server via `FRONTEND_URL`.

---

## Configure webhooks (Clerk & Stripe)

### Clerk
Dashboard → **Webhooks** → add endpoint `https://<your-server>/api/webhooks/clerk`.
Subscribe at minimum to: `user.created`, `user.updated`, `user.deleted`. Copy the
generated **signing secret** into `CLERK_WEBHOOK_SECRET`.
`user.created` creates (or **binds**, via `bind_seed_accounts()`) the Supabase `users`
row and seeds notification preferences.

### Stripe
Use the CLI in development:

```bash
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

In production add the endpoint `https://<your-server>/api/webhooks/stripe` for events:
`payment_intent.succeeded`, `checkout.session.completed`,
`customer.subscription.created|updated|deleted`, `payout.*`, `charge.refunded`.
Copy the **whsec_…** signing secret into `STRIPE_WEBHOOK_SECRET`.
Enrollment fulfilment, subscription state and payouts are finalised here.

> Both handlers **skip signature verification when the secret still equals the
> `your_…` placeholder**, so local development works before you configure real webhooks.

---

## Roles & permissions

| Capability | Guest | Student | Instructor | Moderator | Admin | Super Admin |
| ---------- | :---: | :-----: | :--------: | :-------: | :---: | :---------: |
| Browse / search catalogue | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Enroll / purchase / review | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create & publish courses, grading | — | — | ✅ | ✅ | ✅ | ✅ |
| Moderate course queue & flags | — | — | — | ✅ | ✅ | ✅ |
| Manage users, instructors, commerce, content | — | — | — | — | ✅ | ✅ |
| Platform settings, promotions, delete users, announcements | — | — | — | — | — | ✅ |

Route guards use a rank hierarchy (`ROLE_RANK`); a higher role inherits everything below
it. The frontend menu and buttons additionally gate on `auth.isSuperAdmin` etc.

---

## Seeded demo accounts

These rows exist after running `02_users.sql`. They carry **placeholder** Clerk ids, so
to sign in as one, create a Clerk user with the **exact same e-mail** — the
`user.created` webhook will bind it to the seeded data automatically.

| Role | Email |
| ---- | ----- |
| Super Admin | `owner@coursemarket.test` |
| Admin | `admin@coursemarket.test` |
| Moderator | `mod@coursemarket.test` |
| Instructor (verified) | `alice.dev@gmail.test` |
| Instructor | `brian.data@gmail.test` · `carla.design@gmail.test` · `dave.biz@gmail.test` |
| Student | `eve.student@gmail.test` · `frank.student@gmail.test` · `grace.student@gmail.test` · `henry.student@gmail.test` · `irene.student@gmail.test` |

---

## Available scripts

**server/**
| Script | Command | Description |
| ------ | ------- | ----------- |
| `npm run dev` | `nodemon src/index.js` | API with auto-reload |
| `npm start` | `node src/index.js` | Production start |

**frontend/**
| Script | Command | Description |
| ------ | ------- | ----------- |
| `npm run dev` | `vite` | Dev server on `:5173` |
| `npm run build` | `vite build` | Production bundle in `dist/` |
| `npm run preview` | `vite preview` | Preview the build |
| `npm run lint` | `eslint .` | Lint Vue/JS |

---

## Environment variable reference

### `server/.env`
| Variable | Notes |
| -------- | ----- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret — API-only, **never** sent to the browser |
| `SUPABASE_ANON_KEY` | Public key (used for client-facing config) |
| `CLERK_SECRET_KEY` | Server-side Clerk key |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe `whsec_…` |
| `STRIPE_CONNECT_CLIENT_ID` | For instructor Connect onboarding |
| `OPENROUTER_API_KEY` / `OPENROUTER_BASE_URL` / `OPENROUTER_MODEL` | AI features |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | Transactional email |
| `PORT` | API port (default `5000`) |
| `FRONTEND_URL` | CORS origin + links in emails |
| `NODE_ENV` | `development` / `production` |
| `STORAGE_BUCKET_VIDEOS/_FILES/_MEDIA/_AVATARS/_CERTS/_DOCS` | Must match migration `021` |

### `frontend/.env`
| Variable | Notes |
| -------- | ----- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | **Public** anon key |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `VITE_API_URL` | API base URL, no trailing slash |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |

> Only `VITE_`-prefixed variables reach the browser. Never put a secret key in the
> frontend env.

---

## Troubleshooting

- **`relation … does not exist` while running seeds** → migrations weren't all applied
  first. Re-run migrations 1→20 in order, then seeds.
- **Live-class chat / Realtime returns `permission denied`** → Supabase Third-Party Auth
  (Clerk) isn't configured, or `020_rls.sql`/`021_storage_buckets.sql` weren't applied.
- **Uploads fail / `bucket not found`** → the `STORAGE_BUCKET_*` env values don't match
  the buckets created by `021`. Align both.
- **Sign-ups don't create a profile** → the Clerk webhook isn't reaching
  `/api/webhooks/clerk` (check the URL, that it's sent as `application/json` raw, and
  `CLERK_WEBHOOK_SECRET`).
- **Orders paid but no access granted** → Stripe webhook isn't hitting
  `/api/webhooks/stripe`; enrolment is fulfilled on `payment_intent.succeeded`.
- **CORS errors** → set `FRONTEND_URL` on the server to the exact SPA origin
  (`http://localhost:5173` in dev).
- **AI / email do nothing** → leave the keys as placeholders and the API logs to the
  console instead of failing the request.

---

*Built as a full-stack reference marketplace. No commands are run for you — follow the
steps above to provision Supabase, Clerk and Stripe, then install and start both
projects.*

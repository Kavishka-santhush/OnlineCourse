import 'dotenv/config';

/**
 * Centralised, validated environment configuration.
 * Fails fast on boot if a required variable is missing.
 */
const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CLERK_SECRET_KEY',
  'STRIPE_SECRET_KEY',
  'OPENROUTER_API_KEY',
];

function warnMissing() {
  const missing = required.filter((k) => !process.env[k] || process.env[k].startsWith('your_'));
  if (missing.length && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(`[env] Missing/placeholder env vars: ${missing.join(', ')}`);
  }
}
warnMissing();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY,
  },

  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY,
    webhookSecret: process.env.CLERK_WEBHOOK_SECRET,
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    connectClientId: process.env.STRIPE_CONNECT_CLIENT_ID,
  },

  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o',
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 2525),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'CourseMarket <no-reply@coursemarket.dev>',
  },

  // NOTE: these defaults MUST match the bucket ids created in
  // supabase/migrations/021_storage_buckets.sql. Override via env only if you
  // also rename the buckets there.
  storage: {
    videos: process.env.STORAGE_BUCKET_VIDEOS || 'videos',
    files: process.env.STORAGE_BUCKET_FILES || 'files',
    media: process.env.STORAGE_BUCKET_MEDIA || 'media',
    avatars: process.env.STORAGE_BUCKET_AVATARS || 'avatars',
    certs: process.env.STORAGE_BUCKET_CERTS || 'certs',
    docs: process.env.STORAGE_BUCKET_DOCS || 'docs',
  },
};

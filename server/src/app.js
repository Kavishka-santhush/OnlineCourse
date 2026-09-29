import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { clerkMiddleware } from '@clerk/express';
import { env } from './config/env.js';
import { api } from './routes/api.js';
import { clerkWebhook, stripeWebhook } from './controllers/webhook.controller.js';
import { notFound, errorHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: [env.frontendUrl], credentials: true }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  // Webhooks need the RAW body for signature verification — mount BEFORE json parser.
  app.post('/api/webhooks/clerk', express.raw({ type: 'application/json' }), clerkWebhook);
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);

  app.use(express.json({ limit: '25mb' })); // large base64 uploads to Supabase Storage
  app.use(express.urlencoded({ extended: true }));

  // Clerk verifies the JWT on routes that call requireAuth via getAuth(req).
  app.use(clerkMiddleware({ publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY, secretKey: env.clerk.secretKey }));

  const limiter = rateLimit({ windowMs: 60_000, max: 240, standardHeaders: true, legacyHeaders: false });
  app.use('/api', limiter);

  app.get('/', (_req, res) => res.json({ name: 'CourseMarket API', version: '1.0.0', docs: '/api/health' }));
  app.use('/api', api);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

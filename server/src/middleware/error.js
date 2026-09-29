import { env } from '../config/env.js';

export function notFound(req, res, _next) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[error]', req.method, req.originalUrl, err);
  res.status(status).json({
    error: {
      code: err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'ERROR'),
      message: status >= 500 && env.nodeEnv === 'production' ? 'Internal server error' : err.message,
      details: err.details,
      ...(env.nodeEnv !== 'production' && status >= 500 ? { stack: err.stack } : {}),
    },
  });
}

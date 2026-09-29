export class HttpError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  static badRequest(msg = 'Bad request', details) { return new HttpError(400, msg, 'BAD_REQUEST', details); }
  static unauthorized(msg = 'Authentication required') { return new HttpError(401, msg, 'UNAUTHORIZED'); }
  static forbidden(msg = 'You do not have permission to perform this action') { return new HttpError(403, msg, 'FORBIDDEN'); }
  static notFound(msg = 'Resource not found') { return new HttpError(404, msg, 'NOT_FOUND'); }
  static conflict(msg = 'Conflict') { return new HttpError(409, msg, 'CONFLICT'); }
  static unprocessable(msg, details) { return new HttpError(422, msg, 'VALIDATION_ERROR', details); }
}

/** Wrap an async route handler so rejections flow to the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

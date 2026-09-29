import { HttpError } from './httpError.js';

/**
 * Tiny schema validator (no external dep). Supports:
 *   { title: 'required|string|max:200', price: 'number|min:0', free: 'bool', category_id: 'uuid' }
 * Types: string, number, bool, uuid, date, email, array, object
 * Rules: required, min:n, max:n, in:a|b|c, optional (default when absent)
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function castType(value, type) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  switch (type) {
    case 'number': return typeof value === 'number' ? value : Number(value);
    case 'bool': return typeof value === 'boolean' ? value : Boolean(value);
    case 'array': case 'object': return value;
    default: return value;
  }
}

export function validate(schema, source, { partial = false } = {}) {
  const out = {};
  const errors = {};
  for (const [field, ruleStr] of Object.entries(schema)) {
    const rules = ruleStr.split('|');
    const type = rules.find((r) => ['string', 'number', 'bool', 'uuid', 'date', 'email', 'array', 'object'].includes(r)) || 'string';
    const required = rules.includes('required');
    let value = source[field];

    if (value === undefined || value === null || value === '') {
      if (required && !(partial && !(field in source))) {
        errors[field] = `${field} is required`;
        continue;
      }
      if (value === undefined) continue; // not provided at all
    }

    if (value !== undefined && value !== null && value !== '') {
      value = castType(value, type);
      if (type === 'number' && Number.isNaN(value)) { errors[field] = `${field} must be a number`; continue; }
      if (type === 'uuid' && !UUID_RE.test(value)) { errors[field] = `${field} must be a valid id`; continue; }
      if (type === 'email' && !EMAIL_RE.test(value)) { errors[field] = `${field} must be a valid email`; continue; }
      const min = rules.find((r) => r.startsWith('min:'));
      const max = rules.find((r) => r.startsWith('max:'));
      const oneOf = rules.find((r) => r.startsWith('in:'));
      const len = typeof value === 'number' ? value : (Array.isArray(value) ? value.length : String(value).length);
      if (min && len < Number(min.slice(4))) { errors[field] = `${field} must be ≥ ${min.slice(4)}`; continue; }
      if (max && len > Number(max.slice(4))) { errors[field] = `${field} must be ≤ ${max.slice(4)}`; continue; }
      if (oneOf && !oneOf.slice(3).split(',').includes(String(value))) { errors[field] = `${field} must be one of ${oneOf.slice(3)}`; continue; }
      out[field] = value;
    }
  }
  if (Object.keys(errors).length) throw HttpError.unprocessable('Validation failed', errors);
  return out;
}

/** Read +integer pagination params with sane bounds. */
export function pagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

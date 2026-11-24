import { format, isEmpty } from './utils.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates a single value. Returns an error message or null.
 * Rules live in `field.validation`; `field.required` is merged in by the schema normalizer.
 */
export function validateValue(field, value, values, messages) {
  const rules = field.validation || {};
  const custom = rules.messages || {};
  const msg = (key, extra = {}) =>
    format(custom[key] ?? (key !== 'required' ? rules.message : undefined) ?? messages[key], {
      label: field.label,
      ...rules,
      ...extra,
    });

  const missing = isEmpty(value) || (field.type === 'checkbox' && value === false);
  if (missing) return rules.required ? msg('required') : null;

  if (field.type === 'number' && (typeof value !== 'number' || Number.isNaN(value))) return msg('number');
  if (field.type === 'email' && !EMAIL_RE.test(String(value))) return msg('email');
  if (field.type === 'url' && !isUrl(String(value))) return msg('url');

  const comparable = field.type === 'number' ? Number(value) : value;
  if (rules.min !== undefined && comparable < rules.min) return msg('min');
  if (rules.max !== undefined && comparable > rules.max) return msg('max');

  const length = String(value).length;
  if (rules.minLength !== undefined && length < rules.minLength) return msg('minLength');
  if (rules.maxLength !== undefined && length > rules.maxLength) return msg('maxLength');

  if (rules.pattern !== undefined && !toRegExp(rules.pattern).test(String(value))) return msg('pattern');

  if (typeof rules.custom === 'function') {
    const result = rules.custom(value, values);
    if (typeof result === 'string') return format(result, { label: field.label });
    if (result === false) return msg('invalid');
  }
  return null;
}

export const toRegExp = (pattern) => (pattern instanceof RegExp ? pattern : new RegExp(pattern));

function isUrl(s) {
  try {
    return Boolean(new URL(s).protocol);
  } catch {
    return false;
  }
}

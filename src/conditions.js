import { isEmpty, sameValue } from './utils.js';

/**
 * Evaluates a `visibleWhen` rule against the current row values.
 *
 * Supported shapes:
 *   (values) => boolean
 *   { field, equals } | { field, notEquals } | { field, in: [...] } | { field, notIn: [...] }
 *   { field, empty: true|false } | { field } (truthy check)
 *   [rule, rule, ...] (all must match)
 */
export function isVisible(field, values) {
  const rule = field.visibleWhen;
  if (!rule) return true;
  if (typeof rule === 'function') return Boolean(rule(values));
  const rules = Array.isArray(rule) ? rule : [rule];
  return rules.every((r) => evaluate(r, values));
}

function evaluate(rule, values) {
  if (typeof rule === 'function') return Boolean(rule(values));
  const v = values[rule.field];
  if ('equals' in rule) return sameValue(v ?? '', rule.equals);
  if ('notEquals' in rule) return !sameValue(v ?? '', rule.notEquals);
  if ('in' in rule) return rule.in.some((x) => sameValue(v ?? '', x));
  if ('notIn' in rule) return !rule.notIn.some((x) => sameValue(v ?? '', x));
  if ('empty' in rule) return rule.empty ? isEmpty(v) : !isEmpty(v);
  return !isEmpty(v) && v !== false;
}

/** Field names referenced by a visibleWhen rule (functions cannot be inspected). */
export function conditionFields(rule) {
  if (!rule || typeof rule === 'function') return [];
  return (Array.isArray(rule) ? rule : [rule])
    .filter((r) => r && typeof r === 'object')
    .map((r) => r.field);
}

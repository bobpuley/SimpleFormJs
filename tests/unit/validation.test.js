import { describe, expect, it } from 'vitest';
import { validateValue } from '../../src/validation.js';
import { isVisible, conditionFields } from '../../src/conditions.js';
import { DEFAULT_MESSAGES as M } from '../../src/messages.js';
import { normalizeField } from '../../src/schema.js';

const v = (field, value, values = {}) => validateValue(normalizeField(field), value, values, M);

describe('validateValue', () => {
  it('required (checkbox false counts as missing)', () => {
    expect(v({ name: 'a', required: true }, '')).toBe('a is required');
    expect(v({ name: 'a', label: 'Code', required: true }, '  x')).toBeNull();
    expect(v({ name: 'ok', type: 'checkbox', required: true }, false)).toBe('ok is required');
    expect(v({ name: 'a' }, '')).toBeNull();
  });

  it('number, min/max on numbers and dates', () => {
    expect(v({ name: 'n', type: 'number' }, NaN)).toBe('n must be a number');
    expect(v({ name: 'n', type: 'number', min: 1 }, 0)).toMatch(/greater than or equal to 1/);
    expect(v({ name: 'n', type: 'number', max: 10 }, 11)).toMatch(/less than or equal to 10/);
    expect(v({ name: 'd', type: 'date', min: '2026-01-01' }, '2025-12-31')).toMatch(/2026-01-01/);
  });

  it('length, pattern, email and url', () => {
    expect(v({ name: 'c', minLength: 3 }, 'ab')).toMatch(/at least 3/);
    expect(v({ name: 'c', maxLength: 3 }, 'abcd')).toMatch(/at most 3/);
    expect(v({ name: 'c', pattern: '^[A-Z]{3}$' }, 'cdg')).toBe('c has an invalid format');
    expect(v({ name: 'c', validation: { pattern: /^\d+$/, message: 'digits only' } }, 'x')).toBe('digits only');
    expect(v({ name: 'e', type: 'email' }, 'nope')).toMatch(/valid email/);
    expect(v({ name: 'u', type: 'url' }, 'nope')).toMatch(/valid URL/);
    expect(v({ name: 'u', type: 'url' }, 'https://example.com')).toBeNull();
  });

  it('custom validators receive all values and may return a message', () => {
    const field = { name: 'end', validation: { custom: (val, all) => val >= all.start || '{label} must follow start' } };
    expect(v(field, '1', { start: '2' })).toBe('end must follow start');
    expect(v(field, '3', { start: '2' })).toBeNull();
    expect(v({ name: 'x', validation: { custom: () => false } }, 'a')).toBe('x is not valid');
  });

  it('per-rule messages override defaults', () => {
    expect(v({ name: 'a', validation: { required: true, messages: { required: 'Serve!' } } }, '')).toBe('Serve!');
  });
});

describe('isVisible', () => {
  const f = (visibleWhen) => ({ visibleWhen });
  it('supports equals/notEquals/in/notIn/empty/truthy/functions/arrays', () => {
    expect(isVisible(f({ field: 'c', equals: 'IT' }), { c: 'IT' })).toBe(true);
    expect(isVisible(f({ field: 'c', notEquals: 'IT' }), { c: 'IT' })).toBe(false);
    expect(isVisible(f({ field: 'c', in: ['IT', 'FR'] }), { c: 'FR' })).toBe(true);
    expect(isVisible(f({ field: 'c', notIn: ['IT'] }), { c: 'FR' })).toBe(true);
    expect(isVisible(f({ field: 'c', empty: true }), { c: '' })).toBe(true);
    expect(isVisible(f({ field: 'flag' }), { flag: false })).toBe(false);
    expect(isVisible(f({ field: 'flag' }), { flag: true })).toBe(true);
    expect(isVisible(f((vals) => vals.n > 2), { n: 3 })).toBe(true);
    expect(isVisible(f([{ field: 'a' }, { field: 'b', equals: 1 }]), { a: 'x', b: '1' })).toBe(true);
    expect(isVisible({}, {})).toBe(true);
  });
  it('lists referenced fields', () => {
    expect(conditionFields([{ field: 'a' }, { field: 'b' }])).toEqual(['a', 'b']);
    expect(conditionFields(() => true)).toEqual([]);
  });
});

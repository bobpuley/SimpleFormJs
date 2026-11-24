import { isEmpty } from './utils.js';

/** Handlebars passes an "options" hash as the last argument: drop it. */
const args = (list) => list.slice(0, -1);
const pad = (n) => String(n).padStart(2, '0');

/**
 * Built-in helpers, available in every template.
 *
 *   {{sql name}}          'O''Brien'  | 42 | NULL when empty
 *   {{quote name}}        "say \"hi\""  ({{quote name "'"}} for single quotes)
 *   {{upper x}} {{lower x}} {{trim x}}
 *   {{default x "fallback"}}
 *   {{json x}}            JSON literal
 *   {{now}} {{now "date"}} {{now "time"}}
 *   {{#if (eq a "IT")}}…{{/if}}  {{#if (ne a b)}}  {{#if (and a b)}}  {{#if (or a b)}}  {{#if (not a)}}
 *   {{join list ", "}}
 */
export const builtinHelpers = {
  sql(...a) {
    const [v] = args(a);
    if (isEmpty(v)) return 'NULL';
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return `'${String(v).replace(/'/g, "''")}'`;
  },
  quote(...a) {
    const [v, q] = args(a);
    const mark = typeof q === 'string' && q ? q : '"';
    const s = String(v ?? '').replace(/\\/g, '\\\\').split(mark).join(`\\${mark}`);
    return `${mark}${s}${mark}`;
  },
  upper: (...a) => String(args(a)[0] ?? '').toUpperCase(),
  lower: (...a) => String(args(a)[0] ?? '').toLowerCase(),
  trim: (...a) => String(args(a)[0] ?? '').trim(),
  default(...a) {
    const [v, fallback] = args(a);
    return isEmpty(v) ? fallback : v;
  },
  json: (...a) => JSON.stringify(args(a)[0] ?? null),
  now(...a) {
    const [fmt] = args(a);
    const d = new Date();
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    if (fmt === 'date') return date;
    if (fmt === 'time') return time;
    if (fmt === 'datetime') return `${date} ${time}`;
    return d.toISOString();
  },
  eq: (...a) => {
    const [x, y] = args(a);
    return x === y || String(x ?? '') === String(y ?? '');
  },
  ne: (...a) => !builtinHelpers.eq(...a),
  and: (...a) => args(a).every(Boolean),
  or: (...a) => args(a).some(Boolean),
  not: (...a) => !args(a)[0],
  join(...a) {
    const [list, sep] = args(a);
    return Array.isArray(list) ? list.join(typeof sep === 'string' ? sep : ', ') : String(list ?? '');
  },
};

const globalHelpers = new Map();

/** Registers a helper for every SimpleForm created afterwards. */
export function registerHelper(name, fn) {
  globalHelpers.set(name, fn);
}

export const getGlobalHelpers = () => Object.fromEntries(globalHelpers);

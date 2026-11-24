import { SimpleFormError } from './errors.js';

let uid = 0;
/** Returns a page-unique id with the given prefix. */
export const nextId = (prefix = 'sf') => `${prefix}-${++uid}`;

export const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

/** Empty means "no value was provided". `false` and `0` are real values. */
export const isEmpty = (v) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Replaces `{key}` placeholders in a message. */
export const format = (message, data = {}) =>
  String(message).replace(/\{(\w+)\}/g, (m, key) => (key in data ? String(data[key]) : m));

export function debounce(fn, ms) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

/**
 * Tiny DOM builder: h('button', { class: 'x', type: 'button', onClick }, 'Text').
 * Uses textContent for strings, so it never interprets markup.
 */
export function h(doc, tag, attrs = {}, ...children) {
  const el = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'string' ? doc.createTextNode(child) : child);
  }
  return el;
}

/** Accepts a CSS selector or an element. */
export function resolveElement(target, doc = globalThis.document) {
  if (!target) throw new SimpleFormError('SimpleForm: the "element" option is required.');
  if (typeof target === 'string') {
    if (!doc) throw new SimpleFormError('SimpleForm: no document available to resolve "' + target + '".');
    const el = doc.querySelector(target);
    if (!el) throw new SimpleFormError(`SimpleForm: no element matches "${target}".`);
    return el;
  }
  if (target && target.nodeType === 1) return target;
  throw new SimpleFormError('SimpleForm: "element" must be a CSS selector or an HTMLElement.');
}

/**
 * Normalizes option lists to [{ text, value }].
 * Accepts strings/numbers, { text, value } and { label, value } objects.
 */
export function normalizeOptions(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => {
    if (item !== null && typeof item === 'object') {
      const text = item.text ?? item.label ?? item.value;
      const value = 'value' in item ? item.value : text;
      return { text: String(text ?? ''), value };
    }
    return { text: String(item ?? ''), value: item };
  });
}

/** Loose equality used for option values coming from the DOM, URLs or CSV files. */
export const sameValue = (a, b) => a === b || String(a) === String(b);

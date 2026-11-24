import { isEmpty, isPlainObject, normalizeOptions } from './utils.js';

/**
 * Builds a loader for the options of a select/autocomplete field.
 *
 * Supported `options` shapes:
 *   ['A', 'B'] | [{ text, value }]               static list
 *   ({ values, query, signal }) => list|Promise   function (sync or async)
 *   { IT: [...], FR: [...] }                      map keyed by the value of the single `dependsOn` field
 * and `optionsUrl: '/api/cities?country={country}&q={query}'` returning a JSON array.
 *
 * Returns null when the field has no options.
 */
export function createOptionsLoader(field, { fetchImpl } = {}) {
  const { options, optionsUrl } = field;
  if (Array.isArray(options)) {
    const list = normalizeOptions(options);
    return Object.assign(() => list, { isStatic: true, list });
  }
  if (typeof options === 'function') {
    // sync functions stay sync (no flicker); async ones return a Promise
    return (ctx) => {
      const result = options(ctx);
      return isThenable(result) ? result.then(normalizeOptions) : normalizeOptions(result);
    };
  }
  if (isPlainObject(options)) {
    const [dep] = field.dependsOn;
    return (ctx) => normalizeOptions(options[ctx.values[dep]] ?? []);
  }
  if (typeof optionsUrl === 'string') {
    const keys = [...optionsUrl.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => k !== 'query');
    return async ({ values, query, signal }) => {
      // a parent field is still empty: nothing to ask the server yet
      if (keys.some((k) => isEmpty(values[k]))) return [];
      const url = optionsUrl.replace(/\{(\w+)\}/g, (m, key) =>
        encodeURIComponent(key === 'query' ? query ?? '' : values[key] ?? ''),
      );
      const doFetch = fetchImpl || globalThis.fetch;
      const res = await doFetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} while loading ${url}`);
      return normalizeOptions(await res.json());
    };
  }
  return null;
}

/** Ranks options: prefix matches first, then substring matches (case-insensitive). */
export function filterOptions(list, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return list.slice();
  const starts = [];
  const contains = [];
  for (const opt of list) {
    const text = opt.text.toLowerCase();
    if (text.startsWith(q)) starts.push(opt);
    else if (text.includes(q)) contains.push(opt);
  }
  return starts.concat(contains);
}

export const isThenable = (v) => Boolean(v) && typeof v.then === 'function';

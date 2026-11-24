import { SimpleFormError } from './errors.js';
import { SimpleForm } from './simpleform.js';
import { isPlainObject } from './utils.js';

/**
 * Loads a JSON configuration ({ schema, templates, presets, … }) from a URL.
 *   const config = await SimpleForm.loadSchema('./airport.json');
 *   SimpleForm.create({ ...config, element: '#app' });
 */
export async function loadSchema(url, { fetch: fetchImpl } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  if (typeof doFetch !== 'function') throw new SimpleFormError('SimpleForm.loadSchema: fetch is not available.');
  const res = await doFetch(url);
  if (!res.ok) throw new SimpleFormError(`SimpleForm.loadSchema: HTTP ${res.status} while loading ${url}.`);
  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new SimpleFormError(`SimpleForm.loadSchema: ${url} is not valid JSON (${err.message}).`);
  }
  if (Array.isArray(data)) data = { schema: data };
  if (!isPlainObject(data)) throw new SimpleFormError(`SimpleForm.loadSchema: ${url} must contain an object or an array of fields.`);
  return data;
}

/**
 * Builds a form from markup only (no JavaScript needed in the page):
 *
 *   <div data-simpleform>
 *     <script type="application/json" class="sf-schema">{ "schema": [...] }</script>
 *     <script type="text/templates" name="Update" data-language="sql">…</script>
 *   </div>
 *
 * or <div data-simpleform data-schema-src="airport.json">…</div>.
 * Extra options (hooks, functions) can be passed as `overrides`.
 */
export async function fromElement(element, overrides = {}) {
  let config;
  const inline = element.querySelector(':scope > script[type="application/json"].sf-schema, :scope > script[type="application/json"][data-sf-schema]');
  if (inline) {
    try {
      config = JSON.parse(inline.textContent);
    } catch (err) {
      throw new SimpleFormError(`SimpleForm: invalid JSON in .sf-schema (${err.message}).`);
    }
    if (Array.isArray(config)) config = { schema: config };
  } else if (element.dataset.schemaSrc) {
    config = await loadSchema(element.dataset.schemaSrc, overrides);
  } else {
    throw new SimpleFormError('SimpleForm: [data-simpleform] needs a <script type="application/json" class="sf-schema"> or data-schema-src.');
  }
  const { livePreview, persist } = element.dataset;
  if (livePreview !== undefined) config.livePreview = livePreview !== 'false';
  if (persist !== undefined) config.persist = persist === 'false' ? false : persist;
  return SimpleForm.create({ ...config, ...overrides, element });
}

/** Initializes every [data-simpleform] element under `root` that is not initialized yet. */
export async function autoInit(root = globalThis.document, overrides = {}) {
  if (!root) return [];
  const elements = [...root.querySelectorAll('[data-simpleform]')].filter((el) => !el.simpleForm && !el.dataset.sfPending);
  const results = await Promise.allSettled(
    elements.map(async (el) => {
      el.dataset.sfPending = 'true';
      try {
        return await fromElement(el, overrides);
      } catch (err) {
        el.dataset.sfError = err.message;
        console.error('[SimpleForm] auto-init failed for', el, err);
        throw err;
      } finally {
        delete el.dataset.sfPending;
      }
    }),
  );
  return results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
}

import { SimpleFormError } from './errors.js';
import { builtinHelpers, getGlobalHelpers } from './helpers.js';
import { escapeHtml } from './utils.js';

/*
 * Missing-value markers. During the live preview, empty required fields are replaced by
 * private-use characters that survive Handlebars, helpers (sql/upper/json…), HTML escaping and
 * syntax highlighting. They are then turned into <mark> elements.
 */
const OPEN = '';
const CLOSE = '';
const BASE = 0xe100;
export const marker = (index) => OPEN + String.fromCharCode(BASE + index) + CLOSE;
const MARKER_RE = /([-])/g;

/** Replaces markers with `replacer(index)`; used for both text and HTML output. */
export const replaceMarkers = (str, replacer) =>
  str.replace(MARKER_RE, (m, ch) => replacer(ch.charCodeAt(0) - BASE));

export const hasMarkers = (str) => str.includes(OPEN);

export class TemplateEngine {
  /**
   * @param {object} opts
   * @param {object} [opts.handlebars]  Handlebars instance (defaults to globalThis.Handlebars)
   * @param {object} [opts.helpers]     extra helpers for this instance
   * @param {{compile(source, {mode}): (ctx) => string}} [opts.engine] custom template engine
   */
  constructor({ handlebars, helpers = {}, engine } = {}) {
    if (engine) {
      if (typeof engine.compile !== 'function') {
        throw new SimpleFormError('SimpleForm: a custom "engine" must expose compile(source, { mode }).');
      }
      this.custom = engine;
      return;
    }
    const hb = handlebars || globalThis.Handlebars;
    if (!hb || typeof hb.create !== 'function') {
      throw new SimpleFormError(
        'SimpleForm: Handlebars is required. Load it before creating a form, e.g. ' +
          'https://cdn.jsdelivr.net/npm/handlebars@4.7.8/dist/handlebars.min.js, or pass { handlebars } / { engine }.',
      );
    }
    this.hb = hb.create(); // isolated environment: our helpers never leak into the page
    const all = { ...builtinHelpers, ...getGlobalHelpers(), ...helpers };
    for (const [name, fn] of Object.entries(all)) this.hb.registerHelper(name, fn);
  }

  /**
   * Compiles a template. `mode: 'text'` and `mode: 'plain'` disable HTML escaping (the output is
   * shown as text, never parsed as HTML); `mode: 'html'` keeps Handlebars escaping so values cannot
   * inject markup.
   * Syntax errors are reported immediately, not at first render.
   */
  compile(source, { mode = 'text', name = 'template' } = {}) {
    try {
      if (this.custom) return this.custom.compile(source, { mode });
      this.hb.parse(source);
      return this.hb.compile(source, { noEscape: mode !== 'html', strict: false });
    } catch (err) {
      throw new SimpleFormError(`SimpleForm: template "${name}" cannot be compiled: ${err.message}`);
    }
  }
}

/** Text output to safe HTML (escaped + optional highlighting) with <mark> for missing values. */
export function toPreviewHtml(text, { language, highlight, labels }) {
  const html = highlight ? highlight(text, language) : escapeHtml(text);
  return replaceMarkers(
    html,
    (i) => `<mark class="sf-missing" data-field="${escapeHtml(labels[i]?.name ?? '')}">${escapeHtml(labels[i]?.label ?? '?')}</mark>`,
  );
}

/** Strips markers (used for values that must never contain them, e.g. file names). */
export const stripMarkers = (str) => replaceMarkers(str, () => '');

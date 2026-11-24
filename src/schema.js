import { SimpleFormError } from './errors.js';
import { conditionFields } from './conditions.js';
import { hasFieldType, fieldTypes } from './fields/registry.js';
import { DEFAULT_MESSAGES } from './messages.js';
import { isPlainObject } from './utils.js';

const NAME_RE = /^[A-Za-z_$][\w$]*$/;
/** Names injected by SimpleForm in the template context. */
export const RESERVED_NAMES = ['rows', 'count', 'index', 'isFirst', 'isLast'];
/** text = code block, plain = regular text, html = rendered markup. */
const MODES = ['text', 'plain', 'html'];
const PERSIST = [false, 'url', 'local'];

/** Turns the user configuration into a predictable shape. Does not throw. */
export function normalizeConfig(config = {}) {
  const batch = config.batch
    ? { min: 1, max: Infinity, csv: true, initialRows: 1, ...(isPlainObject(config.batch) ? config.batch : {}) }
    : null;
  return {
    element: config.element,
    schema: Array.isArray(config.schema) ? config.schema.map(normalizeField) : config.schema,
    templates: normalizeTemplates(config.templates),
    livePreview: config.livePreview !== false,
    persist: config.persist ?? false,
    persistKey: config.persistKey,
    presets: config.presets ?? null,
    batch,
    highlight: config.highlight ?? true,
    handlebars: config.handlebars,
    engine: config.engine,
    helpers: config.helpers ?? {},
    fetch: config.fetch,
    messages: { ...DEFAULT_MESSAGES, ...(config.messages || {}) },
    hooks: {
      onChange: config.onChange,
      onRender: config.onRender,
      onInvalid: config.onInvalid,
      onCopy: config.onCopy,
      onError: config.onError,
    },
    title: config.title,
    description: config.description,
  };
}

export function normalizeField(field) {
  if (!isPlainObject(field)) return field;
  const name = field.name ?? field.fieldName; // fieldName = 1.x compatibility
  const validation = { ...(field.validation || {}) };
  if (field.required !== undefined && validation.required === undefined) validation.required = field.required;
  for (const key of ['min', 'max', 'minLength', 'maxLength', 'pattern']) {
    if (field[key] !== undefined && validation[key] === undefined) validation[key] = field[key];
  }
  const options = field.options ?? field.values;
  const type = field.type ?? (options !== undefined || field.optionsUrl ? 'select' : 'text');
  const dependsOn = field.dependsOn === undefined ? [] : [].concat(field.dependsOn);
  return {
    ...field,
    name,
    type,
    label: field.label ?? name,
    options,
    dependsOn,
    validation,
    attrs: field.attrs || {},
  };
}

/**
 * Templates may be given as
 *   { key: "source" } | { key: { source, title, mode, language, filename, perRow, separator } } | [{ name, source, … }]
 */
export function normalizeTemplates(templates) {
  if (!templates) return [];
  const entries = Array.isArray(templates)
    ? templates.map((t, i) => [t?.key ?? t?.name ?? `template${i + 1}`, t])
    : Object.entries(templates);
  return entries.map(([key, t]) => {
    const def = typeof t === 'string' ? { source: t } : { ...t };
    return {
      key: String(key),
      title: def.title ?? def.name ?? String(key),
      source: def.source,
      mode: def.mode ?? 'text',
      language: def.language,
      filename: def.filename,
      perRow: Boolean(def.perRow),
      separator: def.separator ?? '\n',
    };
  });
}

/** Returns a list of human readable problems (empty when the config is valid). */
export function validateConfig(cfg) {
  const problems = [];
  const fields = cfg.schema;

  if (!Array.isArray(fields) || fields.length === 0) {
    problems.push('"schema" must be a non-empty array of fields.');
    return problems;
  }

  const names = new Set();
  fields.forEach((f, i) => {
    const where = `schema[${i}]`;
    if (!isPlainObject(f)) {
      problems.push(`${where} must be an object.`);
      return;
    }
    if (typeof f.name !== 'string' || !NAME_RE.test(f.name)) {
      problems.push(`${where}: "name" must be a valid identifier (letters, digits, _ or $), got ${JSON.stringify(f.name)}.`);
    } else if (names.has(f.name)) {
      problems.push(`${where}: duplicate field name "${f.name}".`);
    } else if (RESERVED_NAMES.includes(f.name)) {
      problems.push(`${where}: "${f.name}" is reserved (${RESERVED_NAMES.join(', ')}).`);
    }
    names.add(f.name);
  });

  fields.forEach((f, i) => {
    if (!isPlainObject(f)) return;
    const where = `field "${f.name ?? i}"`;
    if (!hasFieldType(f.type)) {
      problems.push(`${where}: unknown type "${f.type}". Known types: ${fieldTypes().join(', ')}.`);
    }
    if ((f.type === 'select' || f.type === 'autocomplete') && f.options === undefined && !f.optionsUrl) {
      problems.push(`${where}: type "${f.type}" needs "options" or "optionsUrl".`);
    }
    if (f.options !== undefined && !Array.isArray(f.options) && typeof f.options !== 'function' && !isPlainObject(f.options)) {
      problems.push(`${where}: "options" must be an array, a function or an object keyed by the dependsOn value.`);
    }
    if (isPlainObject(f.options) && f.dependsOn.length !== 1) {
      problems.push(`${where}: an options map requires exactly one "dependsOn" field.`);
    }
    for (const dep of f.dependsOn) {
      if (!names.has(dep)) problems.push(`${where}: dependsOn references unknown field "${dep}".`);
      if (dep === f.name) problems.push(`${where}: a field cannot depend on itself.`);
    }
    for (const ref of conditionFields(f.visibleWhen)) {
      if (!names.has(ref)) problems.push(`${where}: visibleWhen references unknown field "${ref}".`);
      if (ref === f.name) problems.push(`${where}: visibleWhen cannot reference the field itself.`);
    }
    const { pattern } = f.validation;
    if (typeof pattern === 'string') {
      try {
        new RegExp(pattern);
      } catch (err) {
        problems.push(`${where}: invalid pattern ${JSON.stringify(pattern)} (${err.message}).`);
      }
    }
    if (f.validation.custom !== undefined && typeof f.validation.custom !== 'function') {
      problems.push(`${where}: validation.custom must be a function.`);
    }
  });

  if (cfg.templates.length === 0) problems.push('at least one template is required ("templates" option or <script type="text/templates"> elements).');
  const keys = new Set();
  for (const t of cfg.templates) {
    if (typeof t.source !== 'string') problems.push(`template "${t.key}": "source" must be a string.`);
    if (!MODES.includes(t.mode)) problems.push(`template "${t.key}": mode must be "text", "plain" or "html", got "${t.mode}".`);
    if (keys.has(t.key)) problems.push(`template "${t.key}" is defined twice.`);
    keys.add(t.key);
  }

  if (!PERSIST.includes(cfg.persist)) problems.push(`"persist" must be false, "url" or "local", got ${JSON.stringify(cfg.persist)}.`);

  if (cfg.presets !== null) {
    if (!isPlainObject(cfg.presets)) problems.push('"presets" must be an object: { presetName: { field: value } }.');
    else {
      for (const [preset, values] of Object.entries(cfg.presets)) {
        if (!isPlainObject(values)) {
          problems.push(`preset "${preset}" must be an object of field values.`);
          continue;
        }
        for (const key of Object.keys(values)) {
          if (!names.has(key)) problems.push(`preset "${preset}" sets unknown field "${key}".`);
        }
      }
    }
  }

  if (cfg.batch && !(cfg.batch.min >= 0 && cfg.batch.max >= cfg.batch.min)) {
    problems.push('"batch.min" and "batch.max" must satisfy 0 <= min <= max.');
  }
  return problems;
}

export function assertValidConfig(cfg) {
  const problems = validateConfig(cfg);
  if (problems.length) throw new SimpleFormError('SimpleForm: invalid configuration', problems);
}

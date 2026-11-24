import './fields/builtin.js';
import { csvToRecords, parseCSV } from './csv.js';
import { readTemplatesFromDOM } from './dom-templates.js';
import { SimpleFormError } from './errors.js';
import { highlight as builtinHighlight } from './highlight.js';
import { copyToClipboard, defaultFilename, downloadFile, OutputView, safeFilename } from './output-view.js';
import { createStore } from './persistence.js';
import { Row } from './row.js';
import { assertValidConfig, normalizeConfig } from './schema.js';
import { marker, replaceMarkers, stripMarkers, TemplateEngine, toPreviewHtml } from './template-engine.js';
import { escapeHtml, format, h, isEmpty, isPlainObject, resolveElement } from './utils.js';

const HOOKS = { change: 'onChange', render: 'onRender', invalid: 'onInvalid', copy: 'onCopy', error: 'onError' };

/**
 * SimpleForm: declare the data once, collect it with a generated form,
 * produce scripts/configurations/documents with templates.
 *
 *   const form = new SimpleForm({ element: '#app', schema, templates }).render();
 */
export class SimpleForm {
  /** Shorthand for `new SimpleForm(config).render()`. */
  static create(config) {
    return new SimpleForm(config).render();
  }

  constructor(config = {}) {
    this.options = config;
    const cfg = normalizeConfig(config);
    this.element = resolveElement(cfg.element);
    this.doc = this.element.ownerDocument;
    if (cfg.templates.length === 0) cfg.templates = readTemplatesFromDOM(this.element);
    assertValidConfig(cfg);
    if (this.element.simpleForm) {
      throw new SimpleFormError('SimpleForm: this element already hosts a form. Call destroy() on it first.');
    }
    const persistKey = cfg.persistKey ?? (this.element.id ? `sf.${this.element.id}` : null);
    if (cfg.persist && !persistKey) {
      throw new SimpleFormError('SimpleForm: "persist" requires "persistKey" or an element with an id.');
    }

    this.config = cfg;
    this.engine = new TemplateEngine({ handlebars: cfg.handlebars, helpers: cfg.helpers, engine: cfg.engine });
    this.compiled = new Map(
      cfg.templates.map((t) => [
        t.key,
        {
          render: this.engine.compile(t.source, { mode: t.mode, name: t.key }),
          filename: t.filename ? this.engine.compile(t.filename, { mode: 'text', name: `${t.key} (filename)` }) : null,
        },
      ]),
    );
    this.highlighter =
      cfg.highlight === false ? null : typeof cfg.highlight === 'function' ? cfg.highlight : builtinHighlight;
    this.store = createStore(cfg.persist, persistKey, this.doc.defaultView);
    this.rows = [];
    this.outputs = null;
    this.generated = cfg.livePreview;
    this.rendered = false;
    this.restoring = false;
    this.last = {};
  }

  /* ================================================================ DOM */

  render() {
    if (this.rendered) return this;
    const { doc, config: cfg } = this;
    const m = cfg.messages;

    this.root = h(doc, 'div', { class: 'sf-root' });
    if (cfg.title) this.root.append(h(doc, 'h2', { class: 'sf-title', text: cfg.title }));
    if (cfg.description) this.root.append(h(doc, 'p', { class: 'sf-description', text: cfg.description }));
    this.root.append(this.buildToolbar());

    this.form = h(doc, 'form', { class: 'sf-form', novalidate: true });
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.generate();
    });
    this.rowsContainer = h(doc, 'div', { class: 'sf-rows' });
    this.form.append(this.rowsContainer);

    if (cfg.batch) {
      this.addRowButton = h(doc, 'button', {
        type: 'button',
        class: 'sf-button sf-button-ghost sf-add-row',
        text: m.addRow,
        onClick: () => this.addRow(),
      });
      this.form.append(h(doc, 'div', { class: 'sf-batch-actions' }, this.addRowButton));
      if (cfg.batch.csv) this.form.append(this.buildCsvImport());
    }
    if (!cfg.livePreview) {
      this.form.append(
        h(doc, 'div', { class: 'sf-actions' }, h(doc, 'button', { type: 'submit', class: 'sf-button sf-generate', text: m.generate })),
      );
    }
    this.summary = h(doc, 'div', { class: 'sf-summary', role: 'alert', hidden: true });
    this.output = new OutputView(this);
    if (!cfg.livePreview) this.output.hide();
    this.root.append(this.form, this.summary, this.output.element);

    this.element.append(this.root);
    this.element.simpleForm = this;
    this.rendered = true;

    const state = this.store?.load();
    const saved = Array.isArray(state?.rows) ? state.rows.filter(isPlainObject) : null;
    this.restoring = true;
    if (cfg.batch) {
      const n = clamp(saved?.length || cfg.batch.initialRows, Math.max(cfg.batch.min, 1), cfg.batch.max);
      for (let i = 0; i < n; i++) this.addRow(saved?.[i] ?? {}, { silent: true });
    } else {
      this.addRow(saved?.[0] ?? {}, { silent: true, force: true });
    }
    this.restoring = false;
    // the initial state is not a "change": no hook call and no write to URL/localStorage
    this.last.values = JSON.stringify(this.getValues());
    this.update();
    return this;
  }

  buildToolbar() {
    const { doc, config: cfg } = this;
    const m = cfg.messages;
    const items = [];
    if (cfg.presets) {
      this.presetSelect = h(
        doc,
        'select',
        {
          class: 'sf-input sf-preset',
          'aria-label': m.preset,
          onChange: (event) => event.target.value && this.applyPreset(event.target.value),
        },
        h(doc, 'option', { value: '', text: m.presetNone }),
        ...Object.keys(cfg.presets).map((name) => h(doc, 'option', { value: name, text: name })),
      );
      items.push(h(doc, 'label', { class: 'sf-preset-label' }, h(doc, 'span', { text: m.preset }), this.presetSelect));
    }
    if (cfg.persist === 'url') {
      this.shareButton = h(doc, 'button', {
        type: 'button',
        class: 'sf-button sf-button-ghost sf-share',
        text: m.share,
        onClick: () => this.copyShareLink(),
      });
      items.push(this.shareButton);
    }
    items.push(
      h(doc, 'button', { type: 'button', class: 'sf-button sf-button-ghost sf-reset', text: m.reset, onClick: () => this.reset() }),
    );
    return h(doc, 'div', { class: 'sf-toolbar' }, ...items);
  }

  buildCsvImport() {
    const { doc, config: cfg } = this;
    const m = cfg.messages;
    const area = h(doc, 'textarea', { class: 'sf-input sf-csv-input', rows: 4, 'aria-label': m.importCsv });
    const append = h(doc, 'input', { type: 'checkbox', class: 'sf-csv-append' });
    const status = h(doc, 'span', { class: 'sf-csv-status', role: 'status' });
    const apply = h(doc, 'button', {
      type: 'button',
      class: 'sf-button sf-csv-apply',
      text: m.csvApply,
      onClick: () => {
        const count = this.importCSV(area.value, { append: append.checked });
        status.textContent = format(m.csvImported, { count });
      },
    });
    return h(
      doc,
      'details',
      { class: 'sf-csv' },
      h(doc, 'summary', { text: m.importCsv }),
      h(doc, 'p', { class: 'sf-help', text: m.csvHelp }),
      area,
      h(doc, 'div', { class: 'sf-csv-actions' }, h(doc, 'label', {}, append, ` ${m.csvAppend}`), apply, status),
    );
  }

  /* ============================================================== rows */

  addRow(values = {}, { silent = false, force = false } = {}) {
    const { batch } = this.config;
    if (!force && !batch) throw new SimpleFormError('SimpleForm: addRow() requires batch mode.');
    if (batch && this.rows.length >= batch.max) return null;
    const row = new Row(this, this.rows.length);
    this.rows.push(row);
    this.rowsContainer.append(row.element);
    const wasRestoring = this.restoring;
    this.restoring = true;
    row.setValues({ ...row.defaults(), ...values });
    this.refreshAllDependents(row);
    this.restoring = wasRestoring;
    this.updateRowControls();
    if (!silent) this.update();
    return row;
  }

  removeRow(index) {
    const { batch } = this.config;
    if (!batch || this.rows.length <= Math.max(batch.min, 1) || !this.rows[index]) return false;
    const [row] = this.rows.splice(index, 1);
    row.destroy();
    this.rows.forEach((r, i) => r.setIndex(i));
    this.updateRowControls();
    this.update();
    return true;
  }

  updateRowControls() {
    const { batch } = this.config;
    if (!batch) return;
    const canRemove = this.rows.length > Math.max(batch.min, 1);
    this.rows.forEach((r) => r.setRemovable(canRemove));
    if (this.addRowButton) this.addRowButton.disabled = this.rows.length >= batch.max;
  }

  refreshAllDependents(row) {
    for (const f of row.fields.values()) if (f.field.dependsOn.length) f.def.update?.(f.control, f.ctx);
  }

  /* ============================================================ values */

  /** Called by fields on every change. */
  handleChange(row, name, { silent = false } = {}) {
    if (this.restoring) return;
    if (!silent) row.refreshDependents(name);
    this.update();
  }

  /** Values of visible fields: an object, or an array of objects in batch mode. */
  getValues() {
    const values = this.rows.map((r) => r.getVisibleValues());
    return this.config.batch ? values : values[0] ?? {};
  }

  /** Sets values. In batch mode pass an array to replace rows, or an object to apply to every row. */
  setValues(values) {
    this.restoring = true;
    if (this.config.batch && Array.isArray(values)) {
      while (this.rows.length > Math.max(values.length, this.config.batch.min, 1)) this.rows.pop().destroy();
      values.forEach((v, i) => {
        if (this.rows[i]) this.rows[i].setValues(v);
        else this.addRow(v, { silent: true });
      });
    } else {
      for (const row of this.rows) row.setValues(values);
    }
    this.rows.forEach((r, i) => {
      r.setIndex(i);
      this.refreshAllDependents(r);
    });
    this.restoring = false;
    this.updateRowControls();
    this.update();
    return this;
  }

  getState() {
    return { rows: this.rows.map((r) => r.getValues()) };
  }

  collectErrors({ showAll = false } = {}) {
    const errors = {};
    this.rows.forEach((row, i) => {
      const rowErrors = row.validate({ showAll });
      for (const [name, msg] of Object.entries(rowErrors)) errors[this.config.batch ? `${i}.${name}` : name] = msg;
    });
    return errors;
  }

  /** Validates everything and shows all errors. */
  validate() {
    this.rows.forEach((r) => r.touchAll());
    const errors = this.collectErrors({ showAll: true });
    this.renderSummary();
    return { valid: Object.keys(errors).length === 0, errors };
  }

  /** Main refresh cycle: visibility → validation → persistence/hooks → outputs. */
  update() {
    if (!this.rendered) return;
    this.rows.forEach((r) => r.updateVisibility());
    const errors = this.collectErrors();
    const valid = Object.keys(errors).length === 0;
    const values = this.getValues();

    if (this.changed('values', values)) {
      this.store?.save(this.getState());
      this.emit('change', { values, errors, valid });
    }
    this.renderSummary();
    if (this.generated) this.renderOutputs(errors);
  }

  changed(slot, value) {
    const json = JSON.stringify(value);
    if (this.last[slot] === json) return false;
    this.last[slot] = json;
    return true;
  }

  renderSummary() {
    const shown = this.root.querySelectorAll('.sf-field.sf-invalid').length;
    this.summary.hidden = shown === 0;
    this.summary.textContent = shown ? format(this.config.messages.summary, { count: shown }) : '';
  }

  /* =========================================================== outputs */

  /** Template contexts, one per row. In preview mode empty required fields become markers. */
  buildContexts(preview) {
    const labels = [];
    const contexts = this.rows.map((row, rowIndex) => {
      const values = row.getVisibleValues();
      if (!preview) return values;
      for (const f of row.fields.values()) {
        const v = values[f.field.name];
        const missing = isEmpty(v) || (f.field.type === 'checkbox' && v === false);
        if (f.visible && f.field.validation.required && missing) {
          values[f.field.name] = marker(labels.length);
          labels.push({ name: f.field.name, label: this.config.batch ? `${f.field.label} #${rowIndex + 1}` : f.field.label });
        }
      }
      return values;
    });
    return { contexts, labels };
  }

  renderTemplate(template, contexts) {
    const { render } = this.compiled.get(template.key);
    const count = contexts.length;
    const ctxFor = (values, i) => ({ ...values, rows: contexts, count, index: i + 1, isFirst: i === 0, isLast: i === count - 1 });
    if (template.perRow) return contexts.map((values, i) => render(ctxFor(values, i))).join(template.separator);
    return render(ctxFor(contexts[0] ?? {}, 0));
  }

  renderOutputs(errors = this.collectErrors()) {
    const valid = Object.keys(errors).length === 0;
    const { contexts, labels } = this.buildContexts(!valid);
    const results = new Map();
    const outputs = {};
    for (const template of this.config.templates) {
      try {
        const text = this.renderTemplate(template, contexts);
        const previewHtml =
          template.mode === 'html'
            ? replaceMarkers(text, (i) => `<mark class="sf-missing">${escapeHtml(labels[i]?.label ?? '?')}</mark>`)
            : toPreviewHtml(text, {
                language: template.language,
                highlight: template.mode === 'plain' ? null : this.safeHighlighter(),
                labels,
              });
        results.set(template.key, { previewHtml });
        if (valid) outputs[template.key] = text;
      } catch (error) {
        results.set(template.key, { error });
        this.reportError(error, { template: template.key });
      }
    }
    this.outputs = valid ? outputs : null;
    this.output.update(results, { valid });
    if (valid) {
      if (this.changed('outputs', outputs)) this.emit('render', { outputs, values: this.getValues() });
    } else {
      this.last.outputs = undefined;
      if (this.changed('errors', errors)) this.emit('invalid', { errors });
    }
  }

  safeHighlighter() {
    const hl = this.highlighter;
    if (!hl) return null;
    return (code, language) => {
      const out = hl(code, language);
      return typeof out === 'string' ? out : escapeHtml(code);
    };
  }

  /** Validates (showing errors) and renders outputs. Used by the Generate button. */
  generate() {
    const { valid, errors } = this.validate();
    if (!valid) {
      this.rows.some((r) => r.focusFirstError(r.validate({ showAll: true })));
      if (this.changed('errors', errors)) this.emit('invalid', { errors });
      if (!this.generated) return false;
    }
    this.generated = true;
    this.renderOutputs(errors);
    return valid;
  }

  /** Final outputs `{ key: text }`, or null while the form is invalid. */
  getOutputs() {
    const errors = this.collectErrors();
    if (Object.keys(errors).length) return null;
    const { contexts } = this.buildContexts(false);
    return Object.fromEntries(this.config.templates.map((t) => [t.key, this.renderTemplate(t, contexts)]));
  }

  async copy(key) {
    const outputs = this.getOutputs();
    if (!outputs) {
      this.generate();
      return false;
    }
    const template = this.config.templates.find((t) => t.key === key);
    const text = outputs[key];
    const html = template.mode === 'html' ? text : null;
    const plain = html ? htmlToText(this.doc, html) : text;
    const ok = await copyToClipboard(this.doc, plain, html);
    this.output.flash(key, 'copy', ok ? this.config.messages.copied : this.config.messages.copyFailed);
    if (ok) this.emit('copy', { template: key, text: plain });
    return ok;
  }

  download(key) {
    const outputs = this.getOutputs();
    if (!outputs) {
      this.generate();
      return null;
    }
    const template = this.config.templates.find((t) => t.key === key);
    const { filename } = this.compiled.get(key);
    const { contexts } = this.buildContexts(false);
    const name = safeFilename(
      filename ? stripMarkers(filename({ ...contexts[0], rows: contexts, count: contexts.length })) : defaultFilename(template),
    );
    downloadFile(this.doc, name, outputs[key], template.mode === 'html' ? 'text/html' : 'text/plain');
    return name;
  }

  /* ===================================================== presets & io */

  applyPreset(name) {
    const preset = this.config.presets?.[name];
    if (!preset) throw new SimpleFormError(`SimpleForm: unknown preset "${name}".`);
    this.setValues(preset);
    if (this.presetSelect) this.presetSelect.value = name;
    return this;
  }

  /** Imports CSV rows (batch mode). Returns the number of imported rows. */
  importCSV(text, { append = false } = {}) {
    const { batch, schema } = this.config;
    if (!batch) throw new SimpleFormError('SimpleForm: importCSV() requires batch mode.');
    const records = csvToRecords(parseCSV(text), schema);
    if (!records.length) return 0;
    const existing = append ? this.getState().rows : [];
    const rows = existing.concat(records).slice(0, batch.max);
    this.setValues(rows);
    return Math.min(records.length, Math.max(batch.max - existing.length, 0));
  }

  /** Shareable URL containing the current values (persist: "url" only). */
  getShareUrl() {
    return this.store?.shareUrl(this.getState()) ?? null;
  }

  async copyShareLink() {
    const url = this.getShareUrl();
    if (!url) return false;
    const ok = await copyToClipboard(this.doc, url);
    if (ok && this.shareButton) this.output.flash(null, this.shareButton, this.config.messages.shareCopied);
    return ok;
  }

  reset() {
    const { batch } = this.config;
    this.restoring = true;
    if (batch) {
      this.rows.forEach((r) => r.destroy());
      this.rows = [];
      const n = clamp(batch.initialRows, Math.max(batch.min, 1), batch.max);
      for (let i = 0; i < n; i++) this.addRow({}, { silent: true });
    } else {
      this.rows[0].reset();
      this.refreshAllDependents(this.rows[0]);
    }
    this.restoring = false;
    if (this.presetSelect) this.presetSelect.value = '';
    this.generated = this.config.livePreview;
    if (!this.generated) this.output.hide();
    this.last = {};
    this.update();
    this.store?.clear(); // a reset form starts clean: no saved state left behind
    return this;
  }

  /**
   * JSON-serializable configuration (schema, templates, presets…).
   * Functions cannot be serialized: they are dropped and listed in `warnings`.
   */
  exportSchema() {
    const warnings = [];
    const schema = this.config.schema.map((f) => {
      const raw = this.options.schema.find((r) => (r.name ?? r.fieldName) === f.name) ?? {};
      const out = JSON.parse(JSON.stringify({ ...raw, name: f.name, type: f.type, fieldName: undefined, values: undefined, options: raw.options ?? raw.values }));
      for (const key of ['options', 'visibleWhen']) {
        if (typeof (raw[key] ?? (key === 'options' ? raw.values : undefined)) === 'function') warnings.push(`field "${f.name}": "${key}" is a function and was not exported.`);
      }
      if (typeof raw.validation?.custom === 'function') warnings.push(`field "${f.name}": "validation.custom" is a function and was not exported.`);
      return out;
    });
    const templates = Object.fromEntries(
      this.config.templates.map(({ key, ...t }) => [key, JSON.parse(JSON.stringify({ ...t, perRow: t.perRow || undefined, separator: t.separator === '\n' ? undefined : t.separator }))]),
    );
    const { batch } = this.config;
    const config = {
      ...(this.config.title ? { title: this.config.title } : {}),
      ...(this.config.description ? { description: this.config.description } : {}),
      schema,
      templates,
      livePreview: this.config.livePreview,
      ...(this.config.persist ? { persist: this.config.persist, persistKey: this.options.persistKey } : {}),
      ...(this.config.presets ? { presets: this.config.presets } : {}),
      ...(batch ? { batch: { min: batch.min, ...(Number.isFinite(batch.max) ? { max: batch.max } : {}), csv: batch.csv, initialRows: batch.initialRows } } : {}),
    };
    return { config: JSON.parse(JSON.stringify(config)), warnings };
  }

  /* ============================================================ events */

  /** Subscribes to change | render | invalid | copy | error. Returns an unsubscribe function. */
  on(event, callback) {
    const listener = (e) => callback(e.detail);
    this.element.addEventListener(`simpleform:${event}`, listener);
    return () => this.element.removeEventListener(`simpleform:${event}`, listener);
  }

  emit(event, detail) {
    const payload = { ...detail, form: this };
    const hook = this.config.hooks[HOOKS[event]];
    if (typeof hook === 'function') {
      try {
        hook(payload);
      } catch (err) {
        if (event !== 'error') this.reportError(err, { hook: HOOKS[event] });
        else console.error('[SimpleForm] onError hook failed', err);
      }
    }
    const CustomEventCtor = this.doc.defaultView?.CustomEvent ?? globalThis.CustomEvent;
    this.element.dispatchEvent(new CustomEventCtor(`simpleform:${event}`, { detail: payload, bubbles: true }));
  }

  reportError(error, context = {}) {
    if (!this.config.hooks.onError) console.error('[SimpleForm]', error);
    this.emit('error', { error, ...context });
  }

  destroy() {
    this.root?.remove();
    this.rows = [];
    this.rendered = false;
    delete this.element.simpleForm;
  }
}

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

/** Inert parsing: nothing in the HTML can load or execute. */
function htmlToText(doc, html) {
  const Parser = doc.defaultView?.DOMParser ?? globalThis.DOMParser;
  return new Parser().parseFromString(html, 'text/html').body.textContent;
}

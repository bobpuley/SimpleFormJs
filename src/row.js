import { isVisible } from './conditions.js';
import { getFieldType } from './fields/registry.js';
import { createOptionsLoader } from './options.js';
import { format, h, nextId } from './utils.js';
import { validateValue } from './validation.js';

/**
 * One set of fields. Single forms have one Row; batch forms have N rows.
 * Element ids are generated (never derived from the field name), so names cannot
 * clash with CSS classes and every <label for> points to a real control.
 */
export class Row {
  constructor(form, index) {
    this.form = form;
    this.index = index;
    this.fields = new Map();
    this.touched = new Set();
    const { doc, config } = form;

    this.element = h(doc, config.batch ? 'fieldset' : 'div', { class: 'sf-row' });
    if (config.batch) {
      this.legend = h(doc, 'legend', { class: 'sf-row-title' });
      this.removeButton = h(doc, 'button', {
        type: 'button',
        class: 'sf-button sf-button-ghost sf-row-remove',
        text: config.messages.removeRow,
        onClick: () => form.removeRow(this.index),
      });
      this.element.append(h(doc, 'div', { class: 'sf-row-header' }, this.legend, this.removeButton));
    }

    for (const field of config.schema) this.fields.set(field.name, this.createField(field));
    this.setIndex(index);
  }

  createField(field) {
    const { doc, config } = this.form;
    const def = getFieldType(field.type);
    const id = nextId(`sf-${field.name}`);
    const errorId = `${id}-error`;
    const helpId = field.help ? `${id}-help` : undefined;
    const options = createOptionsLoader(field, { fetchImpl: config.fetch });

    const ctx = {
      field,
      id,
      doc,
      messages: config.messages,
      options,
      element: null,
      emit: ({ touched } = {}) => {
        if (touched) this.touched.add(field.name);
        this.form.handleChange(this, field.name);
      },
      values: () => this.getValues(),
      format: (message, data) => format(message, { label: field.label, ...data }),
      loadOptions: (query, signal) => (options ? options({ values: this.getValues(), query, signal }) : []),
      reportError: (err) => this.form.reportError(err, { field: field.name }),
    };

    const control = def.render(ctx);
    ctx.element = control;
    const isCheckbox = field.type === 'checkbox';
    const label = h(
      doc,
      'label',
      { class: 'sf-label', for: id },
      field.label,
      field.validation.required ? h(doc, 'span', { class: 'sf-required', 'aria-hidden': 'true', text: ' *' }) : null,
    );
    const help = field.help ? h(doc, 'div', { class: 'sf-help', id: helpId, text: field.help }) : null;
    const error = h(doc, 'div', { class: 'sf-error', id: errorId, 'aria-live': 'polite' });
    const describedBy = [helpId, errorId].filter(Boolean).join(' ');
    const focusable = control.matches?.('input,select,textarea') ? control : control.querySelector?.(`[id="${id}"]`);
    focusable?.setAttribute('aria-describedby', describedBy);

    const wrapper = h(
      doc,
      'div',
      { class: `sf-field sf-field-${field.type}`, dataset: { field: field.name } },
      isCheckbox ? h(doc, 'div', { class: 'sf-checkbox-line' }, control, label) : [label, control],
      help,
      error,
    );
    wrapper.addEventListener('focusout', () => {
      this.touched.add(field.name);
      this.form.handleChange(this, field.name, { silent: true });
    });
    this.element.append(wrapper);
    return { field, def, ctx, control, wrapper, error, focusable, visible: true };
  }

  setIndex(index) {
    this.index = index;
    if (this.legend) this.legend.textContent = format(this.form.config.messages.row, { n: index + 1 });
  }

  setRemovable(enabled) {
    if (this.removeButton) this.removeButton.disabled = !enabled;
  }

  /** Raw values of every field (hidden ones included). */
  getValues() {
    const values = {};
    for (const [name, f] of this.fields) values[name] = f.def.getValue(f.control, f.ctx);
    return values;
  }

  /** Values passed to templates and hooks: hidden fields are omitted. */
  getVisibleValues() {
    const all = this.getValues();
    const out = {};
    for (const [name, f] of this.fields) if (f.visible) out[name] = all[name];
    return out;
  }

  setValues(values = {}) {
    for (const [name, value] of Object.entries(values)) {
      const f = this.fields.get(name);
      if (f) f.def.setValue(f.control, value, f.ctx);
    }
  }

  defaults() {
    const out = {};
    for (const [name, f] of this.fields) {
      out[name] = f.field.defaultValue !== undefined ? f.field.defaultValue : f.def.emptyValue ?? '';
    }
    return out;
  }

  reset() {
    this.touched.clear();
    this.setValues(this.defaults());
  }

  updateVisibility() {
    // visibility can cascade (A shows B, B shows C): iterate until stable
    for (let pass = 0; pass < this.fields.size; pass++) {
      const values = this.getVisibleValuesSnapshot();
      let changed = false;
      for (const f of this.fields.values()) {
        const visible = isVisible(f.field, values);
        if (visible !== f.visible) {
          f.visible = visible;
          f.wrapper.hidden = !visible;
          changed = true;
        }
      }
      if (!changed) break;
    }
  }

  getVisibleValuesSnapshot() {
    const all = this.getValues();
    for (const [name, f] of this.fields) if (!f.visible) all[name] = undefined;
    return all;
  }

  /** Re-runs `update` for fields depending on `name` (cascading). */
  refreshDependents(name, seen = new Set()) {
    for (const f of this.fields.values()) {
      if (!f.field.dependsOn.includes(name) || seen.has(f.field.name)) continue;
      seen.add(f.field.name);
      f.def.update?.(f.control, f.ctx);
      this.refreshDependents(f.field.name, seen);
    }
  }

  /** Returns { name: message } for visible fields; optionally paints the errors. */
  validate({ showAll = false } = {}) {
    const errors = {};
    const values = this.getVisibleValues();
    for (const [name, f] of this.fields) {
      let message = null;
      if (f.visible) {
        // type-specific checks first (e.g. "choose a value from the list"), then declarative rules
        message =
          (f.def.validate && f.def.validate(values[name], f.ctx)) ||
          validateValue(f.field, values[name], values, this.form.config.messages);
      }
      if (message) errors[name] = message;
      const show = Boolean(message) && (showAll || this.touched.has(name));
      f.error.textContent = show ? message : '';
      f.wrapper.classList.toggle('sf-invalid', show);
      f.focusable?.setAttribute('aria-invalid', show ? 'true' : 'false');
    }
    return errors;
  }

  touchAll() {
    for (const name of this.fields.keys()) this.touched.add(name);
  }

  focusFirstError(errors) {
    const first = [...this.fields.values()].find((f) => errors[f.field.name]);
    first?.focusable?.focus();
    return Boolean(first);
  }

  destroy() {
    this.element.remove();
  }
}

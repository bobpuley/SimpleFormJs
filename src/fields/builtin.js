import { h, sameValue } from '../utils.js';
import { registerField } from './registry.js';
import { autocomplete } from './autocomplete.js';
import { isThenable } from '../options.js';

/** Attributes shared by every native control. */
const baseAttrs = (ctx) => ({
  id: ctx.id,
  name: ctx.field.name,
  placeholder: ctx.field.placeholder,
  'aria-required': ctx.field.validation.required ? 'true' : undefined,
  ...ctx.field.attrs,
});

const inputType = (type, extra = () => ({})) => ({
  render(ctx) {
    return h(ctx.doc, 'input', {
      type,
      class: 'sf-input',
      autocomplete: 'off',
      ...baseAttrs(ctx),
      ...extra(ctx),
      onInput: () => ctx.emit(),
      onChange: () => ctx.emit(),
    });
  },
  getValue: (el) => el.value,
  setValue: (el, value) => {
    el.value = value ?? '';
  },
});

registerField('text', inputType('text'));
registerField('email', inputType('email'));
registerField('url', inputType('url'));
registerField('date', inputType('date', ({ field }) => ({ min: field.validation.min, max: field.validation.max })));

registerField('number', {
  ...inputType('number', ({ field }) => ({
    min: field.validation.min,
    max: field.validation.max,
    step: field.step ?? 'any',
    inputmode: 'decimal',
  })),
  getValue: (el) => (el.value === '' ? (el.validity?.badInput ? NaN : '') : Number(el.value)),
});

registerField('textarea', {
  render(ctx) {
    return h(ctx.doc, 'textarea', {
      class: 'sf-input sf-textarea',
      rows: ctx.field.rows ?? 3,
      ...baseAttrs(ctx),
      onInput: () => ctx.emit(),
    });
  },
  getValue: (el) => el.value,
  setValue: (el, value) => {
    el.value = value ?? '';
  },
});

const TRUE_STRINGS = ['true', '1', 'yes', 'y', 'x', 'on', 'si', 'sì'];
export const toBoolean = (v) =>
  v === true || (typeof v === 'number' && v !== 0) || TRUE_STRINGS.includes(String(v ?? '').trim().toLowerCase());

registerField('checkbox', {
  emptyValue: false,
  render(ctx) {
    const { placeholder, ...attrs } = baseAttrs(ctx);
    return h(ctx.doc, 'input', { type: 'checkbox', class: 'sf-checkbox', ...attrs, onChange: () => ctx.emit() });
  },
  getValue: (el) => el.checked,
  setValue: (el, value) => {
    el.checked = toBoolean(value);
  },
});

/* ------------------------------------------------------------------ select */

const selectState = new WeakMap();

function fillSelect(el, ctx, list) {
  const state = selectState.get(el);
  const previous = state.pending !== undefined ? state.pending : readSelect(el);
  state.list = list;
  el.replaceChildren(
    h(ctx.doc, 'option', { value: '', text: ctx.field.placeholder || ctx.messages.selectPlaceholder }),
    // the DOM value is the real option value (autofill, native serialization, automation all work)
    ...list.map((opt) => h(ctx.doc, 'option', { value: String(opt.value ?? ''), text: opt.text })),
  );
  const match = list.find((opt) => sameValue(opt.value, previous));
  el.value = match ? String(match.value) : '';
  state.pending = undefined;
}

function readSelect(el) {
  const state = selectState.get(el);
  if (state.pending !== undefined) return state.pending;
  if (el.value === '') return '';
  // return the original (possibly non-string) value
  return state.list.find((opt) => String(opt.value) === el.value)?.value ?? el.value;
}

function loadSelect(el, ctx) {
  const state = selectState.get(el);
  const seq = ++state.seq;
  let result;
  try {
    result = ctx.loadOptions('');
  } catch (err) {
    result = Promise.reject(err);
  }
  if (!isThenable(result)) {
    fillSelect(el, ctx, result); // synchronous loaders (maps, sync functions): no loading state
    return undefined;
  }
  state.loading = true;
  if (state.pending === undefined) state.pending = readSelect(el);
  el.disabled = true;
  el.setAttribute('aria-busy', 'true');
  return result
    .then((list) => {
      if (seq === state.seq) fillSelect(el, ctx, list);
    })
    .catch((err) => {
      if (seq === state.seq) {
        fillSelect(el, ctx, []);
        ctx.reportError?.(err);
      }
    })
    .finally(() => {
      if (seq !== state.seq) return;
      state.loading = false;
      el.disabled = false;
      el.removeAttribute('aria-busy');
      ctx.emit();
    });
}

registerField('select', {
  render(ctx) {
    const { placeholder, ...attrs } = baseAttrs(ctx);
    const el = h(ctx.doc, 'select', { class: 'sf-input sf-select', ...attrs, onChange: () => ctx.emit() });
    selectState.set(el, { list: [], seq: 0, pending: undefined, loading: false });
    if (ctx.options?.isStatic) fillSelect(el, ctx, ctx.options.list);
    else loadSelect(el, ctx);
    return el;
  },
  update(el, ctx) {
    if (!ctx.options?.isStatic) return loadSelect(el, ctx);
    return undefined;
  },
  getValue: readSelect,
  setValue(el, value) {
    const state = selectState.get(el);
    if (state.loading) {
      state.pending = value; // options still loading: applied when they arrive
      return;
    }
    const match =
      state.list.find((opt) => sameValue(opt.value, value ?? '')) ||
      state.list.find((opt) => opt.text.toLowerCase() === String(value ?? '').toLowerCase());
    el.value = match ? String(match.value) : '';
  },
});

registerField('autocomplete', autocomplete);

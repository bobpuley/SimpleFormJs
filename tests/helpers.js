import { SimpleForm } from '../src/index.js';

export function mount(config = {}, { id = 'app' } = {}) {
  const el = document.createElement('div');
  el.id = id;
  document.body.append(el);
  return SimpleForm.create({ element: el, ...config });
}

export const field = (form, name, row = 0) =>
  form.element.querySelectorAll(`.sf-row`)[row].querySelector(`[data-field="${name}"]`);

export const control = (form, name, row = 0) => field(form, name, row).querySelector('input,select,textarea');

export function type(el, value) {
  el.focus();
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export function choose(selectEl, text) {
  const opt = [...selectEl.options].find((o) => o.textContent === text);
  selectEl.value = opt.value;
  selectEl.dispatchEvent(new Event('change', { bubbles: true }));
}

export function check(el, checked = true) {
  el.checked = checked;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function key(el, k) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}

export const blur = (el) => {
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('blur'));
  el.blur();
};

export const outputText = (form, key) =>
  form.element.querySelector(`.sf-output[data-template="${key}"] code, .sf-output[data-template="${key}"] .sf-html`).textContent;

export const flush = () => new Promise((r) => setTimeout(r, 0));
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

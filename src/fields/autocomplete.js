import { debounce, h, nextId, sameValue } from '../utils.js';
import { filterOptions } from '../options.js';

/**
 * Accessible combobox (WAI-ARIA 1.2 "list autocomplete").
 *
 * - filters on the `input` event, so digits, accents, backspace and paste all work
 * - the template receives the option `value`; the input shows the option `text`
 * - typed text that matches no option is rejected unless `allowCustom: true`
 * - `options` may be static or async: `({ query, values, signal }) => Promise<list>`
 */
const states = new WeakMap();
const MAX_VISIBLE = 50;

export const autocomplete = {
  render(ctx) {
    const { doc, field } = ctx;
    const listId = nextId('sf-listbox');
    const input = h(doc, 'input', {
      type: 'text',
      id: ctx.id,
      name: field.name,
      class: 'sf-input sf-combobox-input',
      placeholder: field.placeholder,
      role: 'combobox',
      autocomplete: 'off',
      'aria-autocomplete': 'list',
      'aria-expanded': 'false',
      'aria-controls': listId,
      'aria-required': field.validation.required ? 'true' : undefined,
      ...field.attrs,
    });
    const list = h(doc, 'ul', { id: listId, role: 'listbox', class: 'sf-listbox', hidden: true });
    const status = h(doc, 'div', { class: 'sf-combobox-status', 'aria-live': 'polite' });
    const root = h(doc, 'div', { class: 'sf-combobox' }, input, list, status);

    const state = {
      ctx,
      input,
      list,
      status,
      options: ctx.options?.isStatic ? ctx.options.list : [],
      filtered: [],
      active: -1,
      selected: null,
      seq: 0,
      controller: null,
    };
    states.set(root, state);

    const remoteSearch = debounce((query) => search(state, query), field.debounce ?? 200);

    input.addEventListener('input', () => {
      state.selected = matchExact(state.options, input.value);
      if (ctx.options?.isStatic) search(state, input.value);
      else remoteSearch(input.value);
      ctx.emit();
    });
    input.addEventListener('keydown', (event) => onKeyDown(state, event));
    input.addEventListener('focus', () => {
      if (ctx.options?.isStatic && !input.value) search(state, '');
    });
    input.addEventListener('blur', () => {
      // let a click on an option land before closing
      setTimeout(() => close(state), 120);
      if (!state.selected) state.selected = matchExact(state.options, input.value);
      ctx.emit({ touched: true });
    });
    list.addEventListener('mousedown', (event) => event.preventDefault());
    list.addEventListener('click', (event) => {
      const li = event.target.closest('[role="option"]');
      if (li) choose(state, state.filtered[Number(li.dataset.index)]);
    });
    return root;
  },

  getValue(root, ctx) {
    const state = states.get(root);
    if (state.selected) return state.selected.value;
    return ctx.field.allowCustom ? state.input.value : '';
  },

  setValue(root, value, ctx) {
    const state = states.get(root);
    if (value === undefined || value === null || value === '') {
      state.selected = null;
      state.input.value = '';
      return;
    }
    const match =
      state.options.find((opt) => sameValue(opt.value, value)) ||
      matchExact(state.options, String(value));
    if (match) {
      state.selected = match;
      state.input.value = match.text;
    } else if (ctx.field.allowCustom || !ctx.options?.isStatic) {
      // free text, or async options not loaded yet: trust the stored value
      state.selected = ctx.field.allowCustom ? null : { text: String(value), value };
      state.input.value = String(value);
    } else {
      state.selected = null;
      state.input.value = String(value);
    }
  },

  validate(value, ctx) {
    const state = states.get(ctx.element);
    if (!ctx.field.allowCustom && state.input.value && !state.selected) {
      return ctx.format(ctx.messages.notInList);
    }
    return null;
  },

  update(root, ctx) {
    // a dependsOn field changed: forget cached remote options and the current choice
    const state = states.get(root);
    if (ctx.options?.isStatic) return;
    state.options = [];
    if (state.selected) {
      state.selected = null;
      state.input.value = '';
    }
  },
};

const matchExact = (options, text) => {
  const t = String(text ?? '').trim().toLowerCase();
  return t ? options.find((opt) => opt.text.toLowerCase() === t) || null : null;
};

async function search(state, query) {
  const { ctx } = state;
  const seq = ++state.seq;
  if (ctx.options?.isStatic) {
    state.filtered = filterOptions(state.options, query).slice(0, MAX_VISIBLE);
    renderList(state);
    return;
  }
  state.controller?.abort();
  state.controller = typeof AbortController === 'function' ? new AbortController() : null;
  state.status.textContent = ctx.messages.loading;
  state.input.setAttribute('aria-busy', 'true');
  try {
    const result = await ctx.loadOptions(query, state.controller?.signal); // sync or async
    if (seq !== state.seq) return;
    state.options = result;
    state.filtered = filterOptions(result, query).slice(0, MAX_VISIBLE);
    if (!state.selected) state.selected = matchExact(result, state.input.value);
    renderList(state);
    ctx.emit();
  } catch (err) {
    if (seq !== state.seq || err?.name === 'AbortError') return;
    state.filtered = [];
    renderList(state);
    ctx.reportError?.(err);
  } finally {
    if (seq === state.seq) state.input.removeAttribute('aria-busy');
  }
}

function renderList(state) {
  const { ctx, list, input } = state;
  state.active = -1;
  input.removeAttribute('aria-activedescendant');
  list.replaceChildren(
    ...state.filtered.map((opt, i) =>
      h(ctx.doc, 'li', {
        id: `${list.id}-${i}`,
        role: 'option',
        class: 'sf-option',
        'aria-selected': 'false',
        dataset: { index: String(i) },
        text: opt.text,
      }),
    ),
  );
  const focused = ctx.doc.activeElement === input;
  const hasItems = state.filtered.length > 0;
  state.status.textContent = hasItems || !input.value ? '' : ctx.messages.noResults;
  if (hasItems && focused) open(state);
  else close(state);
}

function open(state) {
  state.list.hidden = false;
  state.input.setAttribute('aria-expanded', 'true');
}

function close(state) {
  state.list.hidden = true;
  state.input.setAttribute('aria-expanded', 'false');
  state.input.removeAttribute('aria-activedescendant');
  state.active = -1;
}

function setActive(state, index) {
  const items = state.list.children;
  if (!items.length) return;
  state.active = (index + items.length) % items.length;
  [...items].forEach((li, i) => li.setAttribute('aria-selected', String(i === state.active)));
  const li = items[state.active];
  state.input.setAttribute('aria-activedescendant', li.id);
  li.scrollIntoView?.({ block: 'nearest' });
}

function choose(state, option) {
  if (!option) return;
  state.selected = option;
  state.input.value = option.text;
  close(state);
  state.ctx.emit();
}

function onKeyDown(state, event) {
  const isOpen = !state.list.hidden;
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (!isOpen) {
        if (state.filtered.length) open(state);
        else search(state, state.input.value);
      }
      setActive(state, state.active + 1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      if (isOpen) setActive(state, state.active - 1);
      break;
    case 'Enter':
      if (isOpen && state.active >= 0) {
        event.preventDefault();
        choose(state, state.filtered[state.active]);
      }
      break;
    case 'Escape':
      if (isOpen) {
        event.preventDefault();
        close(state);
      }
      break;
    case 'Tab':
      if (isOpen && state.active >= 0) choose(state, state.filtered[state.active]);
      close(state);
      break;
    default:
  }
}

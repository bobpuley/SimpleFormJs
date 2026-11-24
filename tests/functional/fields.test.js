import { describe, expect, it, vi } from 'vitest';
import { SimpleForm, registerField } from '../../src/index.js';
import { blur, choose, control, field, key, mount, outputText, type, wait, flush } from '../helpers.js';

const countries = [
  { text: 'Andorra', value: 'AD' },
  { text: 'France', value: 'FR' },
  { text: 'Côte d’Ivoire', value: 'CI' },
  { text: 'Zone 51', value: 'Z51' },
];
const listbox = (form, name) => field(form, name).querySelector('[role="listbox"]');

describe('autocomplete', () => {
  const make = (extra = {}) =>
    mount({ schema: [{ name: 'country', type: 'autocomplete', options: countries, ...extra }], templates: { t: '[{{country}}]' } });

  it('filters on input (digits, accents, backspace) and exposes ARIA state', () => {
    const form = make();
    const input = control(form, 'country');
    type(input, 'zone 5');
    expect([...listbox(form, 'country').children].map((li) => li.textContent)).toEqual(['Zone 51']);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    type(input, 'côte');
    expect(listbox(form, 'country').children[0].textContent).toBe('Côte d’Ivoire');
    type(input, 'c'); // backspace-like shortening widens results
    expect(listbox(form, 'country').children.length).toBe(1 + 0 + 1); // prefix "Côte", substring "France"
  });

  it('keyboard: arrows move the active option, Enter chooses, Escape closes', () => {
    const form = make();
    const input = control(form, 'country');
    type(input, 'a');
    key(input, 'ArrowDown');
    const first = listbox(form, 'country').children[0];
    expect(input.getAttribute('aria-activedescendant')).toBe(first.id);
    expect(first.getAttribute('aria-selected')).toBe('true');
    key(input, 'Enter');
    expect(input.value).toBe('Andorra');
    expect(outputText(form, 't')).toBe('[AD]');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    type(input, 'f');
    key(input, 'Escape');
    expect(listbox(form, 'country').hidden).toBe(true);
  });

  it('clicking an option chooses it; exact typing (case-insensitive) also matches', () => {
    const form = make();
    const input = control(form, 'country');
    type(input, 'fr');
    listbox(form, 'country').children[0].click();
    expect(outputText(form, 't')).toBe('[FR]');
    type(input, 'ANDORRA');
    expect(outputText(form, 't')).toBe('[AD]');
  });

  it('rejects unknown text unless allowCustom', () => {
    const form = make();
    const input = control(form, 'country');
    type(input, 'Atlantis');
    blur(input);
    expect(field(form, 'country').querySelector('.sf-error').textContent).toBe('country: choose a value from the list');
    expect(form.getValues().country).toBe('');

    const free = mount({ schema: [{ name: 'c', type: 'autocomplete', options: countries, allowCustom: true }], templates: { t: '{{c}}' } }, { id: 'free' });
    type(control(free, 'c'), 'Atlantis');
    expect(outputText(free, 't')).toBe('Atlantis');
  });

  it('setValue accepts the option value (persisted state, presets, CSV)', () => {
    const form = make({ defaultValue: 'CI' });
    expect(control(form, 'country').value).toBe('Côte d’Ivoire');
    expect(outputText(form, 't')).toBe('[CI]');
  });

  it('loads async suggestions with debounce, ignoring stale responses', async () => {
    const calls = [];
    const options = vi.fn(async ({ query }) => {
      calls.push(query);
      await wait(query === 'ro' ? 30 : 0);
      return [`${query}-1`, `${query}-2`];
    });
    const form = mount({ schema: [{ name: 'city', type: 'autocomplete', options, debounce: 10 }], templates: { t: '{{city}}' } });
    const input = control(form, 'city');
    type(input, 'r');
    type(input, 'ro');
    await wait(20);
    expect(calls).toEqual(['ro']); // debounced: only the last query is sent
    await wait(40);
    expect([...listbox(form, 'city').children].map((li) => li.textContent)).toEqual(['ro-1', 'ro-2']);
    key(input, 'ArrowDown');
    key(input, 'Enter');
    expect(outputText(form, 't')).toBe('ro-1');
  });

  it('reports async loading errors', async () => {
    const onError = vi.fn();
    const form = mount({
      schema: [{ name: 'c', type: 'autocomplete', options: async () => Promise.reject(new Error('offline')), debounce: 0 }],
      templates: { t: '{{c}}' },
      onError,
    });
    type(control(form, 'c'), 'x');
    await wait(10);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ field: 'c', error: expect.any(Error) }));
  });
});

describe('conditional fields', () => {
  const schema = [
    { name: 'country', options: ['FR', 'IT'] },
    { name: 'vat', label: 'VAT', required: true, visibleWhen: { field: 'country', equals: 'IT' } },
    { name: 'sdi', visibleWhen: { field: 'vat' } },
  ];

  it('hides fields, skips their validation and omits their values', () => {
    const form = mount({ schema, templates: { t: '{{country}}|{{vat}}|{{sdi}}' } });
    expect(field(form, 'vat').hidden).toBe(true);
    expect(form.validate().valid).toBe(true);
    expect(form.getValues()).toEqual({ country: '' });

    choose(control(form, 'country'), 'IT');
    expect(field(form, 'vat').hidden).toBe(false);
    expect(form.validate().valid).toBe(false);
    type(control(form, 'vat'), 'IT123');
    expect(field(form, 'sdi').hidden).toBe(false); // cascading visibility
    expect(outputText(form, 't')).toBe('IT|IT123|');

    choose(control(form, 'country'), 'FR');
    expect(field(form, 'vat').hidden).toBe(true);
    expect(field(form, 'sdi').hidden).toBe(true);
    expect(outputText(form, 't')).toBe('FR||');
  });
});

describe('dependent fields', () => {
  it('reloads options from a map keyed by the parent value', () => {
    const form = mount({
      schema: [
        { name: 'country', options: ['IT', 'FR'] },
        { name: 'city', dependsOn: 'country', options: { IT: ['Roma', 'Milano'], FR: ['Paris'] } },
      ],
      templates: { t: '{{country}}/{{city}}' },
    });
    const city = control(form, 'city');
    expect(city.options.length).toBe(1); // placeholder only
    choose(control(form, 'country'), 'IT');
    expect([...city.options].map((o) => o.textContent)).toEqual(['— select —', 'Roma', 'Milano']);
    choose(city, 'Milano');
    expect(outputText(form, 't')).toBe('IT/Milano');
    choose(control(form, 'country'), 'FR');
    expect(form.getValues().city).toBe(''); // previous choice no longer valid
  });

  it('supports async option functions and restores values once loaded', async () => {
    const regions = { IT: ['Lazio', 'Lombardia'], FR: ['Bretagne'] };
    const form = mount({
      schema: [
        { name: 'country', options: ['IT', 'FR'], defaultValue: 'IT' },
        { name: 'region', dependsOn: ['country'], options: async ({ values }) => regions[values.country] ?? [], defaultValue: 'Lombardia' },
      ],
      templates: { t: '{{country}}/{{region}}' },
    });
    await flush();
    await flush();
    expect(control(form, 'region').disabled).toBe(false);
    expect(outputText(form, 't')).toBe('IT/Lombardia');
  });

  it('loads options from optionsUrl with placeholders', async () => {
    const fetch = vi.fn(async (url) => ({ ok: true, json: async () => (url.includes('IT') ? ['Roma'] : []) }));
    const form = mount({
      schema: [
        { name: 'country', options: ['IT'] },
        { name: 'city', type: 'select', dependsOn: 'country', optionsUrl: '/cities?country={country}' },
      ],
      templates: { t: '{{city}}' },
      fetch,
    });
    choose(control(form, 'country'), 'IT');
    await flush();
    await flush();
    expect(fetch).toHaveBeenLastCalledWith('/cities?country=IT', expect.anything());
    expect([...control(form, 'city').options].map((o) => o.textContent)).toContain('Roma');
  });
});

describe('custom field plugins', () => {
  it('registerField adds a type with render/getValue/setValue/validate', () => {
    registerField('coords', {
      render(ctx) {
        const el = document.createElement('div');
        el.innerHTML = `<input id="${ctx.id}" data-k="lat"><input data-k="lon">`;
        el.addEventListener('input', () => ctx.emit());
        return el;
      },
      getValue: (el) => {
        const [lat, lon] = [...el.querySelectorAll('input')].map((i) => i.value);
        return lat || lon ? `${lat},${lon}` : '';
      },
      setValue: (el, v) => {
        const [lat = '', lon = ''] = String(v ?? '').split(',');
        const [a, b] = el.querySelectorAll('input');
        a.value = lat;
        b.value = lon;
      },
      validate: (value) => (value && !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(value) ? 'Use lat,lon' : null),
    });
    expect(SimpleForm.fieldTypes()).toContain('coords');
    const form = mount({ schema: [{ name: 'pos', type: 'coords', defaultValue: '49.01,2.55' }], templates: { t: 'POINT({{pos}})' } });
    expect(outputText(form, 't')).toBe('POINT(49.01,2.55)');
    const [lat] = field(form, 'pos').querySelectorAll('input');
    type(lat, 'abc');
    expect(form.validate().errors.pos).toBe('Use lat,lon');
    expect(field(form, 'pos').querySelector('label').getAttribute('for')).toBe(lat.id);
  });

  it('rejects incomplete definitions', () => {
    expect(() => registerField('broken', { render() {} })).toThrow(/missing method\(s\) getValue, setValue/);
  });
});

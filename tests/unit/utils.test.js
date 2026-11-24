import { describe, expect, it } from 'vitest';
import { normalizeOptions, isEmpty, format, escapeHtml, resolveElement, sameValue } from '../../src/utils.js';
import { createOptionsLoader, filterOptions } from '../../src/options.js';
import { dedent, readTemplatesFromDOM } from '../../src/dom-templates.js';
import { createStore } from '../../src/persistence.js';
import { safeFilename, defaultFilename } from '../../src/output-view.js';

describe('utils', () => {
  it('normalizeOptions accepts strings, numbers, {text,value} and {label,value}', () => {
    expect(normalizeOptions(['a', 2, { text: 'France', value: 'FR' }, { label: 'L', value: 0 }, { value: 'v' }])).toEqual([
      { text: 'a', value: 'a' },
      { text: '2', value: 2 },
      { text: 'France', value: 'FR' },
      { text: 'L', value: 0 },
      { text: 'v', value: 'v' },
    ]);
  });
  it('isEmpty treats false and 0 as values', () => {
    expect([undefined, null, '', []].every(isEmpty)).toBe(true);
    expect([false, 0, 'x'].some(isEmpty)).toBe(false);
  });
  it('format, escapeHtml, sameValue', () => {
    expect(format('{a} {b} {c}', { a: 1, b: 'x' })).toBe('1 x {c}');
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(sameValue(1, '1')).toBe(true);
  });
  it('resolveElement accepts selectors and elements', () => {
    document.body.innerHTML = '<div id="x"></div>';
    expect(resolveElement('#x').id).toBe('x');
    expect(resolveElement(document.getElementById('x')).id).toBe('x');
    expect(() => resolveElement('#nope')).toThrow(/no element matches/);
    expect(() => resolveElement()).toThrow(/"element" option is required/);
    expect(() => resolveElement(42)).toThrow(/CSS selector or an HTMLElement/);
  });
});

describe('options', () => {
  it('filterOptions ranks prefix matches first', () => {
    const list = normalizeOptions(['Sudan', 'Andorra', 'Danemark']);
    expect(filterOptions(list, 'an').map((o) => o.text)).toEqual(['Andorra', 'Sudan', 'Danemark']);
    expect(filterOptions(list, '')).toHaveLength(3);
  });
  it('createOptionsLoader supports arrays, maps, functions and URLs', async () => {
    expect(createOptionsLoader({ options: ['a'] }).isStatic).toBe(true);
    const map = createOptionsLoader({ options: { IT: ['Roma'] }, dependsOn: ['country'] });
    expect(map({ values: { country: 'IT' } })).toEqual([{ text: 'Roma', value: 'Roma' }]);
    expect(map({ values: { country: 'XX' } })).toEqual([]);
    const fn = createOptionsLoader({ options: async ({ query }) => [query.toUpperCase()] });
    expect(await fn({ query: 'x', values: {} })).toEqual([{ text: 'X', value: 'X' }]);
    const calls = [];
    const fetchImpl = async (url) => (calls.push(url), { ok: true, json: async () => ['r'] });
    const url = createOptionsLoader({ optionsUrl: '/api?c={country}&q={query}' }, { fetchImpl });
    expect(await url({ values: { country: 'I T' }, query: 'ro' })).toEqual([{ text: 'r', value: 'r' }]);
    expect(calls).toEqual(['/api?c=I%20T&q=ro']);
    const failing = createOptionsLoader({ optionsUrl: '/x' }, { fetchImpl: async () => ({ ok: false, status: 500 }) });
    await expect(failing({ values: {} })).rejects.toThrow(/HTTP 500/);
    expect(createOptionsLoader({})).toBeNull();
  });
});

describe('DOM templates', () => {
  it('dedent removes common indentation and blank edges', () => {
    expect(dedent('\n    a\n      b\n    c\n  ')).toBe('a\n  b\nc');
  });
  it('reads script templates with data attributes', () => {
    document.body.innerHTML = `<div id="r">
      <script type="text/templates" name="Update" data-language="sql" data-filename="{{a}}.sql" data-per-row data-separator="\\n\\n">
        UPDATE {{a}};
      </script>
      <template data-sf-template="Doc" data-mode="html"><b>{{a}}</b></template>
    </div>`;
    const [a, b] = readTemplatesFromDOM(document.getElementById('r'));
    expect(a).toMatchObject({ key: 'Update', language: 'sql', filename: '{{a}}.sql', perRow: true, separator: '\n\n', source: 'UPDATE {{a}};', mode: 'text' });
    expect(b).toMatchObject({ key: 'Doc', mode: 'html', source: '<b>{{a}}</b>' });
  });
});

describe('persistence', () => {
  it('local store round-trips and survives bad JSON', () => {
    const store = createStore('local', 'k', window);
    store.save({ rows: [{ a: 1 }] });
    expect(store.load()).toEqual({ rows: [{ a: 1 }] });
    localStorage.setItem('k', '{bad');
    expect(store.load()).toBeNull();
    store.clear();
    expect(localStorage.getItem('k')).toBeNull();
  });
  it('url store writes a query parameter and builds share links', () => {
    const store = createStore('url', 'sf.x', window);
    store.save({ rows: [{ a: 'é' }] });
    expect(new URL(location.href).searchParams.get('sf.x')).toBe('{"rows":[{"a":"é"}]}');
    expect(store.load()).toEqual({ rows: [{ a: 'é' }] });
    expect(store.shareUrl({ rows: [] })).toContain('sf.x=');
    store.clear();
    expect(location.search).toBe('');
    expect(createStore(false, 'x', window)).toBeNull();
  });
});

describe('filenames', () => {
  it('sanitizes and derives extensions', () => {
    expect(safeFilename('a/b:c?.sql')).toBe('a_b_c_.sql');
    expect(defaultFilename({ key: 'Up date', language: 'sql', mode: 'text' })).toBe('Up_date.sql');
    expect(defaultFilename({ key: 'x', mode: 'html' })).toBe('x.html');
    expect(defaultFilename({ key: 'x', mode: 'text' })).toBe('x.txt');
  });
});

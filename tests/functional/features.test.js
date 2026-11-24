import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimpleForm, ScriptGenerator, autoInit, loadSchema } from '../../src/index.js';
import { control, mount, outputText, type, flush } from '../helpers.js';

const base = {
  schema: [
    { name: 'host', required: true },
    { name: 'port', type: 'number', defaultValue: 5432 },
    { name: 'ssl', type: 'checkbox' },
  ],
  templates: { url: 'postgres://{{host}}:{{port}}{{#if ssl}}?sslmode=require{{/if}}' },
};

describe('presets', () => {
  it('applies preset values from the toolbar and the API', () => {
    const form = mount({ ...base, presets: { staging: { host: 'db.staging', ssl: false }, prod: { host: 'db.prod', port: 6432, ssl: true } } });
    const select = form.element.querySelector('.sf-preset');
    expect([...select.options].map((o) => o.value)).toEqual(['', 'staging', 'prod']);
    select.value = 'prod';
    select.dispatchEvent(new Event('change'));
    expect(outputText(form, 'url')).toBe('postgres://db.prod:6432?sslmode=require');
    form.applyPreset('staging');
    expect(outputText(form, 'url')).toBe('postgres://db.staging:6432');
    expect(select.value).toBe('staging');
    expect(() => form.applyPreset('nope')).toThrow(/unknown preset/);
  });
});

describe('persistence', () => {
  it('local: saves on change and restores on the next load', () => {
    const form = mount({ ...base, persist: 'local' }, { id: 'db' });
    expect(localStorage.getItem('sf.db')).toBeNull(); // initial render is not a change
    type(control(form, 'host'), 'saved.example');
    expect(JSON.parse(localStorage.getItem('sf.db')).rows[0].host).toBe('saved.example');
    form.destroy();
    form.element.remove();
    const again = mount({ ...base, persist: 'local' }, { id: 'db' });
    expect(control(again, 'host').value).toBe('saved.example');
    again.reset();
    expect(localStorage.getItem('sf.db')).toBeNull();
  });

  it('url: keeps state in the query string and produces share links', async () => {
    history.replaceState(null, '', '/page?sf.db=' + encodeURIComponent(JSON.stringify({ rows: [{ host: 'from-url', ssl: true }] })));
    const form = mount({ ...base, persist: 'url' }, { id: 'db' });
    expect(outputText(form, 'url')).toBe('postgres://from-url:5432?sslmode=require');
    type(control(form, 'host'), 'edited');
    expect(new URL(location.href).searchParams.get('sf.db')).toContain('"host":"edited"');
    expect(form.getShareUrl()).toContain('sf.db=');
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    form.element.querySelector('.sf-share').click();
    await flush();
    expect(writeText).toHaveBeenCalledWith(form.getShareUrl());
  });

  it('ignores corrupted stored state', () => {
    localStorage.setItem('k', '{not json');
    const form = mount({ ...base, persist: 'local', persistKey: 'k' });
    expect(control(form, 'port').value).toBe('5432');
  });
});

describe('batch mode', () => {
  const batchConfig = {
    schema: [
      { name: 'code', required: true },
      { name: 'city', label: 'City' },
    ],
    templates: {
      inserts: { source: "INSERT INTO airport VALUES ({{sql code}}, {{sql city}});", perRow: true, language: 'sql' },
      summary: '{{count}} airports: {{#each rows}}{{code}}{{#unless @last}}, {{/unless}}{{/each}}',
    },
    batch: { min: 1, max: 3 },
  };

  it('adds and removes rows within min/max and renders per-row templates', () => {
    const form = mount(batchConfig);
    expect(form.element.querySelector('.sf-row-remove').disabled).toBe(true);
    type(control(form, 'code', 0), 'CDG');
    form.element.querySelector('.sf-add-row').click();
    type(control(form, 'code', 1), 'FCO');
    type(control(form, 'city', 1), "L'Aquila");
    expect(outputText(form, 'inserts')).toBe("INSERT INTO airport VALUES ('CDG', NULL);\nINSERT INTO airport VALUES ('FCO', 'L''Aquila');");
    expect(outputText(form, 'summary')).toBe('2 airports: CDG, FCO');
    form.addRow({ code: 'LHR' });
    expect(form.element.querySelector('.sf-add-row').disabled).toBe(true);
    expect(form.addRow()).toBeNull();
    expect(form.element.querySelectorAll('legend')[2].textContent).toBe('Row 3');
    form.element.querySelectorAll('.sf-row-remove')[0].click();
    expect(form.getValues().map((r) => r.code)).toEqual(['FCO', 'LHR']);
    expect(form.element.querySelectorAll('legend')[0].textContent).toBe('Row 1');
  });

  it('validates every row and labels missing values with the row number', () => {
    const form = mount(batchConfig);
    form.addRow();
    type(control(form, 'code', 0), 'CDG');
    const { errors } = form.validate();
    expect(errors).toEqual({ '1.code': 'code is required' });
    expect(form.element.querySelector('mark.sf-missing').textContent).toBe('code #2');
  });

  it('imports CSV (with or without header, replace or append) from the UI and the API', () => {
    const form = mount({ ...batchConfig, batch: { max: 10 } });
    expect(form.importCSV('code;City\nCDG;Paris\nFCO;Roma')).toBe(2);
    expect(form.getValues()).toEqual([{ code: 'CDG', city: 'Paris' }, { code: 'FCO', city: 'Roma' }]);

    form.element.querySelector('.sf-csv-input').value = 'LHR,London';
    form.element.querySelector('.sf-csv-append').checked = true;
    form.element.querySelector('.sf-csv-apply').click();
    expect(form.getValues().map((r) => r.code)).toEqual(['CDG', 'FCO', 'LHR']);
    expect(form.element.querySelector('.sf-csv-status').textContent).toBe('1 row(s) imported');
    expect(() => mount(base, { id: 'single' }).importCSV('a')).toThrow(/batch mode/);
  });

  it('setValues with an array replaces rows; with an object updates every row', () => {
    const form = mount({ ...batchConfig, batch: true });
    form.setValues([{ code: 'A' }, { code: 'B' }]);
    form.setValues({ city: 'X' });
    expect(form.getValues()).toEqual([{ code: 'A', city: 'X' }, { code: 'B', city: 'X' }]);
  });
});

describe('hooks and events', () => {
  it('calls onChange/onRender/onInvalid and dispatches DOM events', () => {
    const onChange = vi.fn();
    const onRender = vi.fn();
    const onInvalid = vi.fn();
    const form = mount({ ...base, onChange, onRender, onInvalid });
    const domEvents = [];
    form.element.addEventListener('simpleform:change', (e) => domEvents.push(e.detail.values.host));
    const off = form.on('render', (d) => domEvents.push(`render:${d.outputs.url}`));

    type(control(form, 'host'), 'h');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ values: { host: 'h', port: 5432, ssl: false }, valid: true }));
    expect(onRender).toHaveBeenLastCalledWith(expect.objectContaining({ outputs: { url: 'postgres://h:5432' } }));
    type(control(form, 'host'), '');
    expect(onInvalid).toHaveBeenLastCalledWith(expect.objectContaining({ errors: { host: 'host is required' } }));
    off();
    type(control(form, 'host'), 'z');
    expect(domEvents).toEqual(['h', 'render:postgres://h:5432', '', 'z']);
  });

  it('a failing hook is reported, not thrown', () => {
    const onError = vi.fn();
    const form = mount({ ...base, onChange: () => { throw new Error('hook'); }, onError });
    type(control(form, 'host'), 'x');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ hook: 'onChange' }));
  });
});

describe('copy and download', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
  });

  it('copies the final text and gives feedback', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onCopy = vi.fn();
    const form = mount({ ...base, onCopy });
    type(control(form, 'host'), 'h');
    const button = form.element.querySelector('.sf-copy');
    button.click();
    await flush();
    expect(writeText).toHaveBeenCalledWith('postgres://h:5432');
    expect(button.textContent).toBe('Copied!');
    expect(onCopy).toHaveBeenCalledWith(expect.objectContaining({ template: 'url', text: 'postgres://h:5432' }));
  });

  it('falls back to execCommand and refuses to copy invalid output', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    document.execCommand = vi.fn(() => true);
    const form = mount(base);
    expect(await form.copy('url')).toBe(false); // host missing
    type(control(form, 'host'), 'h');
    expect(await form.copy('url')).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('downloads with a templated, sanitized file name', () => {
    const clicks = [];
    HTMLAnchorElement.prototype.click = function click() {
      clicks.push(this.getAttribute('download'));
    };
    const form = mount({
      schema: [{ name: 'code', required: true }],
      templates: { up: { source: 'x', filename: '{{code}}/update-{{code}}.sql' }, other: { source: 'y', language: 'yaml' } },
    });
    expect(form.download('up')).toBeNull();
    type(control(form, 'code'), 'CDG');
    expect(form.download('up')).toBe('CDG_update-CDG.sql');
    form.element.querySelector('[data-template="other"] .sf-download').click();
    expect(clicks).toEqual(['CDG_update-CDG.sql', 'other.yaml']);
  });
});

describe('schema import/export', () => {
  it('exportSchema returns JSON and warns about functions; the export can rebuild the form', () => {
    const form = mount({
      ...base,
      schema: [...base.schema, { name: 'x', options: () => ['a'], visibleWhen: () => true, validation: { custom: () => true } }],
      presets: { prod: { host: 'p' } },
      batch: { max: 5 },
    });
    const { config, warnings } = form.exportSchema();
    expect(warnings).toHaveLength(3);
    expect(config.schema.map((f) => f.name)).toEqual(['host', 'port', 'ssl', 'x']);
    expect(config.templates.url.source).toContain('postgres://');
    expect(config.batch).toEqual({ min: 1, max: 5, csv: true, initialRows: 1 });
    expect(JSON.parse(JSON.stringify(config))).toEqual(config);

    const rebuilt = mount({ ...config, schema: config.schema.filter((f) => f.name !== 'x') }, { id: 'rebuilt' });
    rebuilt.setValues([{ host: 'h' }]);
    expect(outputText(rebuilt, 'url')).toBe('postgres://h:5432');
  });

  it('loadSchema fetches JSON configs and reports bad responses', async () => {
    const ok = vi.fn(async () => ({ ok: true, json: async () => [{ name: 'a' }] }));
    expect(await loadSchema('/s.json', { fetch: ok })).toEqual({ schema: [{ name: 'a' }] });
    await expect(loadSchema('/x', { fetch: async () => ({ ok: false, status: 404 }) })).rejects.toThrow(/HTTP 404/);
    await expect(loadSchema('/x', { fetch: async () => ({ ok: true, json: async () => { throw new Error('bad'); } }) })).rejects.toThrow(/not valid JSON/);
  });
});

describe('declarative mode', () => {
  it('builds forms from markup only (inline JSON or data-schema-src)', async () => {
    document.body.innerHTML = `
      <div data-simpleform id="inline" data-live-preview="true">
        <script type="application/json" class="sf-schema">{ "schema": [{ "name": "code", "label": "Code" }] }</script>
        <script type="text/templates" name="Update" data-language="sql">
          UPDATE t SET c = {{sql code}};
        </script>
      </div>
      <div data-simpleform data-schema-src="/remote.json"></div>
      <div data-simpleform id="broken"></div>`;
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ schema: [{ name: 'a' }], templates: { t: 'A={{a}}' } }) }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const forms = await autoInit(document, { fetch });
    expect(forms).toHaveLength(2);
    expect(document.getElementById('broken').dataset.sfError).toMatch(/needs a <script/);
    expect(spy).toHaveBeenCalled();
    const inline = document.getElementById('inline').simpleForm;
    type(control(inline, 'code'), "O'K");
    expect(outputText(inline, 'Update')).toBe("UPDATE t SET c = 'O''K';");
    expect(await autoInit(document, { fetch })).toHaveLength(0); // idempotent
  });
});

describe('1.x compatibility (ScriptGenerator)', () => {
  it('runs the original example markup without jQuery', () => {
    document.body.innerHTML = `
      <div id="gen">
        <script type="text/templates" name="Update">
          airportCode: {{airportCode}}
          countryCode: {{countryCode}}
        </script>
        <script type="text/templates" name="Rollback"><b>{{airportCode}}</b></script>
      </div>`;
    const countries = [{ text: 'France', value: 'FR' }, { text: 'Turchia', value: 'TR' }];
    const gen = new ScriptGenerator(
      [
        { fieldName: 'airportCode', placeholder: 'CDG', defaultValue: 'CDG' },
        { fieldName: 'countryCode', placeholder: 'France', values: countries },
      ],
      'gen',
    );
    const form = gen.form;
    expect(control(form, 'airportCode').value).toBe('CDG'); // defaultValue now works
    type(control(form, 'countryCode'), 'tur');
    form.element.querySelector('[role="option"]').click();
    expect(form.element.querySelector('.sf-outputs').hidden).toBe(true);
    gen.execute();
    expect(outputText(form, 'Update')).toBe('airportCode: CDG\ncountryCode: TR');
    expect(form.element.querySelector('[data-template="Rollback"] .sf-html b').textContent).toBe('CDG');
    gen.resetForm();
    expect(form.element.querySelector('.sf-outputs').hidden).toBe(true);
    expect(gen.getValues()).toEqual({ airportCode: 'CDG', countryCode: '' });
  });

  it('generatorId is optional (falls back to <body>) and unknown ids fail clearly', () => {
    document.body.innerHTML = '<script type="text/templates" name="T">{{a}}</script>';
    const gen = new ScriptGenerator([{ fieldName: 'a' }]);
    expect(gen.form.element).toBe(document.body);
    expect(() => new ScriptGenerator([{ fieldName: 'a' }], 'missing')).toThrow(/no element with id "missing"/);
  });

  it('exposes the API on the SimpleForm namespace', () => {
    expect(SimpleForm.version).toBe('2.0.0');
    expect(typeof SimpleForm.registerField).toBe('function');
    expect(typeof SimpleForm.loadSchema).toBe('function');
  });
});

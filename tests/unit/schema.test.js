import { describe, expect, it } from 'vitest';
import '../../src/fields/builtin.js';
import { normalizeConfig, normalizeTemplates, validateConfig } from '../../src/schema.js';

const problems = (config) => validateConfig(normalizeConfig({ templates: { t: 'x' }, ...config }));

describe('normalizeConfig', () => {
  it('maps 1.x names and infers types', () => {
    const cfg = normalizeConfig({ schema: [{ fieldName: 'a', values: ['x'] }, { name: 'b', required: true, min: 2 }] });
    expect(cfg.schema[0]).toMatchObject({ name: 'a', label: 'a', type: 'select', options: ['x'] });
    expect(cfg.schema[1].validation).toEqual({ required: true, min: 2 });
    expect(cfg.livePreview).toBe(true);
  });

  it('normalizes templates given as map, objects or array', () => {
    expect(normalizeTemplates({ a: 'src' })[0]).toMatchObject({ key: 'a', title: 'a', source: 'src', mode: 'text', perRow: false, separator: '\n' });
    expect(normalizeTemplates([{ name: 'B', source: 's', mode: 'html' }])[0]).toMatchObject({ key: 'B', mode: 'html' });
  });

  it('fills batch defaults', () => {
    expect(normalizeConfig({ batch: true }).batch).toEqual({ min: 1, max: Infinity, csv: true, initialRows: 1 });
  });
});

describe('validateConfig', () => {
  it('accepts a valid configuration', () => {
    expect(problems({ schema: [{ name: 'a' }] })).toEqual([]);
  });

  it('reports every problem at once', () => {
    const list = problems({
      schema: [
        { name: 'bad name' },
        { name: 'dup' },
        { name: 'dup' },
        { name: 'rows' },
        { name: 't', type: 'nope' },
        { name: 's', type: 'select' },
        { name: 'p', pattern: '([' },
        { name: 'v', visibleWhen: { field: 'ghost' } },
        { name: 'd', dependsOn: 'ghost2' },
        { name: 'm', options: { IT: [] } },
      ],
      persist: 'cookie',
      presets: { prod: { ghost3: 1 } },
    });
    const text = list.join('\n');
    expect(text).toMatch(/"name" must be a valid identifier/);
    expect(text).toMatch(/duplicate field name "dup"/);
    expect(text).toMatch(/"rows" is reserved/);
    expect(text).toMatch(/unknown type "nope"/);
    expect(text).toMatch(/type "select" needs "options"/);
    expect(text).toMatch(/invalid pattern/);
    expect(text).toMatch(/visibleWhen references unknown field "ghost"/);
    expect(text).toMatch(/dependsOn references unknown field "ghost2"/);
    expect(text).toMatch(/options map requires exactly one "dependsOn"/);
    expect(text).toMatch(/"persist" must be/);
    expect(text).toMatch(/preset "prod" sets unknown field "ghost3"/);
  });

  it('requires schema and templates', () => {
    expect(validateConfig(normalizeConfig({}))).toEqual(['"schema" must be a non-empty array of fields.']);
    expect(validateConfig(normalizeConfig({ schema: [{ name: 'a' }] })).join()).toMatch(/at least one template/);
    expect(problems({ schema: [{ name: 'a' }], templates: { t: { source: 'x', mode: 'pdf' } } }).join()).toMatch(/mode must be/);
    expect(problems({ schema: [{ name: 'a' }], templates: { t: { source: 'x', mode: 'plain' } } })).toEqual([]);
  });
});

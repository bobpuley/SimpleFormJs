import Handlebars from 'handlebars';
import { describe, expect, it, vi } from 'vitest';
import { builtinHelpers } from '../../src/helpers.js';
import { TemplateEngine, marker, replaceMarkers, toPreviewHtml, stripMarkers } from '../../src/template-engine.js';
import { SimpleFormError } from '../../src/errors.js';

const engine = new TemplateEngine({ handlebars: Handlebars });
const run = (src, ctx = {}, mode = 'text') => engine.compile(src, { mode })(ctx);

describe('built-in helpers', () => {
  it('sql escapes quotes, keeps numbers/booleans and maps empty to NULL', () => {
    expect(run('{{sql v}}', { v: "O'Brien" })).toBe("'O''Brien'");
    expect(run('{{sql v}}', { v: 42 })).toBe('42');
    expect(run('{{sql v}}', { v: true })).toBe('TRUE');
    expect(run('{{sql v}}', { v: '' })).toBe('NULL');
    expect(run('{{sql v}}', {})).toBe('NULL');
  });

  it('quote escapes the quote char and backslashes', () => {
    expect(run('{{quote v}}', { v: 'say "hi" \\o/' })).toBe('"say \\"hi\\" \\\\o/"');
    expect(run(`{{quote v "'"}}`, { v: "it's" })).toBe("'it\\'s'");
  });

  it('string helpers, default, json, join and comparisons', () => {
    expect(run('{{upper v}}-{{lower v}}-[{{trim w}}]', { v: 'Ab', w: '  x ' })).toBe('AB-ab-[x]');
    expect(run('{{default v "fallback"}}', { v: '' })).toBe('fallback');
    expect(run('{{default v "fallback"}}', { v: 0 })).toBe('0');
    expect(run('{{json v}}', { v: { a: 1 } })).toBe('{"a":1}');
    expect(run('{{json v}}', {})).toBe('null');
    expect(run('{{join v " | "}}', { v: ['a', 'b'] })).toBe('a | b');
    expect(run('{{#if (eq a "IT")}}yes{{else}}no{{/if}}', { a: 'IT' })).toBe('yes');
    expect(run('{{#if (ne a "IT")}}yes{{else}}no{{/if}}', { a: 'IT' })).toBe('no');
    expect(run('{{#if (and a b)}}1{{/if}}{{#if (or a c)}}2{{/if}}{{#if (not c)}}3{{/if}}', { a: 1, b: 1, c: 0 })).toBe('123');
  });

  it('now supports date, time, datetime and ISO formats', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 24, 9, 5, 7));
    expect(run('{{now "date"}}')).toBe('2026-11-24');
    expect(run('{{now "time"}}')).toBe('09:05:07');
    expect(run('{{now "datetime"}}')).toBe('2026-11-24 09:05:07');
    expect(run('{{now}}')).toBe(new Date(2026, 10, 24, 9, 5, 7).toISOString());
    vi.useRealTimers();
  });

  it('exposes helpers as plain functions', () => {
    expect(builtinHelpers.sql('x', {})).toBe("'x'");
  });
});

describe('TemplateEngine', () => {
  it('text mode does not HTML-escape, html mode does', () => {
    expect(run('{{v}}', { v: "<b>O'Brien</b>" }, 'text')).toBe("<b>O'Brien</b>");
    expect(run('<p>{{v}}</p>', { v: '<img src=x onerror=alert(1)>' }, 'html')).toBe(
      '<p>&lt;img src&#x3D;x onerror&#x3D;alert(1)&gt;</p>',
    );
  });

  it('plain mode, like text mode, does not HTML-escape', () => {
    expect(run('{{v}}', { v: "<i>O'Brien</i>" }, 'plain')).toBe("<i>O'Brien</i>");
  });

  it('reports syntax errors at compile time with the template name', () => {
    expect(() => engine.compile('{{#if x}}open', { name: 'broken' })).toThrow(/template "broken" cannot be compiled/);
  });

  it('uses an isolated Handlebars environment', () => {
    new TemplateEngine({ handlebars: Handlebars });
    expect(Handlebars.helpers.sql).toBeUndefined();
  });

  it('supports instance helpers and custom engines', () => {
    const e = new TemplateEngine({ handlebars: Handlebars, helpers: { shout: (v) => `${v}!` } });
    expect(e.compile('{{shout v}}')({ v: 'hey' })).toBe('hey!');
    const custom = new TemplateEngine({ engine: { compile: (src) => (ctx) => src.replace('$x', ctx.x) } });
    expect(custom.compile('value=$x')({ x: 3 })).toBe('value=3');
  });

  it('fails clearly when Handlebars is missing', () => {
    const saved = globalThis.Handlebars;
    delete globalThis.Handlebars;
    try {
      expect(() => new TemplateEngine()).toThrow(SimpleFormError);
      expect(() => new TemplateEngine()).toThrow(/Handlebars is required/);
    } finally {
      globalThis.Handlebars = saved;
    }
  });
});

describe('missing-value markers', () => {
  it('survive helpers and become <mark> elements', () => {
    const text = run("{{sql a}} {{upper b}} {{json c}}", { a: marker(0), b: marker(1), c: marker(2) });
    const labels = [{ name: 'a', label: 'A' }, { name: 'b', label: 'B<x>' }, { name: 'c', label: 'C' }];
    const html = toPreviewHtml(text, { labels, highlight: null });
    expect(html).toBe(
      `&#39;<mark class="sf-missing" data-field="a">A</mark>&#39; <mark class="sf-missing" data-field="b">B&lt;x&gt;</mark> &quot;<mark class="sf-missing" data-field="c">C</mark>&quot;`,
    );
  });

  it('can be replaced or stripped', () => {
    expect(replaceMarkers(`x${marker(3)}y`, (i) => `#${i}`)).toBe('x#3y');
    expect(stripMarkers(`a${marker(0)}b`)).toBe('ab');
  });
});

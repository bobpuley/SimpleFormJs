import { describe, expect, it } from 'vitest';
import { highlight, supportedLanguages } from '../../src/highlight.js';
import { marker } from '../../src/template-engine.js';

describe('highlight', () => {
  it('tokenizes SQL keywords, strings, numbers and comments', () => {
    const html = highlight("-- note\nUPDATE t SET a = 'x' WHERE id = 3;", 'sql');
    expect(html).toContain('<span class="sf-tok-comment">-- note</span>');
    expect(html).toContain('<span class="sf-tok-keyword">UPDATE</span>');
    expect(html).toContain('<span class="sf-tok-string">&#39;x&#39;</span>');
    expect(html).toContain('<span class="sf-tok-number">3</span>');
  });

  it('escapes HTML everywhere', () => {
    const html = highlight("SELECT '<script>' FROM t -- <b>", 'sql');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(highlight('<i>plain</i>', 'unknown')).toBe('&lt;i&gt;plain&lt;/i&gt;');
  });

  it('handles JSON keys vs strings, YAML keys and shell variables/flags', () => {
    expect(highlight('{"a": "b", "n": 1}', 'json')).toMatch(/sf-tok-key">&quot;a&quot;.*sf-tok-string">&quot;b&quot;/);
    expect(highlight('name: CDG # c', 'yaml')).toContain('<span class="sf-tok-key">name</span>');
    const sh = highlight('curl -X POST "$URL" --data ${BODY}', 'shell');
    expect(sh).toContain('sf-tok-keyword">-X');
    expect(sh).toContain('sf-tok-variable">${BODY}');
  });

  it('does not break missing-value markers', () => {
    const code = `x = '${marker(5)}' AND y = ${marker(6)}`;
    const html = highlight(code, 'sql');
    expect(html).toContain(marker(5));
    expect(html).toContain(marker(6));
  });

  it('lists supported languages', () => {
    expect(supportedLanguages()).toEqual(expect.arrayContaining(['sql', 'json', 'yaml', 'shell']));
  });
});

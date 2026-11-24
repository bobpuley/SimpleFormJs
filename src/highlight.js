import { escapeHtml } from './utils.js';

/**
 * Minimal, dependency-free syntax highlighter for the formats SimpleForm usually
 * generates. Plug Prism/highlight.js instead via the `highlight` option.
 * Input is raw text; output is safe HTML (every token is escaped).
 */
const LANGUAGES = {
  sql: {
    flags: 'gi',
    tokens: [
      ['comment', /--[^\n]*|\/\*[\s\S]*?\*\//],
      ['string', /'(?:[^']|'')*'/],
      [
        'keyword',
        /\b(?:select|insert|into|values|update|set|delete|from|where|and|or|not|null|is|in|exists|create|table|alter|add|drop|begin|commit|rollback|transaction|join|left|right|inner|outer|on|as|order|by|group|having|limit|offset|returning|default|primary|key|references|if|true|false|case|when|then|else|end|distinct|union|all|merge|using|matched)\b/,
      ],
      ['number', /\b\d+(?:\.\d+)?\b/],
    ],
  },
  json: {
    flags: 'g',
    tokens: [
      ['key', /"(?:[^"\\\n]|\\.)*"(?=\s*:)/],
      ['string', /"(?:[^"\\\n]|\\.)*"/],
      ['keyword', /\b(?:true|false|null)\b/],
      ['number', /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/],
    ],
  },
  yaml: {
    flags: 'gm',
    tokens: [
      ['comment', /#[^\n]*/],
      ['key', /^[ \t-]*[\w.-]+(?=[ \t]*:)/],
      ['string', /"(?:[^"\\\n]|\\.)*"|'(?:[^'\n]|'')*'/],
      ['keyword', /\b(?:true|false|null|yes|no|on|off)\b/],
      ['number', /\b\d+(?:\.\d+)?\b/],
    ],
  },
  shell: {
    flags: 'g',
    tokens: [
      ['comment', /(?<![\w$])#[^\n]*/],
      ['string', /"(?:[^"\\]|\\.)*"|'[^']*'/],
      ['variable', /\$\{[^}\n]+\}|\$\w+/],
      ['keyword', /(?<![\w-])--?[A-Za-z][\w-]*/],
    ],
  },
};
LANGUAGES.bash = LANGUAGES.shell;
LANGUAGES.sh = LANGUAGES.shell;
LANGUAGES.yml = LANGUAGES.yaml;

const compiled = new Map();

function getMatcher(language) {
  if (compiled.has(language)) return compiled.get(language);
  const def = LANGUAGES[language];
  if (!def) return null;
  const regex = new RegExp(def.tokens.map(([, re]) => `(${re.source})`).join('|'), def.flags);
  const matcher = { regex, names: def.tokens.map(([name]) => name) };
  compiled.set(language, matcher);
  return matcher;
}

export const supportedLanguages = () => Object.keys(LANGUAGES);

export function highlight(code, language) {
  const matcher = language && getMatcher(String(language).toLowerCase());
  if (!matcher) return escapeHtml(code);
  const { regex, names } = matcher;
  regex.lastIndex = 0;
  let out = '';
  let last = 0;
  let m;
  while ((m = regex.exec(code))) {
    if (m[0] === '') {
      regex.lastIndex++;
      continue;
    }
    const groupIndex = m.slice(1).findIndex((g) => g !== undefined);
    out += escapeHtml(code.slice(last, m.index));
    out += `<span class="sf-tok-${names[groupIndex]}">${escapeHtml(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + escapeHtml(code.slice(last));
}

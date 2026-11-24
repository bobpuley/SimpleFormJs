/** Removes leading/trailing blank lines and the common indentation (templates live indented in HTML). */
export function dedent(source) {
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)[0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min)).join('\n');
}

const SELECTOR = 'script[type="text/templates"], script[type="text/x-simpleform"], template[data-sf-template]';

/**
 * Reads templates declared inside `root`:
 *   <script type="text/templates" name="Update" data-language="sql" data-filename="{{code}}.sql"
 *           data-mode="text" data-per-row data-separator="\n\n" data-title="Update script">…</script>
 */
export function readTemplatesFromDOM(root, { defaultMode = 'text' } = {}) {
  return [...root.querySelectorAll(SELECTOR)]
    .filter((el) => !el.closest('.sf-root'))
    .map((el, i) => {
      const d = el.dataset;
      const key = el.getAttribute('name') || d.sfTemplate || `template${i + 1}`;
      const raw = el.tagName === 'TEMPLATE' ? el.innerHTML : el.textContent;
      const perRow = d.perRow !== undefined && d.perRow !== 'false';
      return {
        key,
        title: d.title ?? key,
        source: dedent(raw),
        mode: d.mode ?? defaultMode,
        language: d.language,
        filename: d.filename,
        perRow,
        separator: d.separator !== undefined ? d.separator.replace(/\\n/g, '\n').replace(/\\t/g, '\t') : '\n',
      };
    });
}

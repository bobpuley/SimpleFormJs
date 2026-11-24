import { format, h } from './utils.js';

const EXTENSIONS = { sql: 'sql', json: 'json', yaml: 'yaml', yml: 'yaml', shell: 'sh', bash: 'sh', sh: 'sh' };

export const defaultFilename = (template) =>
  `${template.key.replace(/\W+/g, '_')}.${template.mode === 'html' ? 'html' : EXTENSIONS[template.language] ?? 'txt'}`;

export const safeFilename = (name) => String(name).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim() || 'output.txt';

/** Renders one panel per template with Copy and Download actions. */
export class OutputView {
  constructor(form) {
    this.form = form;
    const { doc, config } = form;
    this.notice = h(doc, 'p', { class: 'sf-notice', role: 'status', hidden: true, text: config.messages.incomplete });
    this.element = h(doc, 'div', { class: 'sf-outputs', 'aria-live': 'polite' }, this.notice);
    this.panels = new Map();
    for (const template of config.templates) {
      const panel = this.createPanel(template);
      this.panels.set(template.key, panel);
      this.element.append(panel.element);
    }
  }

  createPanel(template) {
    const { doc, config } = this.form;
    const m = config.messages;
    const copy = h(doc, 'button', {
      type: 'button',
      class: 'sf-button sf-copy',
      'aria-label': `${m.copy} ${template.title}`,
      text: m.copy,
      onClick: () => this.form.copy(template.key),
    });
    const download = h(doc, 'button', {
      type: 'button',
      class: 'sf-button sf-button-ghost sf-download',
      'aria-label': `${m.download} ${template.title}`,
      text: m.download,
      onClick: () => this.form.download(template.key),
    });
    let body;
    let content;
    if (template.mode === 'html') {
      body = content = h(doc, 'div', { class: 'sf-html' });
    } else if (template.mode === 'plain') {
      // regular text (e.g. an email body): no code styling, still never parsed as HTML
      body = content = h(doc, 'div', { class: 'sf-plain' });
    } else {
      body = h(doc, 'code', { class: template.language ? `language-${template.language}` : undefined });
      content = h(doc, 'pre', { class: 'sf-code' }, body);
    }
    const error = h(doc, 'div', { class: 'sf-template-error', role: 'alert', hidden: true });
    const element = h(
      doc,
      'section',
      { class: 'sf-output', dataset: { template: template.key } },
      h(doc, 'header', { class: 'sf-output-header' }, h(doc, 'h3', { class: 'sf-output-title', text: template.title }), h(doc, 'div', { class: 'sf-output-actions' }, copy, download)),
      error,
      content,
    );
    return { element, body, copy, download, error, template };
  }

  /** results: Map key -> { previewHtml, error } */
  update(results, { valid }) {
    this.element.hidden = false;
    this.notice.hidden = valid;
    for (const [key, panel] of this.panels) {
      const result = results.get(key);
      if (result.error) {
        panel.error.hidden = false;
        panel.error.textContent = format(this.form.config.messages.templateError, { message: result.error.message });
        panel.body.innerHTML = '';
      } else {
        panel.error.hidden = true;
        // previewHtml is built from escaped text (text mode) or Handlebars-escaped values (html mode)
        panel.body.innerHTML = result.previewHtml;
      }
      const disabled = !valid || Boolean(result.error);
      panel.copy.disabled = disabled;
      panel.download.disabled = disabled;
    }
  }

  hide() {
    this.element.hidden = true;
  }

  flash(key, button, text) {
    const panel = this.panels.get(key);
    const target = panel?.[button] ?? button;
    if (!target || typeof target === 'string') return;
    const original = target.dataset.label ?? target.textContent;
    target.dataset.label = original;
    target.textContent = text;
    target.classList.add('sf-flash');
    clearTimeout(target._sfTimer);
    target._sfTimer = setTimeout(() => {
      target.textContent = original;
      target.classList.remove('sf-flash');
    }, 1500);
  }
}

/** Clipboard with fallbacks: async API → execCommand. Returns a Promise<boolean>. */
export async function copyToClipboard(doc, text, html) {
  const nav = doc.defaultView?.navigator;
  try {
    if (html && nav?.clipboard?.write && typeof doc.defaultView.ClipboardItem === 'function') {
      const { ClipboardItem, Blob } = doc.defaultView;
      await nav.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  const area = h(doc, 'textarea', { style: 'position:fixed;top:-1000px;opacity:0', readonly: true });
  area.value = text;
  doc.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = doc.execCommand?.('copy') ?? false;
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

export function downloadFile(doc, filename, content, type) {
  const win = doc.defaultView;
  const blob = new win.Blob([content], { type });
  const url = win.URL.createObjectURL(blob);
  const a = h(doc, 'a', { href: url, download: filename, hidden: true });
  doc.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => win.URL.revokeObjectURL(url), 0);
}

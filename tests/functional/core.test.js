import { describe, expect, it, vi } from 'vitest';
import { SimpleForm, SimpleFormError } from '../../src/index.js';
import { blur, check, choose, control, field, mount, outputText, type, flush } from '../helpers.js';

const airport = {
  schema: [
    { name: 'airportCode', label: 'Airport code', required: true, defaultValue: 'CDG', validation: { pattern: '^[A-Z]{3}$' } },
    { name: 'airportName', label: 'Airport name' },
  ],
  templates: {
    update: { source: 'UPDATE airport SET name = {{sql airportName}} WHERE code = {{sql airportCode}};', language: 'sql' },
  },
};

describe('rendering and live preview', () => {
  it('renders labelled controls with generated ids and applies defaultValue', () => {
    const form = mount(airport);
    const input = control(form, 'airportCode');
    expect(input.value).toBe('CDG');
    const label = field(form, 'airportCode').querySelector('label');
    expect(label.getAttribute('for')).toBe(input.id);
    expect(document.getElementById(input.id)).toBe(input);
    expect(label.textContent).toContain('Airport code');
    expect(input.getAttribute('aria-required')).toBe('true');
  });

  it('updates outputs while typing, with SQL escaping and highlighting', () => {
    const form = mount(airport);
    type(control(form, 'airportName'), "Charles d'Gaulle");
    expect(outputText(form, 'update')).toBe("UPDATE airport SET name = 'Charles d''Gaulle' WHERE code = 'CDG';");
    expect(form.element.querySelector('.sf-output code .sf-tok-keyword').textContent).toBe('UPDATE');
    expect(form.getOutputs().update).toContain("'Charles d''Gaulle'");
  });

  it('field names cannot clash with internal CSS classes (1.x bug)', () => {
    const form = mount({ schema: [{ name: 'code' }, { name: 'container' }], templates: { t: '{{code}}/{{container}}' } });
    type(control(form, 'code'), 'A');
    type(control(form, 'container'), 'B');
    expect(outputText(form, 't')).toBe('A/B');
  });

  it('two forms on the same page stay independent', () => {
    const a = mount({ schema: [{ name: 'x' }], templates: { t: 'a={{x}}' } }, { id: 'a' });
    const b = mount({ schema: [{ name: 'x' }], templates: { t: 'b={{x}}' } }, { id: 'b' });
    type(control(a, 'x'), '1');
    expect(outputText(a, 't')).toBe('a=1');
    expect(outputText(b, 't')).toBe('b=');
    expect(control(a, 'x').id).not.toBe(control(b, 'x').id);
  });

  it('text mode outputs are never interpreted as HTML', () => {
    const form = mount({ schema: [{ name: 'x' }], templates: { t: '{{x}}' } });
    type(control(form, 'x'), '<img src=x onerror="window.pwned=1">');
    expect(form.element.querySelector('.sf-output img')).toBeNull();
    expect(outputText(form, 't')).toBe('<img src=x onerror="window.pwned=1">');
  });

  it('html mode renders template markup but escapes values', () => {
    const form = mount({ schema: [{ name: 'x' }], templates: { t: { source: '<b class="v">{{x}}</b>', mode: 'html' } } });
    type(control(form, 'x'), '<i>boom</i>');
    const b = form.element.querySelector('.sf-html b.v');
    expect(b.textContent).toBe('<i>boom</i>');
    expect(b.querySelector('i')).toBeNull();
  });
});

describe('validation and missing values', () => {
  it('marks empty required fields in the preview and disables copy/download', () => {
    const form = mount(airport);
    type(control(form, 'airportCode'), '');
    const panel = form.element.querySelector('.sf-output');
    expect(panel.querySelector('mark.sf-missing').textContent).toBe('Airport code');
    expect(panel.querySelector('.sf-copy').disabled).toBe(true);
    expect(panel.querySelector('.sf-download').disabled).toBe(true);
    expect(form.element.querySelector('.sf-notice').hidden).toBe(false);
    expect(form.getOutputs()).toBeNull();

    type(control(form, 'airportCode'), 'FCO');
    expect(panel.querySelector('mark')).toBeNull();
    expect(panel.querySelector('.sf-copy').disabled).toBe(false);
  });

  it('shows errors after the field is touched, with aria attributes and a summary', () => {
    const form = mount(airport);
    const input = control(form, 'airportCode');
    type(input, 'xx');
    const wrapper = field(form, 'airportCode');
    expect(wrapper.querySelector('.sf-error').textContent).toBe('');
    blur(input);
    expect(wrapper.querySelector('.sf-error').textContent).toBe('Airport code has an invalid format');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain(wrapper.querySelector('.sf-error').id);
    expect(form.element.querySelector('.sf-summary').textContent).toBe('1 field(s) need attention');
  });

  it('validate() reports every error', () => {
    const form = mount({
      schema: [
        { name: 'a', required: true },
        { name: 'n', type: 'number', min: 1 },
      ],
      templates: { t: '{{a}}{{n}}' },
    });
    type(control(form, 'n'), '0');
    const { valid, errors } = form.validate();
    expect(valid).toBe(false);
    expect(Object.keys(errors)).toEqual(['a', 'n']);
  });
});

describe('field types', () => {
  it('number, checkbox, select, textarea, date, email', () => {
    const form = mount({
      schema: [
        { name: 'n', type: 'number' },
        { name: 'c', type: 'checkbox', defaultValue: true },
        { name: 's', type: 'select', options: [{ text: 'France', value: 'FR' }, 'IT'] },
        { name: 't', type: 'textarea' },
        { name: 'd', type: 'date' },
        { name: 'e', type: 'email' },
      ],
      templates: { out: '{{json n}}|{{c}}|{{s}}|{{t}}|{{d}}|{{e}}' },
    });
    type(control(form, 'n'), '2.5');
    choose(control(form, 's'), 'France');
    type(control(form, 't'), 'a\nb');
    type(control(form, 'd'), '2026-11-24');
    type(control(form, 'e'), 'a@b.co');
    expect(outputText(form, 'out')).toBe('2.5|true|FR|a\nb|2026-11-24|a@b.co');
    check(control(form, 'c'), false);
    expect(form.getValues()).toEqual({ n: 2.5, c: false, s: 'FR', t: 'a\nb', d: '2026-11-24', e: 'a@b.co' });
  });

  it('setValues accepts option values or texts for selects', () => {
    const form = mount({ schema: [{ name: 's', options: [{ text: 'France', value: 'FR' }] }], templates: { t: '{{s}}' } });
    form.setValues({ s: 'france' });
    expect(form.getValues().s).toBe('FR');
    form.setValues({ s: 'FR' });
    expect(control(form, 's').selectedOptions[0].textContent).toBe('France');
  });
});

describe('construction errors', () => {
  it('throws a SimpleFormError listing every problem', () => {
    document.body.innerHTML = '<div id="x"></div>';
    let error;
    try {
      new SimpleForm({ element: '#x', schema: [{ name: 'a b' }, { name: 'c', type: 'nope' }], templates: { t: 'x' } });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(SimpleFormError);
    expect(error.problems).toHaveLength(2);
  });

  it('refuses a second form on the same element and persist without a key', () => {
    const form = mount(airport);
    expect(() => new SimpleForm({ ...airport, element: form.element })).toThrow(/already hosts a form/);
    form.destroy();
    expect(() => new SimpleForm({ ...airport, element: form.element })).not.toThrow();
    const anon = document.createElement('div');
    document.body.append(anon);
    expect(() => new SimpleForm({ ...airport, element: anon, persist: 'local' })).toThrow(/persistKey/);
  });

  it('reports template syntax errors with the template name', () => {
    document.body.innerHTML = '<div id="x"></div>';
    expect(() => new SimpleForm({ element: '#x', schema: [{ name: 'a' }], templates: { broken: '{{#each a}}' } })).toThrow(
      /template "broken" cannot be compiled/,
    );
  });

  it('shows runtime template errors in the panel and calls onError', () => {
    const onError = vi.fn();
    const form = mount({
      schema: [{ name: 'a' }],
      templates: { t: '{{boom a}}', ok: '{{a}}' },
      helpers: {
        boom: () => {
          throw new Error('kaboom');
        },
      },
      onError,
    });
    const panel = form.element.querySelector('[data-template="t"] .sf-template-error');
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain('kaboom');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ template: 't' }));
    expect(form.element.querySelector('[data-template="ok"] .sf-copy').disabled).toBe(false);
  });
});

describe('non-live mode (Generate button)', () => {
  it('hides outputs until Generate and focuses the first invalid field', async () => {
    const form = mount({ ...airport, livePreview: false });
    const outputs = form.element.querySelector('.sf-outputs');
    expect(outputs.hidden).toBe(true);
    type(control(form, 'airportCode'), '');
    form.element.querySelector('.sf-generate').click();
    expect(outputs.hidden).toBe(true);
    expect(document.activeElement).toBe(control(form, 'airportCode'));
    expect(field(form, 'airportCode').querySelector('.sf-error').textContent).toBe('Airport code is required');

    type(control(form, 'airportCode'), 'LHR');
    form.element.querySelector('.sf-generate').click();
    expect(outputs.hidden).toBe(false);
    expect(outputText(form, 'update')).toContain("'LHR'");
  });

  it('reset restores defaults and hides outputs again', () => {
    const form = mount({ ...airport, livePreview: false });
    type(control(form, 'airportName'), 'X');
    form.generate();
    form.element.querySelector('.sf-reset').click();
    expect(control(form, 'airportName').value).toBe('');
    expect(control(form, 'airportCode').value).toBe('CDG');
    expect(form.element.querySelector('.sf-outputs').hidden).toBe(true);
  });
});

describe('custom highlighter and engine', () => {
  it('uses the highlight hook and falls back to escaping', () => {
    const form = mount({ schema: [{ name: 'a' }], templates: { t: { source: '<{{a}}>', language: 'x' } }, highlight: (code) => `<em>${code.length}</em>` });
    expect(form.element.querySelector('.sf-output code em').textContent).toBe('2');
    const plain = mount({ schema: [{ name: 'a' }], templates: { t: '<x>' }, highlight: false }, { id: 'p' });
    expect(plain.element.querySelector('.sf-output code').innerHTML).toBe('&lt;x&gt;');
  });

  it('flushes async work without errors', async () => {
    mount(airport);
    await flush();
  });
});

describe('select DOM values', () => {
  it('uses real option values in the DOM and returns typed values', () => {
    const form = mount({ schema: [{ name: 'n', options: [{ text: 'One', value: 1 }, { text: 'Two', value: 2 }] }], templates: { t: '{{json n}}' } });
    const select = control(form, 'n');
    expect([...select.options].map((o) => o.value)).toEqual(['', '1', '2']);
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    expect(form.getValues().n).toBe(2);
    expect(outputText(form, 't')).toBe('2');
  });
});

describe('plain output mode (issue #2)', () => {
  const plain = {
    schema: [{ name: 'name', required: true }, { name: 'note' }],
    templates: {
      email: { source: "Hello {{name}},\nSELECT 'not code';\n{{note}}", mode: 'plain', language: 'sql' },
    },
  };

  it('renders regular text: no code block, no highlighting, never parsed as HTML', () => {
    const form = mount(plain);
    type(control(form, 'name'), "O'Brien");
    type(control(form, 'note'), '<b>bold?</b>');
    const panel = form.element.querySelector('[data-template="email"]');
    const body = panel.querySelector('.sf-plain');
    expect(panel.querySelector('pre, code')).toBeNull();
    expect(body.querySelector('[class^="sf-tok-"], b')).toBeNull();
    expect(body.textContent).toBe("Hello O'Brien,\nSELECT 'not code';\n<b>bold?</b>");
    expect(form.getOutputs().email).toBe(body.textContent);
  });

  it('still marks missing required values', () => {
    const form = mount(plain);
    expect(form.element.querySelector('.sf-plain mark.sf-missing').textContent).toBe('name');
  });

  it('is accepted by the config validator alongside text and html', () => {
    document.body.innerHTML = '<div id="x"></div>';
    expect(() => new SimpleForm({ element: '#x', schema: [{ name: 'a' }], templates: { t: { source: 'x', mode: 'pdf' } } })).toThrow(
      /mode must be "text", "plain" or "html"/,
    );
  });

  it('can be declared in markup with data-mode="plain"', () => {
    document.body.innerHTML = '<div id="d"><script type="text/templates" name="Mail" data-mode="plain">Hi {{a}}</script></div>';
    const form = SimpleForm.create({ element: '#d', schema: [{ name: 'a', defaultValue: 'Ada' }] });
    expect(form.element.querySelector('.sf-plain').textContent).toBe('Hi Ada');
  });
});

import { readTemplatesFromDOM } from './dom-templates.js';
import { SimpleFormError } from './errors.js';
import { SimpleForm } from './simpleform.js';

/**
 * SimpleFormJs 1.x compatibility layer.
 *
 *   new ScriptGenerator(formSchema, generatorId)
 *
 * - `fieldName` → `name`, `values` → autocomplete `options`, `defaultValue` now works
 * - `generatorId` is really optional: without it the form is appended to <body>
 * - templates are read from <script type="text/templates" name="…"> and rendered as HTML (1.x behaviour)
 * - "Execute" flow: outputs appear after clicking Generate
 * - jQuery is no longer required
 */
export class ScriptGenerator {
  constructor(formSchema, generatorId, options = {}) {
    const doc = options.document ?? globalThis.document;
    const element = generatorId ? doc.getElementById(generatorId) : doc.body;
    if (!element) throw new SimpleFormError(`ScriptGenerator: no element with id "${generatorId}".`);
    if (!Array.isArray(formSchema)) throw new SimpleFormError('ScriptGenerator: formSchema must be an array.');

    const schema = formSchema.map((f) => ({
      name: f.fieldName ?? f.name,
      label: f.label ?? f.fieldName ?? f.name,
      placeholder: f.placeholder,
      defaultValue: f.defaultValue,
      ...(f.values ? { type: 'autocomplete', options: f.values } : { type: f.type ?? 'text' }),
    }));

    this.form = new SimpleForm({
      livePreview: false,
      ...options,
      element,
      schema,
      templates: readTemplatesFromDOM(element, { defaultMode: 'html' }),
    }).render();
  }

  execute() {
    return this.form.generate();
  }

  resetForm() {
    return this.form.reset();
  }

  getValues() {
    return this.form.getValues();
  }
}

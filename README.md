SimpleFormJs
============

**Declare the data once, collect it with a generated form, produce scripts, configurations and documents with templates.**

SimpleFormJs turns a small schema into an accessible form and feeds the values to one or more
[Handlebars](https://handlebarsjs.com/) templates — SQL scripts and their rollback, YAML/JSON configs, shell commands,
HTML snippets… It is designed for runbooks, wiki/Confluence pages and internal tools where the person filling in the form
should never touch the template.

- Vanilla JavaScript, **no jQuery**. Handlebars is the only dependency (and can be swapped).
- Live preview with highlighted missing values, **Copy** and **Download** per output.
- Declarative validation, conditional and dependent fields, autocomplete with async suggestions.
- Escaping helpers (`{{sql}}`, `{{quote}}`, `{{json}}` …) and built-in syntax highlighting.
- Presets, shareable links (`persist: 'url'`), `localStorage` persistence.
- Batch mode with CSV import, custom field plugins, hooks and DOM events.
- No-code mode: a form from markup only. JSON schemas you can load and export.
- 1.x pages keep working through the `ScriptGenerator` adapter.

👉 **Guided tour with live demos:** [`showcases/example/`](showcases/example/index.html) (`npm run serve`, then open
<http://localhost:4173/showcases/example/>).

Contents: [Install](#install) · [Quick start](#quick-start) · [Fields](#fields) · [Templates](#templates) ·
[Options](#options) · [API](#api) · [No-code mode](#no-code-mode) · [Plugins](#custom-field-types) ·
[Migrating from 1.x](#migrating-from-1x) · [Development](#development)

Install
-------

**Script tags** (exposes `window.SimpleForm` and `window.ScriptGenerator`):

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/bobpuley/SimpleFormJs@2/dist/simpleform.css">
<script src="https://cdn.jsdelivr.net/npm/handlebars@4.7.8/dist/handlebars.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/bobpuley/SimpleFormJs@2/dist/simpleform.umd.min.js"></script>
```

Handlebars is looked up when a form is created, not when the library loads, so the order of the two scripts does not
matter as long as both are on the page before you create a form.

**npm / bundlers** (once published to npm; until then `npm install github:bobpuley/SimpleFormJs`):

```bash
npm install simpleformjs handlebars
```

```js
import Handlebars from 'handlebars';
import { SimpleForm } from 'simpleformjs';
import 'simpleformjs/simpleform.css';

SimpleForm.create({ element: '#app', handlebars: Handlebars, schema, templates });
```

Quick start
-----------

```html
<div id="airport"></div>
<script>
  SimpleForm.create({
    element: '#airport',
    schema: [
      { name: 'airportCode', label: 'Airport code', defaultValue: 'CDG', required: true, pattern: '^[A-Z]{3}$' },
      { name: 'airportName', label: 'Airport name', required: true },
      { name: 'previousName', label: 'Previous name' }
    ],
    templates: {
      update:   { title: 'Update', language: 'sql', filename: 'update-{{airportCode}}.sql',
                  source: 'UPDATE airport SET name = {{sql airportName}} WHERE code = {{sql airportCode}};' },
      rollback: { title: 'Rollback', language: 'sql',
                  source: 'UPDATE airport SET name = {{sql previousName}} WHERE code = {{sql airportCode}};' }
    }
  });
</script>
```

`SimpleForm.create(config)` is a shorthand for `new SimpleForm(config).render()`.

While required fields are empty the preview shows them as highlighted placeholders and Copy/Download are disabled.

Fields
------

| Property | Description |
| --- | --- |
| `name` | **Required.** Variable name used in templates (letters, digits, `_`, `$`). `rows`, `count`, `index`, `isFirst`, `isLast` are reserved. |
| `type` | `text` (default), `number`, `date`, `textarea`, `checkbox`, `select`, `autocomplete`, `email`, `url`, or a [custom type](#custom-field-types). Fields with `options` default to `select`. |
| `label` | Text shown to the user (defaults to `name`). |
| `placeholder`, `help` | Placeholder and help text below the control. |
| `defaultValue` | Initial value (also restored by Reset). |
| `required`, `min`, `max`, `minLength`, `maxLength`, `pattern` | Validation shortcuts (same as inside `validation`). |
| `validation` | `{ required, min, max, minLength, maxLength, pattern, custom, message, messages }`. `custom(value, allValues)` returns `true`, `false` or an error message. `message` overrides every rule message except `required`; `messages.<rule>` overrides one rule. |
| `options` | For `select`/`autocomplete`: an array (`'IT'` or `{ text, value }`), a function `({ values, query, signal }) => list \| Promise<list>`, or an object keyed by the value of the single `dependsOn` field. Templates receive `value`; users see `text`. |
| `optionsUrl` | URL returning a JSON array. `{field}` and `{query}` placeholders are replaced (and URL-encoded). No request is made while a referenced field is empty. |
| `dependsOn` | Field name(s): when they change, options are reloaded. |
| `visibleWhen` | `{ field, equals }`, `{ field, notEquals }`, `{ field, in: [] }`, `{ field, notIn: [] }`, `{ field, empty }`, `{ field }` (truthy), a function `(values) => boolean`, or an array of rules (all must match). Hidden fields are not validated and are not passed to templates. |
| `allowCustom` | `autocomplete` only: accept text that matches no option. |
| `debounce` | `autocomplete` only: delay before calling async options (ms, default 200). |
| `step`, `rows`, `attrs` | `number` step, `textarea` rows, extra HTML attributes for the control. |

Templates
---------

```js
templates: {
  key: 'source',                         // shorthand
  other: {
    source: '…',                         // Handlebars template
    title: 'Shown above the output',
    mode: 'text',                        // 'text' (default, shown as code) or 'html' (rendered)
    language: 'sql',                     // highlighting: sql, json, yaml, shell
    filename: '{{code}}.sql',            // download name, itself a template
    perRow: false,                       // batch mode: render once per row…
    separator: '\n'                      // …joined with this separator
  }
}
```

Templates can also be written in the page, inside the form container (indentation is removed automatically):

```html
<script type="text/templates" name="Update" data-language="sql" data-filename="{{code}}.sql">
  UPDATE airport SET name = {{sql name}} WHERE code = {{sql code}};
</script>
```

Supported attributes: `name`, `data-title`, `data-mode`, `data-language`, `data-filename`, `data-per-row`, `data-separator`.

**Escaping.** In `text` mode output is displayed with `textContent`, so nothing is interpreted as HTML and values are
inserted verbatim (`O'Brien` stays `O'Brien`). Use the helper that matches your target format. In `html` mode the template
markup is rendered while values are HTML-escaped by Handlebars.

**Context.** Every template receives the field values plus `rows` (all rows), `count`, `index` (1-based), `isFirst`,
`isLast`.

### Helpers

| Helper | Example | Result |
| --- | --- | --- |
| `sql` | `{{sql name}}` | `'O''Brien'`, `42`, `TRUE`, `NULL` when empty |
| `quote` | `{{quote name}}` / `{{quote name "'"}}` | `"say \"hi\""` |
| `json` | `{{json value}}` | JSON literal |
| `upper` / `lower` / `trim` | `{{upper code}}` | |
| `default` | `{{default owner "ops"}}` | fallback for empty values |
| `now` | `{{now}}` / `{{now "date"}}` / `{{now "time"}}` / `{{now "datetime"}}` | |
| `eq` `ne` `and` `or` `not` | `{{#if (eq country "IT")}}…{{/if}}` | |
| `join` | `{{join list ", "}}` | |

Add your own: `SimpleForm.registerHelper('slug', fn)` (global) or `helpers: { slug: fn }` (one form).

Options
-------

| Option | Default | Description |
| --- | --- | --- |
| `element` | — | **Required.** Selector or element that will contain the form. |
| `schema` | — | **Required.** Array of fields. |
| `templates` | from the DOM | Templates (see above). |
| `title`, `description` | | Shown above the form. |
| `livePreview` | `true` | `false` shows a **Generate** button; outputs appear after a successful validation. |
| `presets` | | `{ name: { field: value } }` — adds a preset selector. |
| `persist` | `false` | `'url'` (query string + *Copy share link* button) or `'local'` (`localStorage`). |
| `persistKey` | `sf.<element id>` | Storage key / query parameter. Required when the element has no id. |
| `batch` | `false` | `true` or `{ min: 1, max: Infinity, csv: true, initialRows: 1 }`. |
| `highlight` | `true` | `false`, or `(code, language) => html` to plug Prism/highlight.js (must return escaped HTML). |
| `helpers` | `{}` | Extra Handlebars helpers. |
| `messages` | English | Any UI/validation message, e.g. `{ required: '{label} è obbligatorio', copy: 'Copia' }`. See `SimpleForm.messages`. |
| `handlebars` | `window.Handlebars` | Handlebars instance to use. |
| `engine` | | Replace Handlebars: `{ compile(source, { mode }) => (context) => string }`. |
| `fetch` | `window.fetch` | Used by `optionsUrl`. |
| `onChange`, `onRender`, `onInvalid`, `onCopy`, `onError` | | Hooks, see [Events](#events). |

API
---

```js
const form = new SimpleForm(config);   // validates the config, compiles templates
form.render();                         // builds the DOM (returns form)

form.getValues();                      // { … } or [{ … }] in batch mode (visible fields only)
form.setValues(values);                // object, or array of rows in batch mode
form.validate();                       // { valid, errors } and shows every error
form.generate();                       // validate + render outputs (the Generate button)
form.getOutputs();                     // { key: text } or null while invalid
await form.copy('key');                // copy one output → boolean
form.download('key');                  // download one output → file name
form.applyPreset('prod');
form.addRow(values); form.removeRow(index);
form.importCSV(text, { append });      // → number of imported rows
form.getShareUrl();                    // persist: 'url' only
form.exportSchema();                   // { config, warnings } — JSON-serializable
form.reset();
form.on('render', fn);                 // → unsubscribe function
form.destroy();

SimpleForm.registerField(type, definition);
SimpleForm.registerHelper(name, fn);
await SimpleForm.loadSchema(url);      // → config object
await SimpleForm.fromElement(element); // no-code mode for one element
await SimpleForm.autoInit(root);       // no-code mode for every [data-simpleform]
SimpleForm.parseCSV(text);  SimpleForm.highlight(code, language);  SimpleForm.fieldTypes();
```

Configuration problems throw a `SimpleFormError` whose `problems` array lists **every** issue found (unknown types,
invalid names, broken regexes, references to missing fields, template syntax errors…).

### Events

| Event | Payload | When |
| --- | --- | --- |
| `change` | `{ values, errors, valid }` | values changed (not fired for the initial state) |
| `render` | `{ outputs, values }` | outputs changed and the form is valid |
| `invalid` | `{ errors }` | the set of errors changed |
| `copy` | `{ template, text }` | an output was copied |
| `error` | `{ error, template?, field?, hook? }` | template runtime error, failed option loading, failing hook |

Listen with the `on<Event>` options, `form.on(event, fn)`, or DOM events `simpleform:<event>` that bubble from the
container (`event.detail` holds the payload).

No-code mode
------------

The browser bundle initializes every `[data-simpleform]` element on `DOMContentLoaded` (add `data-simpleform-manual` to
`<html>` to disable it):

```html
<div data-simpleform>
  <script type="application/json" class="sf-schema">
    { "schema": [{ "name": "user", "required": true }, { "name": "role", "options": ["reader", "admin"] }] }
  </script>
  <script type="text/templates" name="Grant" data-language="sql">
    GRANT {{upper role}} TO {{sql user}};
  </script>
</div>

<!-- or keep the whole configuration in a file -->
<div data-simpleform data-schema-src="forms/airport.json"></div>
```

`data-live-preview="false"` and `data-persist="url|local"` are also supported.

Custom field types
------------------

```js
SimpleForm.registerField('coordinates', {
  render(ctx) { /* return an element; put ctx.id on the focusable control; call ctx.emit() on change */ },
  getValue(element, ctx) { /* → value */ },
  setValue(element, value, ctx) { },
  validate(value, ctx) { /* optional: → error message or null (runs before declarative rules) */ },
  update(element, ctx) { /* optional: a dependsOn field changed */ },
  emptyValue: ''        // optional: value used on reset
});
```

`ctx` provides `field`, `id`, `doc`, `messages`, `emit()`, `values()`, `format(message)` and `loadOptions(query)`.

Theming
-------

Every color and size is a CSS variable on `.sf-root` (`--sf-accent`, `--sf-border`, `--sf-code-bg`, `--sf-label-width`,
`--sf-missing-bg`, …). Override them in your stylesheet.

Migrating from 1.x
------------------

1.x pages keep working with the 2.0 bundle:

```js
new ScriptGenerator(formSchema, 'generatorId'); // unchanged
```

- jQuery is no longer needed — you can remove it if nothing else uses it.
- `fieldName` → `name` and `values` → autocomplete `options` are mapped automatically; `defaultValue` now works.
- `generatorId` is really optional (the form is appended to `<body>`).
- Templates are still read from `<script type="text/templates">` and rendered as HTML, as in 1.x. Outputs appear after
  **Generate** (the old *Execute*).
- The files moved: use `dist/simpleform.umd.min.js` and `dist/simpleform.css` instead of the root `simpleform.js` /
  `simpleform.css`.

For new code prefer `SimpleForm`: live preview, copy/download and text-mode templates.

Development
-----------

```bash
npm install
npm run build          # dist/ (ESM, UMD, minified, CSS)
npm test               # unit + functional tests (Vitest + jsdom)
npm run test:e2e       # builds, then runs the showcase in Chromium (Playwright)
npm run serve          # http://localhost:4173/showcases/example/
```

The first e2e run may need `npx playwright install chromium`.

Source layout: `src/simpleform.js` (coordinator), `row.js` (fields of one row), `fields/` (built-in types and registry),
`template-engine.js`, `helpers.js`, `highlight.js`, `output-view.js`, `schema.js`, `validation.js`, `conditions.js`,
`options.js`, `persistence.js`, `csv.js`, `declarative.js`, `legacy.js`.

License
-------

MIT — see [LICENSE](LICENSE).

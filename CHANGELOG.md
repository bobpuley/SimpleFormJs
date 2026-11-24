# Changelog

## 2.0.0

Complete rewrite in vanilla JavaScript.

### Breaking
- jQuery is no longer used. The bundle lives in `dist/` (`simpleform.umd(.min).js`, `simpleform.esm(.min).js`,
  `simpleform.css`); the root `simpleform.js`, `simpleform.css` and `example.html` were removed (the guided tour in
  `showcases/example/` replaces the example).
- `ScriptGenerator` is now a compatibility adapter on top of `SimpleForm`. Its markup and CSS classes changed.

### Fixed (1.x issues)
- `generatorId` was documented as optional but crashed without it.
- `defaultValue` was ignored.
- Autocomplete only reacted to A–Z keys: digits, accents, backspace and paste left a stale hidden value; options were
  invisible and unmatched text was silently discarded.
- Field names were used as CSS classes/selectors and could clash with internal classes or break on special characters.
- `<label for>` pointed to a `name`, not an `id`.
- The jQuery presence check could never run; Handlebars was not checked at all.
- Dead code (`getTemplate`, `loadAndCompileTemplate`) and an ignored parameter in `createScriptsDisplay`.
- Generated scripts had no escaping helpers (`O'Brien` broke SQL).

### Added
- `SimpleForm` API: live preview with missing-value markers, Copy/Download per output, templated file names.
- Field types: number, date, textarea, checkbox, select, autocomplete (accessible combobox, async options), email, url;
  `label`, `help`, `placeholder`, `defaultValue`.
- Declarative validation (required, min/max, length, pattern, custom) with translatable messages.
- `visibleWhen` conditions and `dependsOn` option reloading (maps, functions, `optionsUrl`).
- Helpers: `sql`, `quote`, `json`, `upper`, `lower`, `trim`, `default`, `now`, `eq`, `ne`, `and`, `or`, `not`, `join`;
  `registerHelper`.
- Template modes `text` (code block), `plain` (regular text) and `html` (#2); built-in highlighting (SQL, JSON, YAML,
  shell) or a custom highlighter.
- Card layout separating forms, responsive layout, focus rings and new button styles (#3).
- Presets, URL persistence with share links, `localStorage` persistence.
- Batch mode with per-row templates and CSV import.
- Hooks (`onChange`, `onRender`, `onInvalid`, `onCopy`, `onError`), `form.on()`, `simpleform:*` DOM events.
- Custom field types via `registerField`.
- No-code mode (`data-simpleform`), `loadSchema`, `exportSchema`.
- Configuration validation listing every problem; template syntax errors reported at creation.
- Unit, functional (Vitest + jsdom) and end-to-end (Playwright) tests; guided tour in `showcases/example/`.

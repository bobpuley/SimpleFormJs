/*! SimpleFormJs v2.0.0 | MIT License | https://github.com/bobpuley/SimpleFormJs */
var SimpleFormJs = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/umd.js
  var umd_exports = {};
  __export(umd_exports, {
    DEFAULT_MESSAGES: () => DEFAULT_MESSAGES,
    ScriptGenerator: () => ScriptGenerator,
    SimpleForm: () => SimpleForm,
    SimpleFormError: () => SimpleFormError,
    autoInit: () => autoInit,
    default: () => umd_default,
    fieldTypes: () => fieldTypes,
    fromElement: () => fromElement,
    highlight: () => highlight,
    loadSchema: () => loadSchema,
    parseCSV: () => parseCSV,
    registerField: () => registerField,
    registerHelper: () => registerHelper,
    version: () => version
  });

  // src/index.js
  var index_exports = {};
  __export(index_exports, {
    DEFAULT_MESSAGES: () => DEFAULT_MESSAGES,
    ScriptGenerator: () => ScriptGenerator,
    SimpleForm: () => SimpleForm,
    SimpleFormError: () => SimpleFormError,
    autoInit: () => autoInit,
    default: () => index_default,
    fieldTypes: () => fieldTypes,
    fromElement: () => fromElement,
    highlight: () => highlight,
    loadSchema: () => loadSchema,
    parseCSV: () => parseCSV,
    registerField: () => registerField,
    registerHelper: () => registerHelper,
    version: () => version
  });

  // src/errors.js
  var SimpleFormError = class extends Error {
    constructor(message, problems = []) {
      super(problems.length ? `${message}
 - ${problems.join("\n - ")}` : message);
      this.name = "SimpleFormError";
      this.problems = problems;
    }
  };

  // src/utils.js
  var uid = 0;
  var nextId = (prefix = "sf") => `${prefix}-${++uid}`;
  var isPlainObject = (v) => v !== null && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype;
  var isEmpty = (v) => v === void 0 || v === null || v === "" || Array.isArray(v) && v.length === 0;
  var format = (message, data = {}) => String(message).replace(/\{(\w+)\}/g, (m, key) => key in data ? String(data[key]) : m);
  function debounce(fn, ms) {
    let timer;
    const debounced = (...args2) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args2), ms);
    };
    debounced.cancel = () => clearTimeout(timer);
    return debounced;
  }
  var HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  var escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
  function h(doc, tag, attrs = {}, ...children) {
    const el = doc.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === void 0 || value === null || value === false) continue;
      if (key === "class") el.className = value;
      else if (key === "text") el.textContent = value;
      else if (key === "dataset") Object.assign(el.dataset, value);
      else if (key.startsWith("on") && typeof value === "function") {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value === true) el.setAttribute(key, "");
      else el.setAttribute(key, String(value));
    }
    for (const child of children.flat()) {
      if (child === null || child === void 0 || child === false) continue;
      el.append(typeof child === "string" ? doc.createTextNode(child) : child);
    }
    return el;
  }
  function resolveElement(target, doc = globalThis.document) {
    if (!target) throw new SimpleFormError('SimpleForm: the "element" option is required.');
    if (typeof target === "string") {
      if (!doc) throw new SimpleFormError('SimpleForm: no document available to resolve "' + target + '".');
      const el = doc.querySelector(target);
      if (!el) throw new SimpleFormError(`SimpleForm: no element matches "${target}".`);
      return el;
    }
    if (target && target.nodeType === 1) return target;
    throw new SimpleFormError('SimpleForm: "element" must be a CSS selector or an HTMLElement.');
  }
  function normalizeOptions(list) {
    if (!Array.isArray(list)) return [];
    return list.map((item) => {
      if (item !== null && typeof item === "object") {
        const text = item.text ?? item.label ?? item.value;
        const value = "value" in item ? item.value : text;
        return { text: String(text ?? ""), value };
      }
      return { text: String(item ?? ""), value: item };
    });
  }
  var sameValue = (a, b) => a === b || String(a) === String(b);

  // src/fields/registry.js
  var registry = /* @__PURE__ */ new Map();
  function registerField(type, definition) {
    if (typeof type !== "string" || !type) throw new SimpleFormError("registerField: type must be a non-empty string.");
    const missing = ["render", "getValue", "setValue"].filter((m) => typeof definition?.[m] !== "function");
    if (missing.length) {
      throw new SimpleFormError(`registerField("${type}"): missing method(s) ${missing.join(", ")}.`);
    }
    registry.set(type, definition);
  }
  var getFieldType = (type) => registry.get(type);
  var hasFieldType = (type) => registry.has(type);
  var fieldTypes = () => [...registry.keys()];

  // src/options.js
  function createOptionsLoader(field, { fetchImpl } = {}) {
    const { options, optionsUrl } = field;
    if (Array.isArray(options)) {
      const list = normalizeOptions(options);
      return Object.assign(() => list, { isStatic: true, list });
    }
    if (typeof options === "function") {
      return (ctx) => {
        const result = options(ctx);
        return isThenable(result) ? result.then(normalizeOptions) : normalizeOptions(result);
      };
    }
    if (isPlainObject(options)) {
      const [dep] = field.dependsOn;
      return (ctx) => normalizeOptions(options[ctx.values[dep]] ?? []);
    }
    if (typeof optionsUrl === "string") {
      const keys = [...optionsUrl.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((k) => k !== "query");
      return async ({ values, query, signal }) => {
        if (keys.some((k) => isEmpty(values[k]))) return [];
        const url = optionsUrl.replace(
          /\{(\w+)\}/g,
          (m, key) => encodeURIComponent(key === "query" ? query ?? "" : values[key] ?? "")
        );
        const doFetch = fetchImpl || globalThis.fetch;
        const res = await doFetch(url, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status} while loading ${url}`);
        return normalizeOptions(await res.json());
      };
    }
    return null;
  }
  function filterOptions(list, query) {
    const q = String(query ?? "").trim().toLowerCase();
    if (!q) return list.slice();
    const starts = [];
    const contains = [];
    for (const opt of list) {
      const text = opt.text.toLowerCase();
      if (text.startsWith(q)) starts.push(opt);
      else if (text.includes(q)) contains.push(opt);
    }
    return starts.concat(contains);
  }
  var isThenable = (v) => Boolean(v) && typeof v.then === "function";

  // src/fields/autocomplete.js
  var states = /* @__PURE__ */ new WeakMap();
  var MAX_VISIBLE = 50;
  var autocomplete = {
    render(ctx) {
      const { doc, field } = ctx;
      const listId = nextId("sf-listbox");
      const input = h(doc, "input", {
        type: "text",
        id: ctx.id,
        name: field.name,
        class: "sf-input sf-combobox-input",
        placeholder: field.placeholder,
        role: "combobox",
        autocomplete: "off",
        "aria-autocomplete": "list",
        "aria-expanded": "false",
        "aria-controls": listId,
        "aria-required": field.validation.required ? "true" : void 0,
        ...field.attrs
      });
      const list = h(doc, "ul", { id: listId, role: "listbox", class: "sf-listbox", hidden: true });
      const status = h(doc, "div", { class: "sf-combobox-status", "aria-live": "polite" });
      const root = h(doc, "div", { class: "sf-combobox" }, input, list, status);
      const state = {
        ctx,
        input,
        list,
        status,
        options: ctx.options?.isStatic ? ctx.options.list : [],
        filtered: [],
        active: -1,
        selected: null,
        seq: 0,
        controller: null
      };
      states.set(root, state);
      const remoteSearch = debounce((query) => search(state, query), field.debounce ?? 200);
      input.addEventListener("input", () => {
        state.selected = matchExact(state.options, input.value);
        if (ctx.options?.isStatic) search(state, input.value);
        else remoteSearch(input.value);
        ctx.emit();
      });
      input.addEventListener("keydown", (event) => onKeyDown(state, event));
      input.addEventListener("focus", () => {
        if (ctx.options?.isStatic && !input.value) search(state, "");
      });
      input.addEventListener("blur", () => {
        setTimeout(() => close(state), 120);
        if (!state.selected) state.selected = matchExact(state.options, input.value);
        ctx.emit({ touched: true });
      });
      list.addEventListener("mousedown", (event) => event.preventDefault());
      list.addEventListener("click", (event) => {
        const li = event.target.closest('[role="option"]');
        if (li) choose(state, state.filtered[Number(li.dataset.index)]);
      });
      return root;
    },
    getValue(root, ctx) {
      const state = states.get(root);
      if (state.selected) return state.selected.value;
      return ctx.field.allowCustom ? state.input.value : "";
    },
    setValue(root, value, ctx) {
      const state = states.get(root);
      if (value === void 0 || value === null || value === "") {
        state.selected = null;
        state.input.value = "";
        return;
      }
      const match = state.options.find((opt) => sameValue(opt.value, value)) || matchExact(state.options, String(value));
      if (match) {
        state.selected = match;
        state.input.value = match.text;
      } else if (ctx.field.allowCustom || !ctx.options?.isStatic) {
        state.selected = ctx.field.allowCustom ? null : { text: String(value), value };
        state.input.value = String(value);
      } else {
        state.selected = null;
        state.input.value = String(value);
      }
    },
    validate(value, ctx) {
      const state = states.get(ctx.element);
      if (!ctx.field.allowCustom && state.input.value && !state.selected) {
        return ctx.format(ctx.messages.notInList);
      }
      return null;
    },
    update(root, ctx) {
      const state = states.get(root);
      if (ctx.options?.isStatic) return;
      state.options = [];
      if (state.selected) {
        state.selected = null;
        state.input.value = "";
      }
    }
  };
  var matchExact = (options, text) => {
    const t = String(text ?? "").trim().toLowerCase();
    return t ? options.find((opt) => opt.text.toLowerCase() === t) || null : null;
  };
  async function search(state, query) {
    const { ctx } = state;
    const seq = ++state.seq;
    if (ctx.options?.isStatic) {
      state.filtered = filterOptions(state.options, query).slice(0, MAX_VISIBLE);
      renderList(state);
      return;
    }
    state.controller?.abort();
    state.controller = typeof AbortController === "function" ? new AbortController() : null;
    state.status.textContent = ctx.messages.loading;
    state.input.setAttribute("aria-busy", "true");
    try {
      const result = await ctx.loadOptions(query, state.controller?.signal);
      if (seq !== state.seq) return;
      state.options = result;
      state.filtered = filterOptions(result, query).slice(0, MAX_VISIBLE);
      if (!state.selected) state.selected = matchExact(result, state.input.value);
      renderList(state);
      ctx.emit();
    } catch (err) {
      if (seq !== state.seq || err?.name === "AbortError") return;
      state.filtered = [];
      renderList(state);
      ctx.reportError?.(err);
    } finally {
      if (seq === state.seq) state.input.removeAttribute("aria-busy");
    }
  }
  function renderList(state) {
    const { ctx, list, input } = state;
    state.active = -1;
    input.removeAttribute("aria-activedescendant");
    list.replaceChildren(
      ...state.filtered.map(
        (opt, i) => h(ctx.doc, "li", {
          id: `${list.id}-${i}`,
          role: "option",
          class: "sf-option",
          "aria-selected": "false",
          dataset: { index: String(i) },
          text: opt.text
        })
      )
    );
    const focused = ctx.doc.activeElement === input;
    const hasItems = state.filtered.length > 0;
    state.status.textContent = hasItems || !input.value ? "" : ctx.messages.noResults;
    if (hasItems && focused) open(state);
    else close(state);
  }
  function open(state) {
    state.list.hidden = false;
    state.input.setAttribute("aria-expanded", "true");
  }
  function close(state) {
    state.list.hidden = true;
    state.input.setAttribute("aria-expanded", "false");
    state.input.removeAttribute("aria-activedescendant");
    state.active = -1;
  }
  function setActive(state, index) {
    const items = state.list.children;
    if (!items.length) return;
    state.active = (index + items.length) % items.length;
    [...items].forEach((li2, i) => li2.setAttribute("aria-selected", String(i === state.active)));
    const li = items[state.active];
    state.input.setAttribute("aria-activedescendant", li.id);
    li.scrollIntoView?.({ block: "nearest" });
  }
  function choose(state, option) {
    if (!option) return;
    state.selected = option;
    state.input.value = option.text;
    close(state);
    state.ctx.emit();
  }
  function onKeyDown(state, event) {
    const isOpen = !state.list.hidden;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!isOpen) {
          if (state.filtered.length) open(state);
          else search(state, state.input.value);
        }
        setActive(state, state.active + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (isOpen) setActive(state, state.active - 1);
        break;
      case "Enter":
        if (isOpen && state.active >= 0) {
          event.preventDefault();
          choose(state, state.filtered[state.active]);
        }
        break;
      case "Escape":
        if (isOpen) {
          event.preventDefault();
          close(state);
        }
        break;
      case "Tab":
        if (isOpen && state.active >= 0) choose(state, state.filtered[state.active]);
        close(state);
        break;
      default:
    }
  }

  // src/fields/builtin.js
  var baseAttrs = (ctx) => ({
    id: ctx.id,
    name: ctx.field.name,
    placeholder: ctx.field.placeholder,
    "aria-required": ctx.field.validation.required ? "true" : void 0,
    ...ctx.field.attrs
  });
  var inputType = (type, extra = () => ({})) => ({
    render(ctx) {
      return h(ctx.doc, "input", {
        type,
        class: "sf-input",
        autocomplete: "off",
        ...baseAttrs(ctx),
        ...extra(ctx),
        onInput: () => ctx.emit(),
        onChange: () => ctx.emit()
      });
    },
    getValue: (el) => el.value,
    setValue: (el, value) => {
      el.value = value ?? "";
    }
  });
  registerField("text", inputType("text"));
  registerField("email", inputType("email"));
  registerField("url", inputType("url"));
  registerField("date", inputType("date", ({ field }) => ({ min: field.validation.min, max: field.validation.max })));
  registerField("number", {
    ...inputType("number", ({ field }) => ({
      min: field.validation.min,
      max: field.validation.max,
      step: field.step ?? "any",
      inputmode: "decimal"
    })),
    getValue: (el) => el.value === "" ? el.validity?.badInput ? NaN : "" : Number(el.value)
  });
  registerField("textarea", {
    render(ctx) {
      return h(ctx.doc, "textarea", {
        class: "sf-input sf-textarea",
        rows: ctx.field.rows ?? 3,
        ...baseAttrs(ctx),
        onInput: () => ctx.emit()
      });
    },
    getValue: (el) => el.value,
    setValue: (el, value) => {
      el.value = value ?? "";
    }
  });
  var TRUE_STRINGS = ["true", "1", "yes", "y", "x", "on", "si", "s\xEC"];
  var toBoolean = (v) => v === true || typeof v === "number" && v !== 0 || TRUE_STRINGS.includes(String(v ?? "").trim().toLowerCase());
  registerField("checkbox", {
    emptyValue: false,
    render(ctx) {
      const { placeholder, ...attrs } = baseAttrs(ctx);
      return h(ctx.doc, "input", { type: "checkbox", class: "sf-checkbox", ...attrs, onChange: () => ctx.emit() });
    },
    getValue: (el) => el.checked,
    setValue: (el, value) => {
      el.checked = toBoolean(value);
    }
  });
  var selectState = /* @__PURE__ */ new WeakMap();
  function fillSelect(el, ctx, list) {
    const state = selectState.get(el);
    const previous = state.pending !== void 0 ? state.pending : readSelect(el);
    state.list = list;
    el.replaceChildren(
      h(ctx.doc, "option", { value: "", text: ctx.field.placeholder || ctx.messages.selectPlaceholder }),
      ...list.map((opt) => h(ctx.doc, "option", { value: String(opt.value ?? ""), text: opt.text }))
    );
    const match = list.find((opt) => sameValue(opt.value, previous));
    el.value = match ? String(match.value) : "";
    state.pending = void 0;
  }
  function readSelect(el) {
    const state = selectState.get(el);
    if (state.pending !== void 0) return state.pending;
    if (el.value === "") return "";
    return state.list.find((opt) => String(opt.value) === el.value)?.value ?? el.value;
  }
  function loadSelect(el, ctx) {
    const state = selectState.get(el);
    const seq = ++state.seq;
    let result;
    try {
      result = ctx.loadOptions("");
    } catch (err) {
      result = Promise.reject(err);
    }
    if (!isThenable(result)) {
      fillSelect(el, ctx, result);
      return void 0;
    }
    state.loading = true;
    if (state.pending === void 0) state.pending = readSelect(el);
    el.disabled = true;
    el.setAttribute("aria-busy", "true");
    return result.then((list) => {
      if (seq === state.seq) fillSelect(el, ctx, list);
    }).catch((err) => {
      if (seq === state.seq) {
        fillSelect(el, ctx, []);
        ctx.reportError?.(err);
      }
    }).finally(() => {
      if (seq !== state.seq) return;
      state.loading = false;
      el.disabled = false;
      el.removeAttribute("aria-busy");
      ctx.emit();
    });
  }
  registerField("select", {
    render(ctx) {
      const { placeholder, ...attrs } = baseAttrs(ctx);
      const el = h(ctx.doc, "select", { class: "sf-input sf-select", ...attrs, onChange: () => ctx.emit() });
      selectState.set(el, { list: [], seq: 0, pending: void 0, loading: false });
      if (ctx.options?.isStatic) fillSelect(el, ctx, ctx.options.list);
      else loadSelect(el, ctx);
      return el;
    },
    update(el, ctx) {
      if (!ctx.options?.isStatic) return loadSelect(el, ctx);
      return void 0;
    },
    getValue: readSelect,
    setValue(el, value) {
      const state = selectState.get(el);
      if (state.loading) {
        state.pending = value;
        return;
      }
      const match = state.list.find((opt) => sameValue(opt.value, value ?? "")) || state.list.find((opt) => opt.text.toLowerCase() === String(value ?? "").toLowerCase());
      el.value = match ? String(match.value) : "";
    }
  });
  registerField("autocomplete", autocomplete);

  // src/csv.js
  function parseCSV(text, { delimiter } = {}) {
    const src = String(text ?? "").replace(/^﻿/, "");
    const sep = delimiter ?? detectDelimiter(src);
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (quoted) {
        if (c === '"') {
          if (src[i + 1] === '"') {
            cell += '"';
            i++;
          } else quoted = false;
        } else cell += c;
      } else if (c === '"' && cell === "") quoted = true;
      else if (c === sep) {
        row.push(cell);
        cell = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && src[i + 1] === "\n") i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else cell += c;
    }
    if (cell !== "" || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows.filter((r) => r.some((c) => c.trim() !== ""));
  }
  function detectDelimiter(src) {
    const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
    const counts = [",", ";", "	"].map((d) => [d, firstLine.split(d).length - 1]);
    counts.sort((a, b) => b[1] - a[1]);
    return counts[0][1] > 0 ? counts[0][0] : ",";
  }
  function csvToRecords(rows, fields) {
    if (!rows.length) return [];
    const lookup = /* @__PURE__ */ new Map();
    for (const f of fields) {
      lookup.set(f.name.toLowerCase(), f.name);
      lookup.set(String(f.label).toLowerCase(), f.name);
    }
    const header = rows[0].map((h2) => lookup.get(h2.trim().toLowerCase()));
    const hasHeader = header.some(Boolean);
    const columns = hasHeader ? header : fields.map((f) => f.name);
    const body = hasHeader ? rows.slice(1) : rows;
    return body.map((cells) => {
      const record = {};
      columns.forEach((name, i) => {
        if (name && i < cells.length) record[name] = cells[i].trim();
      });
      return record;
    });
  }

  // src/dom-templates.js
  function dedent(source) {
    const lines = String(source).replace(/\r\n?/g, "\n").split("\n");
    while (lines.length && lines[0].trim() === "") lines.shift();
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)[0].length);
    const min = indents.length ? Math.min(...indents) : 0;
    return lines.map((l) => l.slice(min)).join("\n");
  }
  var SELECTOR = 'script[type="text/templates"], script[type="text/x-simpleform"], template[data-sf-template]';
  function readTemplatesFromDOM(root, { defaultMode = "text" } = {}) {
    return [...root.querySelectorAll(SELECTOR)].filter((el) => !el.closest(".sf-root")).map((el, i) => {
      const d = el.dataset;
      const key = el.getAttribute("name") || d.sfTemplate || `template${i + 1}`;
      const raw = el.tagName === "TEMPLATE" ? el.innerHTML : el.textContent;
      const perRow = d.perRow !== void 0 && d.perRow !== "false";
      return {
        key,
        title: d.title ?? key,
        source: dedent(raw),
        mode: d.mode ?? defaultMode,
        language: d.language,
        filename: d.filename,
        perRow,
        separator: d.separator !== void 0 ? d.separator.replace(/\\n/g, "\n").replace(/\\t/g, "	") : "\n"
      };
    });
  }

  // src/highlight.js
  var LANGUAGES = {
    sql: {
      flags: "gi",
      tokens: [
        ["comment", /--[^\n]*|\/\*[\s\S]*?\*\//],
        ["string", /'(?:[^']|'')*'/],
        [
          "keyword",
          /\b(?:select|insert|into|values|update|set|delete|from|where|and|or|not|null|is|in|exists|create|table|alter|add|drop|begin|commit|rollback|transaction|join|left|right|inner|outer|on|as|order|by|group|having|limit|offset|returning|default|primary|key|references|if|true|false|case|when|then|else|end|distinct|union|all|merge|using|matched)\b/
        ],
        ["number", /\b\d+(?:\.\d+)?\b/]
      ]
    },
    json: {
      flags: "g",
      tokens: [
        ["key", /"(?:[^"\\\n]|\\.)*"(?=\s*:)/],
        ["string", /"(?:[^"\\\n]|\\.)*"/],
        ["keyword", /\b(?:true|false|null)\b/],
        ["number", /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/]
      ]
    },
    yaml: {
      flags: "gm",
      tokens: [
        ["comment", /#[^\n]*/],
        ["key", /^[ \t-]*[\w.-]+(?=[ \t]*:)/],
        ["string", /"(?:[^"\\\n]|\\.)*"|'(?:[^'\n]|'')*'/],
        ["keyword", /\b(?:true|false|null|yes|no|on|off)\b/],
        ["number", /\b\d+(?:\.\d+)?\b/]
      ]
    },
    shell: {
      flags: "g",
      tokens: [
        ["comment", /(?<![\w$])#[^\n]*/],
        ["string", /"(?:[^"\\]|\\.)*"|'[^']*'/],
        ["variable", /\$\{[^}\n]+\}|\$\w+/],
        ["keyword", /(?<![\w-])--?[A-Za-z][\w-]*/]
      ]
    }
  };
  LANGUAGES.bash = LANGUAGES.shell;
  LANGUAGES.sh = LANGUAGES.shell;
  LANGUAGES.yml = LANGUAGES.yaml;
  var compiled = /* @__PURE__ */ new Map();
  function getMatcher(language) {
    if (compiled.has(language)) return compiled.get(language);
    const def = LANGUAGES[language];
    if (!def) return null;
    const regex = new RegExp(def.tokens.map(([, re]) => `(${re.source})`).join("|"), def.flags);
    const matcher = { regex, names: def.tokens.map(([name]) => name) };
    compiled.set(language, matcher);
    return matcher;
  }
  function highlight(code, language) {
    const matcher = language && getMatcher(String(language).toLowerCase());
    if (!matcher) return escapeHtml(code);
    const { regex, names } = matcher;
    regex.lastIndex = 0;
    let out = "";
    let last = 0;
    let m;
    while (m = regex.exec(code)) {
      if (m[0] === "") {
        regex.lastIndex++;
        continue;
      }
      const groupIndex = m.slice(1).findIndex((g) => g !== void 0);
      out += escapeHtml(code.slice(last, m.index));
      out += `<span class="sf-tok-${names[groupIndex]}">${escapeHtml(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    return out + escapeHtml(code.slice(last));
  }

  // src/output-view.js
  var EXTENSIONS = { sql: "sql", json: "json", yaml: "yaml", yml: "yaml", shell: "sh", bash: "sh", sh: "sh" };
  var defaultFilename = (template) => `${template.key.replace(/\W+/g, "_")}.${template.mode === "html" ? "html" : EXTENSIONS[template.language] ?? "txt"}`;
  var safeFilename = (name) => String(name).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim() || "output.txt";
  var OutputView = class {
    constructor(form) {
      this.form = form;
      const { doc, config } = form;
      this.notice = h(doc, "p", { class: "sf-notice", role: "status", hidden: true, text: config.messages.incomplete });
      this.element = h(doc, "div", { class: "sf-outputs", "aria-live": "polite" }, this.notice);
      this.panels = /* @__PURE__ */ new Map();
      for (const template of config.templates) {
        const panel = this.createPanel(template);
        this.panels.set(template.key, panel);
        this.element.append(panel.element);
      }
    }
    createPanel(template) {
      const { doc, config } = this.form;
      const m = config.messages;
      const copy = h(doc, "button", {
        type: "button",
        class: "sf-button sf-copy",
        "aria-label": `${m.copy} ${template.title}`,
        text: m.copy,
        onClick: () => this.form.copy(template.key)
      });
      const download = h(doc, "button", {
        type: "button",
        class: "sf-button sf-button-ghost sf-download",
        "aria-label": `${m.download} ${template.title}`,
        text: m.download,
        onClick: () => this.form.download(template.key)
      });
      let body;
      let content;
      if (template.mode === "html") {
        body = content = h(doc, "div", { class: "sf-html" });
      } else if (template.mode === "plain") {
        body = content = h(doc, "div", { class: "sf-plain" });
      } else {
        body = h(doc, "code", { class: template.language ? `language-${template.language}` : void 0 });
        content = h(doc, "pre", { class: "sf-code" }, body);
      }
      const error = h(doc, "div", { class: "sf-template-error", role: "alert", hidden: true });
      const element = h(
        doc,
        "section",
        { class: "sf-output", dataset: { template: template.key } },
        h(doc, "header", { class: "sf-output-header" }, h(doc, "h3", { class: "sf-output-title", text: template.title }), h(doc, "div", { class: "sf-output-actions" }, copy, download)),
        error,
        content
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
          panel.body.innerHTML = "";
        } else {
          panel.error.hidden = true;
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
      if (!target || typeof target === "string") return;
      const original = target.dataset.label ?? target.textContent;
      target.dataset.label = original;
      target.textContent = text;
      target.classList.add("sf-flash");
      clearTimeout(target._sfTimer);
      target._sfTimer = setTimeout(() => {
        target.textContent = original;
        target.classList.remove("sf-flash");
      }, 1500);
    }
  };
  async function copyToClipboard(doc, text, html) {
    const nav = doc.defaultView?.navigator;
    try {
      if (html && nav?.clipboard?.write && typeof doc.defaultView.ClipboardItem === "function") {
        const { ClipboardItem, Blob } = doc.defaultView;
        await nav.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" })
          })
        ]);
        return true;
      }
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(text);
        return true;
      }
    } catch {
    }
    const area = h(doc, "textarea", { style: "position:fixed;top:-1000px;opacity:0", readonly: true });
    area.value = text;
    doc.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = doc.execCommand?.("copy") ?? false;
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
  function downloadFile(doc, filename, content, type) {
    const win = doc.defaultView;
    const blob = new win.Blob([content], { type });
    const url = win.URL.createObjectURL(blob);
    const a = h(doc, "a", { href: url, download: filename, hidden: true });
    doc.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => win.URL.revokeObjectURL(url), 0);
  }

  // src/persistence.js
  function createStore(mode, key, win = globalThis.window) {
    if (!mode || !win) return null;
    if (mode === "local") {
      return {
        load() {
          try {
            return JSON.parse(win.localStorage.getItem(key) ?? "null");
          } catch {
            return null;
          }
        },
        save(state) {
          try {
            win.localStorage.setItem(key, JSON.stringify(state));
          } catch {
          }
        },
        clear() {
          try {
            win.localStorage.removeItem(key);
          } catch {
          }
        },
        shareUrl: () => null
      };
    }
    if (mode === "url") {
      const urlWith = (state) => {
        const url = new URL(win.location.href);
        if (state === null) url.searchParams.delete(key);
        else url.searchParams.set(key, JSON.stringify(state));
        return url;
      };
      return {
        load() {
          try {
            const raw = new URL(win.location.href).searchParams.get(key);
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        },
        save(state) {
          try {
            win.history.replaceState(win.history.state, "", urlWith(state));
          } catch {
          }
        },
        clear() {
          try {
            win.history.replaceState(win.history.state, "", urlWith(null));
          } catch {
          }
        },
        shareUrl: (state) => urlWith(state).toString()
      };
    }
    return null;
  }

  // src/conditions.js
  function isVisible(field, values) {
    const rule = field.visibleWhen;
    if (!rule) return true;
    if (typeof rule === "function") return Boolean(rule(values));
    const rules = Array.isArray(rule) ? rule : [rule];
    return rules.every((r) => evaluate(r, values));
  }
  function evaluate(rule, values) {
    if (typeof rule === "function") return Boolean(rule(values));
    const v = values[rule.field];
    if ("equals" in rule) return sameValue(v ?? "", rule.equals);
    if ("notEquals" in rule) return !sameValue(v ?? "", rule.notEquals);
    if ("in" in rule) return rule.in.some((x) => sameValue(v ?? "", x));
    if ("notIn" in rule) return !rule.notIn.some((x) => sameValue(v ?? "", x));
    if ("empty" in rule) return rule.empty ? isEmpty(v) : !isEmpty(v);
    return !isEmpty(v) && v !== false;
  }
  function conditionFields(rule) {
    if (!rule || typeof rule === "function") return [];
    return (Array.isArray(rule) ? rule : [rule]).filter((r) => r && typeof r === "object").map((r) => r.field);
  }

  // src/validation.js
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function validateValue(field, value, values, messages) {
    const rules = field.validation || {};
    const custom = rules.messages || {};
    const msg = (key, extra = {}) => format(custom[key] ?? (key !== "required" ? rules.message : void 0) ?? messages[key], {
      label: field.label,
      ...rules,
      ...extra
    });
    const missing = isEmpty(value) || field.type === "checkbox" && value === false;
    if (missing) return rules.required ? msg("required") : null;
    if (field.type === "number" && (typeof value !== "number" || Number.isNaN(value))) return msg("number");
    if (field.type === "email" && !EMAIL_RE.test(String(value))) return msg("email");
    if (field.type === "url" && !isUrl(String(value))) return msg("url");
    const comparable = field.type === "number" ? Number(value) : value;
    if (rules.min !== void 0 && comparable < rules.min) return msg("min");
    if (rules.max !== void 0 && comparable > rules.max) return msg("max");
    const length = String(value).length;
    if (rules.minLength !== void 0 && length < rules.minLength) return msg("minLength");
    if (rules.maxLength !== void 0 && length > rules.maxLength) return msg("maxLength");
    if (rules.pattern !== void 0 && !toRegExp(rules.pattern).test(String(value))) return msg("pattern");
    if (typeof rules.custom === "function") {
      const result = rules.custom(value, values);
      if (typeof result === "string") return format(result, { label: field.label });
      if (result === false) return msg("invalid");
    }
    return null;
  }
  var toRegExp = (pattern) => pattern instanceof RegExp ? pattern : new RegExp(pattern);
  function isUrl(s) {
    try {
      return Boolean(new URL(s).protocol);
    } catch {
      return false;
    }
  }

  // src/row.js
  var Row = class {
    constructor(form, index) {
      this.form = form;
      this.index = index;
      this.fields = /* @__PURE__ */ new Map();
      this.touched = /* @__PURE__ */ new Set();
      const { doc, config } = form;
      this.element = h(doc, config.batch ? "fieldset" : "div", { class: "sf-row" });
      if (config.batch) {
        this.legend = h(doc, "legend", { class: "sf-row-title" });
        this.removeButton = h(doc, "button", {
          type: "button",
          class: "sf-button sf-button-ghost sf-row-remove",
          text: config.messages.removeRow,
          onClick: () => form.removeRow(this.index)
        });
        this.element.append(h(doc, "div", { class: "sf-row-header" }, this.legend, this.removeButton));
      }
      for (const field of config.schema) this.fields.set(field.name, this.createField(field));
      this.setIndex(index);
    }
    createField(field) {
      const { doc, config } = this.form;
      const def = getFieldType(field.type);
      const id = nextId(`sf-${field.name}`);
      const errorId = `${id}-error`;
      const helpId = field.help ? `${id}-help` : void 0;
      const options = createOptionsLoader(field, { fetchImpl: config.fetch });
      const ctx = {
        field,
        id,
        doc,
        messages: config.messages,
        options,
        element: null,
        emit: ({ touched } = {}) => {
          if (touched) this.touched.add(field.name);
          this.form.handleChange(this, field.name);
        },
        values: () => this.getValues(),
        format: (message, data) => format(message, { label: field.label, ...data }),
        loadOptions: (query, signal) => options ? options({ values: this.getValues(), query, signal }) : [],
        reportError: (err) => this.form.reportError(err, { field: field.name })
      };
      const control = def.render(ctx);
      ctx.element = control;
      const isCheckbox = field.type === "checkbox";
      const label = h(
        doc,
        "label",
        { class: "sf-label", for: id },
        field.label,
        field.validation.required ? h(doc, "span", { class: "sf-required", "aria-hidden": "true", text: " *" }) : null
      );
      const help = field.help ? h(doc, "div", { class: "sf-help", id: helpId, text: field.help }) : null;
      const error = h(doc, "div", { class: "sf-error", id: errorId, "aria-live": "polite" });
      const describedBy = [helpId, errorId].filter(Boolean).join(" ");
      const focusable = control.matches?.("input,select,textarea") ? control : control.querySelector?.(`[id="${id}"]`);
      focusable?.setAttribute("aria-describedby", describedBy);
      const wrapper = h(
        doc,
        "div",
        { class: `sf-field sf-field-${field.type}`, dataset: { field: field.name } },
        isCheckbox ? h(doc, "div", { class: "sf-checkbox-line" }, control, label) : [label, control],
        help,
        error
      );
      wrapper.addEventListener("focusout", () => {
        this.touched.add(field.name);
        this.form.handleChange(this, field.name, { silent: true });
      });
      this.element.append(wrapper);
      return { field, def, ctx, control, wrapper, error, focusable, visible: true };
    }
    setIndex(index) {
      this.index = index;
      if (this.legend) this.legend.textContent = format(this.form.config.messages.row, { n: index + 1 });
    }
    setRemovable(enabled) {
      if (this.removeButton) this.removeButton.disabled = !enabled;
    }
    /** Raw values of every field (hidden ones included). */
    getValues() {
      const values = {};
      for (const [name, f] of this.fields) values[name] = f.def.getValue(f.control, f.ctx);
      return values;
    }
    /** Values passed to templates and hooks: hidden fields are omitted. */
    getVisibleValues() {
      const all = this.getValues();
      const out = {};
      for (const [name, f] of this.fields) if (f.visible) out[name] = all[name];
      return out;
    }
    setValues(values = {}) {
      for (const [name, value] of Object.entries(values)) {
        const f = this.fields.get(name);
        if (f) f.def.setValue(f.control, value, f.ctx);
      }
    }
    defaults() {
      const out = {};
      for (const [name, f] of this.fields) {
        out[name] = f.field.defaultValue !== void 0 ? f.field.defaultValue : f.def.emptyValue ?? "";
      }
      return out;
    }
    reset() {
      this.touched.clear();
      this.setValues(this.defaults());
    }
    updateVisibility() {
      for (let pass = 0; pass < this.fields.size; pass++) {
        const values = this.getVisibleValuesSnapshot();
        let changed = false;
        for (const f of this.fields.values()) {
          const visible = isVisible(f.field, values);
          if (visible !== f.visible) {
            f.visible = visible;
            f.wrapper.hidden = !visible;
            changed = true;
          }
        }
        if (!changed) break;
      }
    }
    getVisibleValuesSnapshot() {
      const all = this.getValues();
      for (const [name, f] of this.fields) if (!f.visible) all[name] = void 0;
      return all;
    }
    /** Re-runs `update` for fields depending on `name` (cascading). */
    refreshDependents(name, seen = /* @__PURE__ */ new Set()) {
      for (const f of this.fields.values()) {
        if (!f.field.dependsOn.includes(name) || seen.has(f.field.name)) continue;
        seen.add(f.field.name);
        f.def.update?.(f.control, f.ctx);
        this.refreshDependents(f.field.name, seen);
      }
    }
    /** Returns { name: message } for visible fields; optionally paints the errors. */
    validate({ showAll = false } = {}) {
      const errors = {};
      const values = this.getVisibleValues();
      for (const [name, f] of this.fields) {
        let message = null;
        if (f.visible) {
          message = f.def.validate && f.def.validate(values[name], f.ctx) || validateValue(f.field, values[name], values, this.form.config.messages);
        }
        if (message) errors[name] = message;
        const show = Boolean(message) && (showAll || this.touched.has(name));
        f.error.textContent = show ? message : "";
        f.wrapper.classList.toggle("sf-invalid", show);
        f.focusable?.setAttribute("aria-invalid", show ? "true" : "false");
      }
      return errors;
    }
    touchAll() {
      for (const name of this.fields.keys()) this.touched.add(name);
    }
    focusFirstError(errors) {
      const first = [...this.fields.values()].find((f) => errors[f.field.name]);
      first?.focusable?.focus();
      return Boolean(first);
    }
    destroy() {
      this.element.remove();
    }
  };

  // src/messages.js
  var DEFAULT_MESSAGES = Object.freeze({
    required: "{label} is required",
    number: "{label} must be a number",
    min: "{label} must be greater than or equal to {min}",
    max: "{label} must be less than or equal to {max}",
    minLength: "{label} must be at least {minLength} characters long",
    maxLength: "{label} must be at most {maxLength} characters long",
    pattern: "{label} has an invalid format",
    email: "{label} must be a valid email address",
    url: "{label} must be a valid URL",
    notInList: "{label}: choose a value from the list",
    invalid: "{label} is not valid",
    generate: "Generate",
    reset: "Reset",
    copy: "Copy",
    copied: "Copied!",
    copyFailed: "Copy failed",
    download: "Download",
    addRow: "Add row",
    removeRow: "Remove",
    row: "Row {n}",
    importCsv: "Import CSV",
    csvHelp: "Paste CSV data. The first line may contain the field names.",
    csvApply: "Import rows",
    csvAppend: "Append to existing rows",
    csvImported: "{count} row(s) imported",
    preset: "Preset",
    presetNone: "\u2014 choose a preset \u2014",
    share: "Copy share link",
    shareCopied: "Link copied!",
    incomplete: "Fill in the highlighted fields to enable copy and download.",
    summary: "{count} field(s) need attention",
    loading: "Loading\u2026",
    noResults: "No results",
    templateError: "Template error: {message}",
    selectPlaceholder: "\u2014 select \u2014"
  });

  // src/schema.js
  var NAME_RE = /^[A-Za-z_$][\w$]*$/;
  var RESERVED_NAMES = ["rows", "count", "index", "isFirst", "isLast"];
  var MODES = ["text", "plain", "html"];
  var PERSIST = [false, "url", "local"];
  function normalizeConfig(config = {}) {
    const batch = config.batch ? { min: 1, max: Infinity, csv: true, initialRows: 1, ...isPlainObject(config.batch) ? config.batch : {} } : null;
    return {
      element: config.element,
      schema: Array.isArray(config.schema) ? config.schema.map(normalizeField) : config.schema,
      templates: normalizeTemplates(config.templates),
      livePreview: config.livePreview !== false,
      persist: config.persist ?? false,
      persistKey: config.persistKey,
      presets: config.presets ?? null,
      batch,
      highlight: config.highlight ?? true,
      handlebars: config.handlebars,
      engine: config.engine,
      helpers: config.helpers ?? {},
      fetch: config.fetch,
      messages: { ...DEFAULT_MESSAGES, ...config.messages || {} },
      hooks: {
        onChange: config.onChange,
        onRender: config.onRender,
        onInvalid: config.onInvalid,
        onCopy: config.onCopy,
        onError: config.onError
      },
      title: config.title,
      description: config.description
    };
  }
  function normalizeField(field) {
    if (!isPlainObject(field)) return field;
    const name = field.name ?? field.fieldName;
    const validation = { ...field.validation || {} };
    if (field.required !== void 0 && validation.required === void 0) validation.required = field.required;
    for (const key of ["min", "max", "minLength", "maxLength", "pattern"]) {
      if (field[key] !== void 0 && validation[key] === void 0) validation[key] = field[key];
    }
    const options = field.options ?? field.values;
    const type = field.type ?? (options !== void 0 || field.optionsUrl ? "select" : "text");
    const dependsOn = field.dependsOn === void 0 ? [] : [].concat(field.dependsOn);
    return {
      ...field,
      name,
      type,
      label: field.label ?? name,
      options,
      dependsOn,
      validation,
      attrs: field.attrs || {}
    };
  }
  function normalizeTemplates(templates) {
    if (!templates) return [];
    const entries = Array.isArray(templates) ? templates.map((t, i) => [t?.key ?? t?.name ?? `template${i + 1}`, t]) : Object.entries(templates);
    return entries.map(([key, t]) => {
      const def = typeof t === "string" ? { source: t } : { ...t };
      return {
        key: String(key),
        title: def.title ?? def.name ?? String(key),
        source: def.source,
        mode: def.mode ?? "text",
        language: def.language,
        filename: def.filename,
        perRow: Boolean(def.perRow),
        separator: def.separator ?? "\n"
      };
    });
  }
  function validateConfig(cfg) {
    const problems = [];
    const fields = cfg.schema;
    if (!Array.isArray(fields) || fields.length === 0) {
      problems.push('"schema" must be a non-empty array of fields.');
      return problems;
    }
    const names = /* @__PURE__ */ new Set();
    fields.forEach((f, i) => {
      const where = `schema[${i}]`;
      if (!isPlainObject(f)) {
        problems.push(`${where} must be an object.`);
        return;
      }
      if (typeof f.name !== "string" || !NAME_RE.test(f.name)) {
        problems.push(`${where}: "name" must be a valid identifier (letters, digits, _ or $), got ${JSON.stringify(f.name)}.`);
      } else if (names.has(f.name)) {
        problems.push(`${where}: duplicate field name "${f.name}".`);
      } else if (RESERVED_NAMES.includes(f.name)) {
        problems.push(`${where}: "${f.name}" is reserved (${RESERVED_NAMES.join(", ")}).`);
      }
      names.add(f.name);
    });
    fields.forEach((f, i) => {
      if (!isPlainObject(f)) return;
      const where = `field "${f.name ?? i}"`;
      if (!hasFieldType(f.type)) {
        problems.push(`${where}: unknown type "${f.type}". Known types: ${fieldTypes().join(", ")}.`);
      }
      if ((f.type === "select" || f.type === "autocomplete") && f.options === void 0 && !f.optionsUrl) {
        problems.push(`${where}: type "${f.type}" needs "options" or "optionsUrl".`);
      }
      if (f.options !== void 0 && !Array.isArray(f.options) && typeof f.options !== "function" && !isPlainObject(f.options)) {
        problems.push(`${where}: "options" must be an array, a function or an object keyed by the dependsOn value.`);
      }
      if (isPlainObject(f.options) && f.dependsOn.length !== 1) {
        problems.push(`${where}: an options map requires exactly one "dependsOn" field.`);
      }
      for (const dep of f.dependsOn) {
        if (!names.has(dep)) problems.push(`${where}: dependsOn references unknown field "${dep}".`);
        if (dep === f.name) problems.push(`${where}: a field cannot depend on itself.`);
      }
      for (const ref of conditionFields(f.visibleWhen)) {
        if (!names.has(ref)) problems.push(`${where}: visibleWhen references unknown field "${ref}".`);
        if (ref === f.name) problems.push(`${where}: visibleWhen cannot reference the field itself.`);
      }
      const { pattern } = f.validation;
      if (typeof pattern === "string") {
        try {
          new RegExp(pattern);
        } catch (err) {
          problems.push(`${where}: invalid pattern ${JSON.stringify(pattern)} (${err.message}).`);
        }
      }
      if (f.validation.custom !== void 0 && typeof f.validation.custom !== "function") {
        problems.push(`${where}: validation.custom must be a function.`);
      }
    });
    if (cfg.templates.length === 0) problems.push('at least one template is required ("templates" option or <script type="text/templates"> elements).');
    const keys = /* @__PURE__ */ new Set();
    for (const t of cfg.templates) {
      if (typeof t.source !== "string") problems.push(`template "${t.key}": "source" must be a string.`);
      if (!MODES.includes(t.mode)) problems.push(`template "${t.key}": mode must be "text", "plain" or "html", got "${t.mode}".`);
      if (keys.has(t.key)) problems.push(`template "${t.key}" is defined twice.`);
      keys.add(t.key);
    }
    if (!PERSIST.includes(cfg.persist)) problems.push(`"persist" must be false, "url" or "local", got ${JSON.stringify(cfg.persist)}.`);
    if (cfg.presets !== null) {
      if (!isPlainObject(cfg.presets)) problems.push('"presets" must be an object: { presetName: { field: value } }.');
      else {
        for (const [preset, values] of Object.entries(cfg.presets)) {
          if (!isPlainObject(values)) {
            problems.push(`preset "${preset}" must be an object of field values.`);
            continue;
          }
          for (const key of Object.keys(values)) {
            if (!names.has(key)) problems.push(`preset "${preset}" sets unknown field "${key}".`);
          }
        }
      }
    }
    if (cfg.batch && !(cfg.batch.min >= 0 && cfg.batch.max >= cfg.batch.min)) {
      problems.push('"batch.min" and "batch.max" must satisfy 0 <= min <= max.');
    }
    return problems;
  }
  function assertValidConfig(cfg) {
    const problems = validateConfig(cfg);
    if (problems.length) throw new SimpleFormError("SimpleForm: invalid configuration", problems);
  }

  // src/helpers.js
  var args = (list) => list.slice(0, -1);
  var pad = (n) => String(n).padStart(2, "0");
  var builtinHelpers = {
    sql(...a) {
      const [v] = args(a);
      if (isEmpty(v)) return "NULL";
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
      if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
      return `'${String(v).replace(/'/g, "''")}'`;
    },
    quote(...a) {
      const [v, q] = args(a);
      const mark = typeof q === "string" && q ? q : '"';
      const s = String(v ?? "").replace(/\\/g, "\\\\").split(mark).join(`\\${mark}`);
      return `${mark}${s}${mark}`;
    },
    upper: (...a) => String(args(a)[0] ?? "").toUpperCase(),
    lower: (...a) => String(args(a)[0] ?? "").toLowerCase(),
    trim: (...a) => String(args(a)[0] ?? "").trim(),
    default(...a) {
      const [v, fallback] = args(a);
      return isEmpty(v) ? fallback : v;
    },
    json: (...a) => JSON.stringify(args(a)[0] ?? null),
    now(...a) {
      const [fmt] = args(a);
      const d = /* @__PURE__ */ new Date();
      const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      if (fmt === "date") return date;
      if (fmt === "time") return time;
      if (fmt === "datetime") return `${date} ${time}`;
      return d.toISOString();
    },
    eq: (...a) => {
      const [x, y] = args(a);
      return x === y || String(x ?? "") === String(y ?? "");
    },
    ne: (...a) => !builtinHelpers.eq(...a),
    and: (...a) => args(a).every(Boolean),
    or: (...a) => args(a).some(Boolean),
    not: (...a) => !args(a)[0],
    join(...a) {
      const [list, sep] = args(a);
      return Array.isArray(list) ? list.join(typeof sep === "string" ? sep : ", ") : String(list ?? "");
    }
  };
  var globalHelpers = /* @__PURE__ */ new Map();
  function registerHelper(name, fn) {
    globalHelpers.set(name, fn);
  }
  var getGlobalHelpers = () => Object.fromEntries(globalHelpers);

  // src/template-engine.js
  var OPEN = "\uE000";
  var CLOSE = "\uE001";
  var BASE = 57600;
  var marker = (index) => OPEN + String.fromCharCode(BASE + index) + CLOSE;
  var MARKER_RE = /([-])/g;
  var replaceMarkers = (str, replacer) => str.replace(MARKER_RE, (m, ch) => replacer(ch.charCodeAt(0) - BASE));
  var TemplateEngine = class {
    /**
     * @param {object} opts
     * @param {object} [opts.handlebars]  Handlebars instance (defaults to globalThis.Handlebars)
     * @param {object} [opts.helpers]     extra helpers for this instance
     * @param {{compile(source, {mode}): (ctx) => string}} [opts.engine] custom template engine
     */
    constructor({ handlebars, helpers = {}, engine } = {}) {
      if (engine) {
        if (typeof engine.compile !== "function") {
          throw new SimpleFormError('SimpleForm: a custom "engine" must expose compile(source, { mode }).');
        }
        this.custom = engine;
        return;
      }
      const hb = handlebars || globalThis.Handlebars;
      if (!hb || typeof hb.create !== "function") {
        throw new SimpleFormError(
          "SimpleForm: Handlebars is required. Load it before creating a form, e.g. https://cdn.jsdelivr.net/npm/handlebars@4.7.8/dist/handlebars.min.js, or pass { handlebars } / { engine }."
        );
      }
      this.hb = hb.create();
      const all = { ...builtinHelpers, ...getGlobalHelpers(), ...helpers };
      for (const [name, fn] of Object.entries(all)) this.hb.registerHelper(name, fn);
    }
    /**
     * Compiles a template. `mode: 'text'` and `mode: 'plain'` disable HTML escaping (the output is
     * shown as text, never parsed as HTML); `mode: 'html'` keeps Handlebars escaping so values cannot
     * inject markup.
     * Syntax errors are reported immediately, not at first render.
     */
    compile(source, { mode = "text", name = "template" } = {}) {
      try {
        if (this.custom) return this.custom.compile(source, { mode });
        this.hb.parse(source);
        return this.hb.compile(source, { noEscape: mode !== "html", strict: false });
      } catch (err) {
        throw new SimpleFormError(`SimpleForm: template "${name}" cannot be compiled: ${err.message}`);
      }
    }
  };
  function toPreviewHtml(text, { language, highlight: highlight2, labels }) {
    const html = highlight2 ? highlight2(text, language) : escapeHtml(text);
    return replaceMarkers(
      html,
      (i) => `<mark class="sf-missing" data-field="${escapeHtml(labels[i]?.name ?? "")}">${escapeHtml(labels[i]?.label ?? "?")}</mark>`
    );
  }
  var stripMarkers = (str) => replaceMarkers(str, () => "");

  // src/simpleform.js
  var HOOKS = { change: "onChange", render: "onRender", invalid: "onInvalid", copy: "onCopy", error: "onError" };
  var SimpleForm = class _SimpleForm {
    /** Shorthand for `new SimpleForm(config).render()`. */
    static create(config) {
      return new _SimpleForm(config).render();
    }
    constructor(config = {}) {
      this.options = config;
      const cfg = normalizeConfig(config);
      this.element = resolveElement(cfg.element);
      this.doc = this.element.ownerDocument;
      if (cfg.templates.length === 0) cfg.templates = readTemplatesFromDOM(this.element);
      assertValidConfig(cfg);
      if (this.element.simpleForm) {
        throw new SimpleFormError("SimpleForm: this element already hosts a form. Call destroy() on it first.");
      }
      const persistKey = cfg.persistKey ?? (this.element.id ? `sf.${this.element.id}` : null);
      if (cfg.persist && !persistKey) {
        throw new SimpleFormError('SimpleForm: "persist" requires "persistKey" or an element with an id.');
      }
      this.config = cfg;
      this.engine = new TemplateEngine({ handlebars: cfg.handlebars, helpers: cfg.helpers, engine: cfg.engine });
      this.compiled = new Map(
        cfg.templates.map((t) => [
          t.key,
          {
            render: this.engine.compile(t.source, { mode: t.mode, name: t.key }),
            filename: t.filename ? this.engine.compile(t.filename, { mode: "text", name: `${t.key} (filename)` }) : null
          }
        ])
      );
      this.highlighter = cfg.highlight === false ? null : typeof cfg.highlight === "function" ? cfg.highlight : highlight;
      this.store = createStore(cfg.persist, persistKey, this.doc.defaultView);
      this.rows = [];
      this.outputs = null;
      this.generated = cfg.livePreview;
      this.rendered = false;
      this.restoring = false;
      this.last = {};
    }
    /* ================================================================ DOM */
    render() {
      if (this.rendered) return this;
      const { doc, config: cfg } = this;
      const m = cfg.messages;
      this.root = h(doc, "div", { class: "sf-root" });
      if (cfg.title) this.root.append(h(doc, "h2", { class: "sf-title", text: cfg.title }));
      if (cfg.description) this.root.append(h(doc, "p", { class: "sf-description", text: cfg.description }));
      this.root.append(this.buildToolbar());
      this.form = h(doc, "form", { class: "sf-form", novalidate: true });
      this.form.addEventListener("submit", (event) => {
        event.preventDefault();
        this.generate();
      });
      this.rowsContainer = h(doc, "div", { class: "sf-rows" });
      this.form.append(this.rowsContainer);
      if (cfg.batch) {
        this.addRowButton = h(doc, "button", {
          type: "button",
          class: "sf-button sf-button-ghost sf-add-row",
          text: m.addRow,
          onClick: () => this.addRow()
        });
        this.form.append(h(doc, "div", { class: "sf-batch-actions" }, this.addRowButton));
        if (cfg.batch.csv) this.form.append(this.buildCsvImport());
      }
      if (!cfg.livePreview) {
        this.form.append(
          h(doc, "div", { class: "sf-actions" }, h(doc, "button", { type: "submit", class: "sf-button sf-generate", text: m.generate }))
        );
      }
      this.summary = h(doc, "div", { class: "sf-summary", role: "alert", hidden: true });
      this.output = new OutputView(this);
      if (!cfg.livePreview) this.output.hide();
      this.root.append(this.form, this.summary, this.output.element);
      this.element.append(this.root);
      this.element.simpleForm = this;
      this.rendered = true;
      const state = this.store?.load();
      const saved = Array.isArray(state?.rows) ? state.rows.filter(isPlainObject) : null;
      this.restoring = true;
      if (cfg.batch) {
        const n = clamp(saved?.length || cfg.batch.initialRows, Math.max(cfg.batch.min, 1), cfg.batch.max);
        for (let i = 0; i < n; i++) this.addRow(saved?.[i] ?? {}, { silent: true });
      } else {
        this.addRow(saved?.[0] ?? {}, { silent: true, force: true });
      }
      this.restoring = false;
      this.last.values = JSON.stringify(this.getValues());
      this.update();
      return this;
    }
    buildToolbar() {
      const { doc, config: cfg } = this;
      const m = cfg.messages;
      const items = [];
      if (cfg.presets) {
        this.presetSelect = h(
          doc,
          "select",
          {
            class: "sf-input sf-preset",
            "aria-label": m.preset,
            onChange: (event) => event.target.value && this.applyPreset(event.target.value)
          },
          h(doc, "option", { value: "", text: m.presetNone }),
          ...Object.keys(cfg.presets).map((name) => h(doc, "option", { value: name, text: name }))
        );
        items.push(h(doc, "label", { class: "sf-preset-label" }, h(doc, "span", { text: m.preset }), this.presetSelect));
      }
      if (cfg.persist === "url") {
        this.shareButton = h(doc, "button", {
          type: "button",
          class: "sf-button sf-button-ghost sf-share",
          text: m.share,
          onClick: () => this.copyShareLink()
        });
        items.push(this.shareButton);
      }
      items.push(
        h(doc, "button", { type: "button", class: "sf-button sf-button-ghost sf-reset", text: m.reset, onClick: () => this.reset() })
      );
      return h(doc, "div", { class: "sf-toolbar" }, ...items);
    }
    buildCsvImport() {
      const { doc, config: cfg } = this;
      const m = cfg.messages;
      const area = h(doc, "textarea", { class: "sf-input sf-csv-input", rows: 4, "aria-label": m.importCsv });
      const append = h(doc, "input", { type: "checkbox", class: "sf-csv-append" });
      const status = h(doc, "span", { class: "sf-csv-status", role: "status" });
      const apply = h(doc, "button", {
        type: "button",
        class: "sf-button sf-csv-apply",
        text: m.csvApply,
        onClick: () => {
          const count = this.importCSV(area.value, { append: append.checked });
          status.textContent = format(m.csvImported, { count });
        }
      });
      return h(
        doc,
        "details",
        { class: "sf-csv" },
        h(doc, "summary", { text: m.importCsv }),
        h(doc, "p", { class: "sf-help", text: m.csvHelp }),
        area,
        h(doc, "div", { class: "sf-csv-actions" }, h(doc, "label", {}, append, ` ${m.csvAppend}`), apply, status)
      );
    }
    /* ============================================================== rows */
    addRow(values = {}, { silent = false, force = false } = {}) {
      const { batch } = this.config;
      if (!force && !batch) throw new SimpleFormError("SimpleForm: addRow() requires batch mode.");
      if (batch && this.rows.length >= batch.max) return null;
      const row = new Row(this, this.rows.length);
      this.rows.push(row);
      this.rowsContainer.append(row.element);
      const wasRestoring = this.restoring;
      this.restoring = true;
      row.setValues({ ...row.defaults(), ...values });
      this.refreshAllDependents(row);
      this.restoring = wasRestoring;
      this.updateRowControls();
      if (!silent) this.update();
      return row;
    }
    removeRow(index) {
      const { batch } = this.config;
      if (!batch || this.rows.length <= Math.max(batch.min, 1) || !this.rows[index]) return false;
      const [row] = this.rows.splice(index, 1);
      row.destroy();
      this.rows.forEach((r, i) => r.setIndex(i));
      this.updateRowControls();
      this.update();
      return true;
    }
    updateRowControls() {
      const { batch } = this.config;
      if (!batch) return;
      const canRemove = this.rows.length > Math.max(batch.min, 1);
      this.rows.forEach((r) => r.setRemovable(canRemove));
      if (this.addRowButton) this.addRowButton.disabled = this.rows.length >= batch.max;
    }
    refreshAllDependents(row) {
      for (const f of row.fields.values()) if (f.field.dependsOn.length) f.def.update?.(f.control, f.ctx);
    }
    /* ============================================================ values */
    /** Called by fields on every change. */
    handleChange(row, name, { silent = false } = {}) {
      if (this.restoring) return;
      if (!silent) row.refreshDependents(name);
      this.update();
    }
    /** Values of visible fields: an object, or an array of objects in batch mode. */
    getValues() {
      const values = this.rows.map((r) => r.getVisibleValues());
      return this.config.batch ? values : values[0] ?? {};
    }
    /** Sets values. In batch mode pass an array to replace rows, or an object to apply to every row. */
    setValues(values) {
      this.restoring = true;
      if (this.config.batch && Array.isArray(values)) {
        while (this.rows.length > Math.max(values.length, this.config.batch.min, 1)) this.rows.pop().destroy();
        values.forEach((v, i) => {
          if (this.rows[i]) this.rows[i].setValues(v);
          else this.addRow(v, { silent: true });
        });
      } else {
        for (const row of this.rows) row.setValues(values);
      }
      this.rows.forEach((r, i) => {
        r.setIndex(i);
        this.refreshAllDependents(r);
      });
      this.restoring = false;
      this.updateRowControls();
      this.update();
      return this;
    }
    getState() {
      return { rows: this.rows.map((r) => r.getValues()) };
    }
    collectErrors({ showAll = false } = {}) {
      const errors = {};
      this.rows.forEach((row, i) => {
        const rowErrors = row.validate({ showAll });
        for (const [name, msg] of Object.entries(rowErrors)) errors[this.config.batch ? `${i}.${name}` : name] = msg;
      });
      return errors;
    }
    /** Validates everything and shows all errors. */
    validate() {
      this.rows.forEach((r) => r.touchAll());
      const errors = this.collectErrors({ showAll: true });
      this.renderSummary();
      return { valid: Object.keys(errors).length === 0, errors };
    }
    /** Main refresh cycle: visibility → validation → persistence/hooks → outputs. */
    update() {
      if (!this.rendered) return;
      this.rows.forEach((r) => r.updateVisibility());
      const errors = this.collectErrors();
      const valid = Object.keys(errors).length === 0;
      const values = this.getValues();
      if (this.changed("values", values)) {
        this.store?.save(this.getState());
        this.emit("change", { values, errors, valid });
      }
      this.renderSummary();
      if (this.generated) this.renderOutputs(errors);
    }
    changed(slot, value) {
      const json = JSON.stringify(value);
      if (this.last[slot] === json) return false;
      this.last[slot] = json;
      return true;
    }
    renderSummary() {
      const shown = this.root.querySelectorAll(".sf-field.sf-invalid").length;
      this.summary.hidden = shown === 0;
      this.summary.textContent = shown ? format(this.config.messages.summary, { count: shown }) : "";
    }
    /* =========================================================== outputs */
    /** Template contexts, one per row. In preview mode empty required fields become markers. */
    buildContexts(preview) {
      const labels = [];
      const contexts = this.rows.map((row, rowIndex) => {
        const values = row.getVisibleValues();
        if (!preview) return values;
        for (const f of row.fields.values()) {
          const v = values[f.field.name];
          const missing = isEmpty(v) || f.field.type === "checkbox" && v === false;
          if (f.visible && f.field.validation.required && missing) {
            values[f.field.name] = marker(labels.length);
            labels.push({ name: f.field.name, label: this.config.batch ? `${f.field.label} #${rowIndex + 1}` : f.field.label });
          }
        }
        return values;
      });
      return { contexts, labels };
    }
    renderTemplate(template, contexts) {
      const { render } = this.compiled.get(template.key);
      const count = contexts.length;
      const ctxFor = (values, i) => ({ ...values, rows: contexts, count, index: i + 1, isFirst: i === 0, isLast: i === count - 1 });
      if (template.perRow) return contexts.map((values, i) => render(ctxFor(values, i))).join(template.separator);
      return render(ctxFor(contexts[0] ?? {}, 0));
    }
    renderOutputs(errors = this.collectErrors()) {
      const valid = Object.keys(errors).length === 0;
      const { contexts, labels } = this.buildContexts(!valid);
      const results = /* @__PURE__ */ new Map();
      const outputs = {};
      for (const template of this.config.templates) {
        try {
          const text = this.renderTemplate(template, contexts);
          const previewHtml = template.mode === "html" ? replaceMarkers(text, (i) => `<mark class="sf-missing">${escapeHtml(labels[i]?.label ?? "?")}</mark>`) : toPreviewHtml(text, {
            language: template.language,
            highlight: template.mode === "plain" ? null : this.safeHighlighter(),
            labels
          });
          results.set(template.key, { previewHtml });
          if (valid) outputs[template.key] = text;
        } catch (error) {
          results.set(template.key, { error });
          this.reportError(error, { template: template.key });
        }
      }
      this.outputs = valid ? outputs : null;
      this.output.update(results, { valid });
      if (valid) {
        if (this.changed("outputs", outputs)) this.emit("render", { outputs, values: this.getValues() });
      } else {
        this.last.outputs = void 0;
        if (this.changed("errors", errors)) this.emit("invalid", { errors });
      }
    }
    safeHighlighter() {
      const hl = this.highlighter;
      if (!hl) return null;
      return (code, language) => {
        const out = hl(code, language);
        return typeof out === "string" ? out : escapeHtml(code);
      };
    }
    /** Validates (showing errors) and renders outputs. Used by the Generate button. */
    generate() {
      const { valid, errors } = this.validate();
      if (!valid) {
        this.rows.some((r) => r.focusFirstError(r.validate({ showAll: true })));
        if (this.changed("errors", errors)) this.emit("invalid", { errors });
        if (!this.generated) return false;
      }
      this.generated = true;
      this.renderOutputs(errors);
      return valid;
    }
    /** Final outputs `{ key: text }`, or null while the form is invalid. */
    getOutputs() {
      const errors = this.collectErrors();
      if (Object.keys(errors).length) return null;
      const { contexts } = this.buildContexts(false);
      return Object.fromEntries(this.config.templates.map((t) => [t.key, this.renderTemplate(t, contexts)]));
    }
    async copy(key) {
      const outputs = this.getOutputs();
      if (!outputs) {
        this.generate();
        return false;
      }
      const template = this.config.templates.find((t) => t.key === key);
      const text = outputs[key];
      const html = template.mode === "html" ? text : null;
      const plain = html ? htmlToText(this.doc, html) : text;
      const ok = await copyToClipboard(this.doc, plain, html);
      this.output.flash(key, "copy", ok ? this.config.messages.copied : this.config.messages.copyFailed);
      if (ok) this.emit("copy", { template: key, text: plain });
      return ok;
    }
    download(key) {
      const outputs = this.getOutputs();
      if (!outputs) {
        this.generate();
        return null;
      }
      const template = this.config.templates.find((t) => t.key === key);
      const { filename } = this.compiled.get(key);
      const { contexts } = this.buildContexts(false);
      const name = safeFilename(
        filename ? stripMarkers(filename({ ...contexts[0], rows: contexts, count: contexts.length })) : defaultFilename(template)
      );
      downloadFile(this.doc, name, outputs[key], template.mode === "html" ? "text/html" : "text/plain");
      return name;
    }
    /* ===================================================== presets & io */
    applyPreset(name) {
      const preset = this.config.presets?.[name];
      if (!preset) throw new SimpleFormError(`SimpleForm: unknown preset "${name}".`);
      this.setValues(preset);
      if (this.presetSelect) this.presetSelect.value = name;
      return this;
    }
    /** Imports CSV rows (batch mode). Returns the number of imported rows. */
    importCSV(text, { append = false } = {}) {
      const { batch, schema } = this.config;
      if (!batch) throw new SimpleFormError("SimpleForm: importCSV() requires batch mode.");
      const records = csvToRecords(parseCSV(text), schema);
      if (!records.length) return 0;
      const existing = append ? this.getState().rows : [];
      const rows = existing.concat(records).slice(0, batch.max);
      this.setValues(rows);
      return Math.min(records.length, Math.max(batch.max - existing.length, 0));
    }
    /** Shareable URL containing the current values (persist: "url" only). */
    getShareUrl() {
      return this.store?.shareUrl(this.getState()) ?? null;
    }
    async copyShareLink() {
      const url = this.getShareUrl();
      if (!url) return false;
      const ok = await copyToClipboard(this.doc, url);
      if (ok && this.shareButton) this.output.flash(null, this.shareButton, this.config.messages.shareCopied);
      return ok;
    }
    reset() {
      const { batch } = this.config;
      this.restoring = true;
      if (batch) {
        this.rows.forEach((r) => r.destroy());
        this.rows = [];
        const n = clamp(batch.initialRows, Math.max(batch.min, 1), batch.max);
        for (let i = 0; i < n; i++) this.addRow({}, { silent: true });
      } else {
        this.rows[0].reset();
        this.refreshAllDependents(this.rows[0]);
      }
      this.restoring = false;
      if (this.presetSelect) this.presetSelect.value = "";
      this.generated = this.config.livePreview;
      if (!this.generated) this.output.hide();
      this.last = {};
      this.update();
      this.store?.clear();
      return this;
    }
    /**
     * JSON-serializable configuration (schema, templates, presets…).
     * Functions cannot be serialized: they are dropped and listed in `warnings`.
     */
    exportSchema() {
      const warnings = [];
      const schema = this.config.schema.map((f) => {
        const raw = this.options.schema.find((r) => (r.name ?? r.fieldName) === f.name) ?? {};
        const out = JSON.parse(JSON.stringify({ ...raw, name: f.name, type: f.type, fieldName: void 0, values: void 0, options: raw.options ?? raw.values }));
        for (const key of ["options", "visibleWhen"]) {
          if (typeof (raw[key] ?? (key === "options" ? raw.values : void 0)) === "function") warnings.push(`field "${f.name}": "${key}" is a function and was not exported.`);
        }
        if (typeof raw.validation?.custom === "function") warnings.push(`field "${f.name}": "validation.custom" is a function and was not exported.`);
        return out;
      });
      const templates = Object.fromEntries(
        this.config.templates.map(({ key, ...t }) => [key, JSON.parse(JSON.stringify({ ...t, perRow: t.perRow || void 0, separator: t.separator === "\n" ? void 0 : t.separator }))])
      );
      const { batch } = this.config;
      const config = {
        ...this.config.title ? { title: this.config.title } : {},
        ...this.config.description ? { description: this.config.description } : {},
        schema,
        templates,
        livePreview: this.config.livePreview,
        ...this.config.persist ? { persist: this.config.persist, persistKey: this.options.persistKey } : {},
        ...this.config.presets ? { presets: this.config.presets } : {},
        ...batch ? { batch: { min: batch.min, ...Number.isFinite(batch.max) ? { max: batch.max } : {}, csv: batch.csv, initialRows: batch.initialRows } } : {}
      };
      return { config: JSON.parse(JSON.stringify(config)), warnings };
    }
    /* ============================================================ events */
    /** Subscribes to change | render | invalid | copy | error. Returns an unsubscribe function. */
    on(event, callback) {
      const listener = (e) => callback(e.detail);
      this.element.addEventListener(`simpleform:${event}`, listener);
      return () => this.element.removeEventListener(`simpleform:${event}`, listener);
    }
    emit(event, detail) {
      const payload = { ...detail, form: this };
      const hook = this.config.hooks[HOOKS[event]];
      if (typeof hook === "function") {
        try {
          hook(payload);
        } catch (err) {
          if (event !== "error") this.reportError(err, { hook: HOOKS[event] });
          else console.error("[SimpleForm] onError hook failed", err);
        }
      }
      const CustomEventCtor = this.doc.defaultView?.CustomEvent ?? globalThis.CustomEvent;
      this.element.dispatchEvent(new CustomEventCtor(`simpleform:${event}`, { detail: payload, bubbles: true }));
    }
    reportError(error, context = {}) {
      if (!this.config.hooks.onError) console.error("[SimpleForm]", error);
      this.emit("error", { error, ...context });
    }
    destroy() {
      this.root?.remove();
      this.rows = [];
      this.rendered = false;
      delete this.element.simpleForm;
    }
  };
  var clamp = (n, min, max) => Math.min(Math.max(n, min), max);
  function htmlToText(doc, html) {
    const Parser = doc.defaultView?.DOMParser ?? globalThis.DOMParser;
    return new Parser().parseFromString(html, "text/html").body.textContent;
  }

  // src/declarative.js
  async function loadSchema(url, { fetch: fetchImpl } = {}) {
    const doFetch = fetchImpl || globalThis.fetch;
    if (typeof doFetch !== "function") throw new SimpleFormError("SimpleForm.loadSchema: fetch is not available.");
    const res = await doFetch(url);
    if (!res.ok) throw new SimpleFormError(`SimpleForm.loadSchema: HTTP ${res.status} while loading ${url}.`);
    let data;
    try {
      data = await res.json();
    } catch (err) {
      throw new SimpleFormError(`SimpleForm.loadSchema: ${url} is not valid JSON (${err.message}).`);
    }
    if (Array.isArray(data)) data = { schema: data };
    if (!isPlainObject(data)) throw new SimpleFormError(`SimpleForm.loadSchema: ${url} must contain an object or an array of fields.`);
    return data;
  }
  async function fromElement(element, overrides = {}) {
    let config = {};
    const inline = element.querySelector(':scope > script[type="application/json"].sf-schema, :scope > script[type="application/json"][data-sf-schema]');
    if (inline) {
      try {
        config = JSON.parse(inline.textContent);
      } catch (err) {
        throw new SimpleFormError(`SimpleForm: invalid JSON in .sf-schema (${err.message}).`);
      }
      if (Array.isArray(config)) config = { schema: config };
    } else if (element.dataset.schemaSrc) {
      config = await loadSchema(element.dataset.schemaSrc, overrides);
    } else {
      throw new SimpleFormError('SimpleForm: [data-simpleform] needs a <script type="application/json" class="sf-schema"> or data-schema-src.');
    }
    const { livePreview, persist } = element.dataset;
    if (livePreview !== void 0) config.livePreview = livePreview !== "false";
    if (persist !== void 0) config.persist = persist === "false" ? false : persist;
    return SimpleForm.create({ ...config, ...overrides, element });
  }
  async function autoInit(root = globalThis.document, overrides = {}) {
    if (!root) return [];
    const elements = [...root.querySelectorAll("[data-simpleform]")].filter((el) => !el.simpleForm && !el.dataset.sfPending);
    const results = await Promise.allSettled(
      elements.map(async (el) => {
        el.dataset.sfPending = "true";
        try {
          return await fromElement(el, overrides);
        } catch (err) {
          el.dataset.sfError = err.message;
          console.error("[SimpleForm] auto-init failed for", el, err);
          throw err;
        } finally {
          delete el.dataset.sfPending;
        }
      })
    );
    return results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  }

  // src/legacy.js
  var ScriptGenerator = class {
    constructor(formSchema, generatorId, options = {}) {
      const doc = options.document ?? globalThis.document;
      const element = generatorId ? doc.getElementById(generatorId) : doc.body;
      if (!element) throw new SimpleFormError(`ScriptGenerator: no element with id "${generatorId}".`);
      if (!Array.isArray(formSchema)) throw new SimpleFormError("ScriptGenerator: formSchema must be an array.");
      const schema = formSchema.map((f) => ({
        name: f.fieldName ?? f.name,
        label: f.label ?? f.fieldName ?? f.name,
        placeholder: f.placeholder,
        defaultValue: f.defaultValue,
        ...f.values ? { type: "autocomplete", options: f.values } : { type: f.type ?? "text" }
      }));
      this.form = new SimpleForm({
        livePreview: false,
        ...options,
        element,
        schema,
        templates: readTemplatesFromDOM(element, { defaultMode: "html" })
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
  };

  // src/index.js
  var version = "2.0.0";
  Object.assign(SimpleForm, {
    version,
    registerField,
    registerHelper,
    fieldTypes,
    loadSchema,
    fromElement,
    autoInit,
    parseCSV,
    highlight,
    messages: DEFAULT_MESSAGES,
    helpers: builtinHelpers,
    Error: SimpleFormError
  });
  var index_default = SimpleForm;

  // src/umd.js
  var { SimpleForm: SimpleForm2, ScriptGenerator: ScriptGenerator2 } = index_exports;
  if (typeof window !== "undefined") {
    window.SimpleForm = SimpleForm2;
    if (!window.ScriptGenerator) window.ScriptGenerator = ScriptGenerator2;
    const start = () => {
      if (document.documentElement.hasAttribute("data-simpleform-manual")) return;
      SimpleForm2.autoInit(document);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else setTimeout(start, 0);
  }
  var umd_default = SimpleForm2;
  return __toCommonJS(umd_exports);
})();
if (typeof module === 'object' && module.exports) module.exports = SimpleFormJs;

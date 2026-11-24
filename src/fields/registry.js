import { SimpleFormError } from '../errors.js';

const registry = new Map();

/**
 * Registers a field type.
 *
 * definition = {
 *   render(ctx) -> HTMLElement            required; put `ctx.id` on the focusable control
 *   getValue(element, ctx) -> any         required
 *   setValue(element, value, ctx)         required
 *   validate(value, ctx) -> string|null   optional, runs after the declarative rules
 *   update(element, ctx)                  optional, called when a `dependsOn` field changes
 *   emptyValue                            optional, value used on reset (default '')
 * }
 *
 * ctx = { field, id, doc, messages, emit(), values(), loadOptions(query), element }
 * Call `ctx.emit()` whenever the value changes.
 */
export function registerField(type, definition) {
  if (typeof type !== 'string' || !type) throw new SimpleFormError('registerField: type must be a non-empty string.');
  const missing = ['render', 'getValue', 'setValue'].filter((m) => typeof definition?.[m] !== 'function');
  if (missing.length) {
    throw new SimpleFormError(`registerField("${type}"): missing method(s) ${missing.join(', ')}.`);
  }
  registry.set(type, definition);
}

export const getFieldType = (type) => registry.get(type);
export const hasFieldType = (type) => registry.has(type);
export const fieldTypes = () => [...registry.keys()];

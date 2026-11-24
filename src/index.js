import { SimpleForm } from './simpleform.js';
import { autoInit, fromElement, loadSchema } from './declarative.js';
import { registerField, fieldTypes } from './fields/registry.js';
import { registerHelper, builtinHelpers } from './helpers.js';
import { highlight } from './highlight.js';
import { parseCSV } from './csv.js';
import { SimpleFormError } from './errors.js';
import { ScriptGenerator } from './legacy.js';
import { DEFAULT_MESSAGES } from './messages.js';

export const version = '2.0.0';

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
  Error: SimpleFormError,
});

export {
  SimpleForm,
  ScriptGenerator,
  SimpleFormError,
  registerField,
  registerHelper,
  fieldTypes,
  loadSchema,
  fromElement,
  autoInit,
  parseCSV,
  highlight,
  DEFAULT_MESSAGES,
};
export default SimpleForm;

import Handlebars from 'handlebars';
import { afterEach } from 'vitest';

// SimpleForm resolves Handlebars from the global scope, like in a browser page.
globalThis.Handlebars = Handlebars;

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  history.replaceState(null, '', '/');
});

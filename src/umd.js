/*
 * Browser bundle entry (<script src="simpleform.umd.js">).
 * Exposes window.SimpleForm and window.ScriptGenerator (1.x compatibility) and
 * initializes [data-simpleform] elements once the DOM is ready.
 */
import * as api from './index.js';

const { SimpleForm, ScriptGenerator } = api;

if (typeof window !== 'undefined') {
  window.SimpleForm = SimpleForm;
  if (!window.ScriptGenerator) window.ScriptGenerator = ScriptGenerator;

  const start = () => {
    if (document.documentElement.hasAttribute('data-simpleform-manual')) return;
    SimpleForm.autoInit(document);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else setTimeout(start, 0);
}

export * from './index.js';
export default SimpleForm;

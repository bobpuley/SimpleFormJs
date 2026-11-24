/* Tour chrome only: navigation, "Show code" panels and theme switch. The demos live in index.html. */
(function tour() {
  const dedent = (text) => {
    const lines = text.replace(/\t/g, '  ').split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
    return lines.map((l) => l.slice(indent)).join('\n');
  };

  // "Show code": display exactly the script that runs each demo
  document.querySelectorAll('script[data-demo]').forEach((script) => {
    const details = document.createElement('details');
    details.className = 'show-code';
    details.innerHTML = '<summary>Show code</summary><pre class="tour-code"><code></code></pre>';
    details.querySelector('code').textContent = dedent(script.textContent);
    script.after(details);
  });

  // declarative demo: show its markup as it was written (before initialization)
  const declarative = document.getElementById('demo-declarative');
  const source = document.getElementById('declarative-source');
  if (declarative && source) {
    const markup = [...declarative.querySelectorAll(':scope > script')].map((s) => s.outerHTML).join('\n');
    source.textContent = dedent(`<div data-simpleform>\n${markup}\n</div>`);
  }

  // step navigation with "current step" tracking
  const list = document.getElementById('tour-steps');
  const steps = [...document.querySelectorAll('.step')];
  steps.forEach((step) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${step.id}`;
    a.textContent = step.dataset.title;
    li.append(a);
    list.append(li);
  });
  const links = [...list.querySelectorAll('a')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((a) => a.toggleAttribute('aria-current', a.hash === `#${entry.target.id}`));
        });
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );
    steps.forEach((s) => observer.observe(s));
  }

  // theme switch: everything is driven by CSS variables
  const toggle = document.getElementById('theme-toggle');
  const apply = (dark) => {
    document.documentElement.classList.toggle('dark', dark);
    toggle.setAttribute('aria-pressed', String(dark));
  };
  apply(localStorage.getItem('tour-theme') === 'dark');
  toggle.addEventListener('click', () => {
    const dark = !document.documentElement.classList.contains('dark');
    localStorage.setItem('tour-theme', dark ? 'dark' : 'light');
    apply(dark);
  });
})();

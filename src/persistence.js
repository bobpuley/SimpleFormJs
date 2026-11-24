/**
 * Stores the form state in the URL (shareable links) or in localStorage.
 * Every operation is defensive: storage may be disabled and URLs may be hand-edited.
 */
export function createStore(mode, key, win = globalThis.window) {
  if (!mode || !win) return null;

  if (mode === 'local') {
    return {
      load() {
        try {
          return JSON.parse(win.localStorage.getItem(key) ?? 'null');
        } catch {
          return null;
        }
      },
      save(state) {
        try {
          win.localStorage.setItem(key, JSON.stringify(state));
        } catch {
          /* quota exceeded or storage disabled */
        }
      },
      clear() {
        try {
          win.localStorage.removeItem(key);
        } catch {
          /* ignore */
        }
      },
      shareUrl: () => null,
    };
  }

  if (mode === 'url') {
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
          win.history.replaceState(win.history.state, '', urlWith(state));
        } catch {
          /* e.g. sandboxed iframe */
        }
      },
      clear() {
        try {
          win.history.replaceState(win.history.state, '', urlWith(null));
        } catch {
          /* ignore */
        }
      },
      shareUrl: (state) => urlWith(state).toString(),
    };
  }
  return null;
}

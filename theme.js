/* Loaded before styles to apply the saved preference before the first paint. */
(() => {
  'use strict';
  const key = 'quant-learn-theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => value === 'dark' || value === 'light' ? value : null;
  let preference = null;
  try { preference = valid(localStorage.getItem(key)); } catch (_) {
    // Storage can be unavailable in private browsing or when opening a local file.
  }

  function apply() {
    const theme = preference || (system.matches ? 'dark' : 'light');
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111722' : '#f7f8fa');
    const button = document.getElementById('theme-toggle');
    if (button) {
      button.setAttribute('aria-pressed', String(dark));
      button.title = dark ? '切换到日间模式' : '切换到夜间模式';
    }
  }

  function bind() {
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch (_) {
        // The toggle still works for this page when storage is blocked.
      }
      apply();
    });
    apply();
  }

  apply();
  system.addEventListener('change', () => { if (!preference) apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      preference = valid(event.newValue);
      apply();
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();

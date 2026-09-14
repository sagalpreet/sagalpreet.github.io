/* site.js — shared behaviour: theme toggle + sticky-bar state.
   Tiny, dependency-free, safe to load with `defer` on every page.
   The theme is applied earlier by the inline snippet in <head> (see theme-init). */

(function () {
  'use strict';

  var root = document.documentElement;
  var STORE_KEY = 'theme';

  /* ---- theme ---------------------------------------------------------- */
  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function currentTheme() {
    return root.getAttribute('data-theme') || (systemPrefersDark() ? 'dark' : 'light');
  }

  function applyTheme(mode) {
    root.setAttribute('data-theme', mode);
    try { localStorage.setItem(STORE_KEY, mode); } catch (_) {}
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-label', mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      btn.setAttribute('title', mode === 'dark' ? 'Light theme' : 'Dark theme');
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });

  // Follow the OS until the visitor makes an explicit choice.
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () {
      var stored = null;
      try { stored = localStorage.getItem(STORE_KEY); } catch (_) {}
      if (!stored) root.removeAttribute('data-theme');
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  applyTheme(currentTheme());

  /* ---- sticky bar hairline -------------------------------------------- */
  var bar = document.querySelector('.site-bar');
  if (bar) {
    var tick = function () {
      bar.setAttribute('data-scrolled', window.scrollY > 4 ? 'true' : 'false');
    };
    tick();
    window.addEventListener('scroll', tick, { passive: true });
  }

  /* ---- lazy images declared with data-src ----------------------------- */
  document.querySelectorAll('img[data-src]').forEach(function (img) {
    img.src = img.getAttribute('data-src');
    img.removeAttribute('data-src');
  });
})();

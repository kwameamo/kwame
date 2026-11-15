/* ─────────────────────────────────────────
   THEME — light / dark for every page
   Loaded in <head>, before any paint, so a
   dark page never flashes white.

   • html[data-scheme] is always "light" or "dark":
     the CSS only ever looks at that.
   • The visitor's choice is kept in localStorage.
     Choosing the same scheme as the system clears
     it, so the site follows the system again.
   • Any element with [data-theme-toggle] becomes a
     switch: "icon" buttons get a sun / moon, "label"
     menu items get "Dark Appearance" / "Light Appearance".
───────────────────────────────────────── */
(function () {
    'use strict';

    var KEY = 'theme';
    var root = document.documentElement;
    var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    var COLORS = { light: null, dark: '#000000' };

    function saved() {
        try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch (_) { return null; }
    }
    function system() { return media && media.matches ? 'dark' : 'light'; }
    function current() { return root.getAttribute('data-scheme') || system(); }

    function apply(scheme) {
        root.setAttribute('data-scheme', scheme);
        root.style.colorScheme = scheme;
        var metas = document.querySelectorAll('meta[name="theme-color"]');
        if (!COLORS.light && metas.length) COLORS.light = metas[0].getAttribute('data-light') || metas[0].getAttribute('content') || '#ffffff';
        Array.prototype.forEach.call(metas, function (m) {
            if (!m.hasAttribute('data-light')) m.setAttribute('data-light', m.getAttribute('content') || '#ffffff');
            m.removeAttribute('media');
            m.setAttribute('content', scheme === 'dark' ? COLORS.dark : m.getAttribute('data-light'));
        });
        paint();
        if (window.LiquidGlass) setTimeout(window.LiquidGlass.refresh, 60);
    }

    apply(saved() || system());

    if (media) {
        var follow = function () { if (!saved()) apply(system()); };
        if (media.addEventListener) media.addEventListener('change', follow);
        else if (media.addListener) media.addListener(follow);
    }

    function set(scheme) {
        try {
            if (scheme === system()) localStorage.removeItem(KEY);
            else localStorage.setItem(KEY, scheme);
        } catch (_) {}
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (document.startViewTransition && !reduce) {
            document.startViewTransition(function () { apply(scheme); });
        } else {
            root.classList.add('theme-switching');
            apply(scheme);
            setTimeout(function () { root.classList.remove('theme-switching'); }, 400);
        }
    }

    function toggle() { set(current() === 'dark' ? 'light' : 'dark'); }

    var SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5 7 7M17 17l1.5 1.5M5.5 18.5 7 17M17 7l1.5-1.5"/></svg>';
    var MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" d="M19.5 14.6A8 8 0 0 1 9.4 4.5 8 8 0 1 0 19.5 14.6z"/></svg>';

    // Show what a tap will switch TO: a moon in light mode, a sun in dark mode
    function paint() {
        var dark = current() === 'dark';
        var nodes = document.querySelectorAll('[data-theme-toggle]');
        Array.prototype.forEach.call(nodes, function (el) {
            var label = dark ? 'Switch to light appearance' : 'Switch to dark appearance';
            el.setAttribute('aria-label', label);
            el.setAttribute('title', label);
            el.setAttribute('aria-pressed', String(dark));
            if (el.getAttribute('data-theme-toggle') === 'label') {
                el.innerHTML = '<span>' + (dark ? 'Light Appearance' : 'Dark Appearance') + '</span>' + (dark ? SUN : MOON);
            } else {
                el.innerHTML = dark ? SUN : MOON;
            }
        });
    }

    function wire() {
        paint();
        document.addEventListener('click', function (e) {
            var t = e.target.closest && e.target.closest('[data-theme-toggle]');
            if (!t) return;
            e.preventDefault();
            toggle();
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
    else wire();

    window.Theme = { get: current, set: set, toggle: toggle };
}());

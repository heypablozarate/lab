// Google Analytics 4 for constitution.design, same property as pablozarate.com (G-WCMD6T3259).
// Mirrors the webpz contract: fail closed outside the production origin, respect the
// ga-disable flag, no automatic page_view (one manual page_view, no query string),
// gtag loaded on first intent or after 10 s, cross-domain linker with pablozarate.com.
(function () {
  'use strict';
  var ID = 'G-WCMD6T3259';
  var ORIGIN = 'https://constitution.design';
  if (location.origin !== ORIGIN) return;           // localhost, previews, file://
  if (window['ga-disable-' + ID] === true) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag('js', new Date());
  gtag('config', ID, {
    send_page_view: false,
    linker: { domains: ['pablozarate.com', 'constitution.design', 'hit-try.vercel.app'] }
  });
  gtag('event', 'page_view', {
    page_title: document.title,
    page_location: ORIGIN + location.pathname,
    page_referrer: document.referrer || undefined
  });

  // Outbound clicks to the main site: destination host and source path only.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.host === location.host || !/^https?:$/.test(url.protocol)) return;
    if (!/(^|\.)pablozarate\.com$/.test(url.hostname)) return;
    gtag('event', 'outbound_link_click', { destination_host: url.hostname, source_path: location.pathname });
  }, true);

  // Successful shares, from share.js.
  window.PZTrack = function (name, params) { gtag('event', name, params || {}); };

  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(s);
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (t) { window.removeEventListener(t, load, true); });
  }
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (t) { window.addEventListener(t, load, { capture: true, passive: true, once: true }); });
  setTimeout(load, 10000);
})();

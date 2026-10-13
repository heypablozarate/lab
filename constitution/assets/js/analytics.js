// Google Analytics 4 for constitution.design, dedicated property (G-85ZQQS5909).
// Fail closed outside the production origin, respect the ga-disable flag, send one
// manual page_view, and retain only allowlisted campaign parameters.
(function () {
  'use strict';
  var ID = 'G-85ZQQS5909';
  var ORIGIN = 'https://constitution.design';
  var CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  if (location.origin !== ORIGIN) return;           // localhost, previews, file://
  if (window['ga-disable-' + ID] === true) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  function language() {
    return document.documentElement.lang === 'es' ? 'es' : 'en';
  }

  function campaignLocation() {
    var clean = new URL(ORIGIN + location.pathname);
    var current = new URL(location.href);
    CAMPAIGN_KEYS.forEach(function (key) {
      var value = current.searchParams.get(key);
      if (value && /^[a-z0-9][a-z0-9._~-]{0,79}$/i.test(value)) clean.searchParams.set(key, value);
    });
    return clean.href;
  }

  function safeReferrer() {
    if (!document.referrer) return '';
    try {
      var referrer = new URL(document.referrer);
      return /^https?:$/.test(referrer.protocol) ? referrer.origin + referrer.pathname : '';
    } catch (err) {
      return '';
    }
  }

  function withContext(params) {
    var result = {};
    Object.keys(params || {}).forEach(function (key) { result[key] = params[key]; });
    result.source_path = location.pathname;
    result.content_language = language();
    result.page_location = campaignLocation();
    result.page_referrer = safeReferrer();
    return result;
  }

  gtag('js', new Date());
  gtag('config', ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: campaignLocation(),
    page_referrer: safeReferrer()
  });
  gtag('event', 'page_view', {
    page_title: document.title,
    page_location: campaignLocation(),
    page_referrer: safeReferrer(),
    content_language: language()
  });

  function shouldDelayNavigation(event, anchor, url) {
    return !event.defaultPrevented && event.button === 0 &&
      !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
      (!anchor.target || anchor.target.toLowerCase() === '_self') &&
      !anchor.hasAttribute('download') && /^https?:$/.test(url.protocol);
  }

  // Classify intentional CTAs separately; other outbound links receive one event.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (a.dataset.analyticsCta) {
      var params = {
        cta_id: a.dataset.analyticsCta,
        destination_host: url.hostname
      };
      if (shouldDelayNavigation(e, a, url)) {
        e.preventDefault();
        window.PZTrack('cta_click', params, function () { location.href = url.href; });
      } else {
        window.PZTrack('cta_click', params);
      }
      return;
    }
    if (a.dataset.share || url.host === location.host || !/^https?:$/.test(url.protocol)) return;
    gtag('event', 'outbound_link_click', withContext({
      link_id: a.dataset.analyticsLink || 'unclassified',
      destination_host: url.hostname
    }));
  }, true);

  // Action events may delay a navigation briefly so the browser can dispatch them.
  window.PZTrack = function (name, params, callback) {
    var payload = withContext(params);
    if (callback) {
      var called = false;
      var done = function () {
        if (called) return;
        called = true;
        callback();
      };
      payload.event_callback = done;
      payload.event_timeout = 800;
      setTimeout(done, 900);
    }
    gtag('event', name, payload);
  };

  // Load immediately: deferred loading can lose short visits and navigation clicks.
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);
})();

// Footer share action. Uses the system share sheet where it exists (macOS, iOS, Android);
// elsewhere it opens a small menu with LinkedIn, X, WhatsApp and copy link.
(function () {
  'use strict';
  var btn = document.querySelector('.share-btn');
  var menu = document.querySelector('.share-menu');
  if (!btn || !menu) return;

  // Opened as a local file, shares point to the public address.
  var FALLBACK_URL = 'https://constitution.design';
  function url() { return /^https?:/.test(location.protocol) ? location.href.split('#')[0] : FALLBACK_URL; }
  function es() { return window.PZLang && window.PZLang.get() === 'es'; }
  function title() { return es() ? 'La constitución del Diseñador, por PabloZarate™' : 'The Designer’s Constitution, by PabloZarate™'; }

  function track(method) { if (window.PZTrack) window.PZTrack('share', { method: method, content_type: 'essay' }); }

  function links() {
    var u = encodeURIComponent(url()), t = encodeURIComponent(title());
    menu.querySelector('[data-share="linkedin"]').href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + u;
    menu.querySelector('[data-share="x"]').href = 'https://x.com/intent/post?text=' + t + '&url=' + u;
    menu.querySelector('[data-share="whatsapp"]').href = 'https://wa.me/?text=' + t + '%20' + u;
  }

  function toggle(open) {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) links();
  }

  btn.addEventListener('click', function () {
    if (navigator.share && /^https?:/.test(location.protocol)) {
      navigator.share({ title: title(), url: url() }).then(function () { track('native'); }).catch(function () {});
      return;
    }
    toggle(menu.hidden);
  });

  menu.querySelector('[data-share="copy"]').addEventListener('click', function (e) {
    var b = e.currentTarget, label = b.textContent;
    track('copy_link');
    var done = function () { b.textContent = es() ? 'Link copiado' : 'Link copied'; setTimeout(function () { b.textContent = label; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url()).then(done, done);
    else done();
  });
  menu.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (a) { track(a.dataset.share); toggle(false); }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.share')) toggle(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggle(false); });
})();

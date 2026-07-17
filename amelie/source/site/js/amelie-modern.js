/* ============================================================
   Amélie 2004 — capa de modernización (2026)
   Reemplaza MM_dragLayer (Dreamweaver MX) con Pointer Events.
   Conserva las coordenadas de snap, la tolerancia y el dropJS
   originales, tal cual fueron definidos en 2004.
   ============================================================ */

/* Sobrescribe la MM_dragLayer inline de las páginas.
   Misma firma que la original (v4.01, Macromedia 1998). */
function MM_dragLayer(objName, x, hL, hT, hW, hH, toFront, dropBack, cU, cD, cL, cR, targL, targT, tol, dropJS, et, dragJS) {
  var el = document.getElementById(objName);
  if (!el || el.__ameDrag) return;
  el.__ameDrag = true;

  el.style.cursor = 'grab';
  el.style.touchAction = 'none';
  el.classList.add('ame-pieza');

  el.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.classList.remove('ame-hint');
    var startX = e.clientX, startY = e.clientY;
    var origL = parseInt(el.style.left, 10) || 0;
    var origT = parseInt(el.style.top, 10) || 0;
    var oldZ = el.style.zIndex;
    el.style.zIndex = 1000;
    el.style.cursor = 'grabbing';

    function onMove(ev) {
      el.style.left = (origL + ev.clientX - startX) + 'px';
      el.style.top = (origT + ev.clientY - startY) + 'px';
    }

    function onUp(ev) {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      try { el.releasePointerCapture(ev.pointerId); } catch (err) {}
      el.style.cursor = 'grab';

      var L = parseInt(el.style.left, 10) || 0;
      var T = parseInt(el.style.top, 10) || 0;
      var snapped = typeof targL === 'number' && typeof targT === 'number' &&
        (Math.pow(targL - L, 2) + Math.pow(targT - T, 2)) <= Math.pow(tol, 2);

      if (snapped) {
        el.style.left = targL + 'px';
        el.style.top = targT + 'px';
        el.style.cursor = 'default';
        /* pequeña pausa para ver el encastre antes de navegar */
        if (dropJS) setTimeout(function () { eval(dropJS); }, 400);
      } else {
        el.style.zIndex = oldZ;
      }
    }

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  });
}

/* Reemplaza MM_controlSound (embeds WAV/MP3 con plugin, muertos hoy)
   por Audio(). Misma firma que la original de Dreamweaver. */
var __ameSounds = {};
function MM_controlSound(sndAction, sndObj, sndFile) {
  if (!sndFile) return;
  var a = __ameSounds[sndFile];
  if (!a) { a = __ameSounds[sndFile] = new Audio(sndFile); }
  if (sndAction === 'play') { a.currentTime = 0; a.play().catch(function () {}); }
  else { a.pause(); a.currentTime = 0; }
}

/* Registro inmediato: en 2004 el drag se "armaba" recién al pasar
   el mouse. Acá escaneamos el DOM al cargar para que las piezas
   tengan affordance (cursor + hint) desde el primer momento. */
document.addEventListener('DOMContentLoaded', function () {
  var all = document.querySelectorAll('[onmouseover]');
  for (var i = 0; i < all.length; i++) {
    var src = all[i].getAttribute('onmouseover') || '';
    if (src.indexOf('MM_dragLayer') !== -1 && all[i].onmouseover) {
      all[i].onmouseover.call(all[i]); /* invoca con los args originales */
      all[i].removeAttribute('onmouseover');
      all[i].classList.add('ame-hint');
    }
  }
});

/* Affordance mínima: wiggle sutil al cargar, respetando reduced-motion */
(function () {
  var style = document.createElement('style');
  style.textContent =
    'img{vertical-align:bottom;}' + /* fix gaps de tablas cortadas en browsers modernos */
    '.ame-pieza img{-webkit-user-drag:none;user-select:none;}' +
    '@media (prefers-reduced-motion: no-preference){' +
    '  .ame-hint{animation:ame-wiggle 2.4s ease-in-out 1.2s 2;}' +
    '  @keyframes ame-wiggle{' +
    '    0%,100%{transform:rotate(0deg)}' +
    '    10%{transform:rotate(-2.5deg)}20%{transform:rotate(2deg)}' +
    '    30%{transform:rotate(-1.5deg)}40%{transform:rotate(0.8deg)}50%{transform:rotate(0deg)}' +
    '  }' +
    '}';
  document.head.appendChild(style);
})();

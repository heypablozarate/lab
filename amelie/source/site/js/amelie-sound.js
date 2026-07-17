/* Amélie 2004 — reemplazo del reproductor Flash (2026)
   Los SWF originales (musica_rojo/azul/final) fueron extraídos a MP3.
   El frame derecho se recarga por sección, igual que en 2004. */
(function () {
  var body = document.body;
  var src = body.getAttribute('data-music'); /* vacío = sección en silencio */
  var KEY = 'amelie-sound';

  var btn = document.createElement('div');
  btn.id = 'ame-sound-btn';
  btn.style.cssText = 'width:31px;height:46px;display:flex;align-items:center;justify-content:center;' +
    'cursor:pointer;font:18px/1 Georgia,serif;color:#888;user-select:none;';
  btn.title = 'Música on/off';
  var slot = document.getElementById('ame-sound-slot');
  (slot || body).appendChild(btn);

  if (!src) { btn.textContent = '♪'; btn.style.opacity = '0.25'; btn.style.cursor = 'default'; return; }

  var audio = new Audio(src);
  audio.loop = true;

  function render(on) {
    btn.textContent = on ? '♪' : '♪';
    btn.style.color = on ? '#fff' : '#555';
    btn.style.textDecoration = on ? 'none' : 'line-through';
  }

  function wantsSound() { try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; } }
  function setPref(on) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {} }

  function tryPlay() {
    audio.play().then(function () { render(true); }).catch(function () {
      /* autoplay bloqueado: queda en off visual hasta el primer gesto */
      render(false);
      var once = function () {
        if (wantsSound()) audio.play().then(function () { render(true); }).catch(function () {});
        window.removeEventListener('pointerdown', once);
        try { parent.document.removeEventListener('pointerdown', onceParent); } catch (e) {}
      };
      var onceParent = once;
      window.addEventListener('pointerdown', once);
      try { parent.document.addEventListener('pointerdown', onceParent); } catch (e) {}
    });
  }

  btn.addEventListener('click', function () {
    if (audio.paused) { setPref(true); audio.play().then(function(){ render(true); }).catch(function(){}); }
    else { audio.pause(); setPref(false); render(false); }
  });

  if (wantsSound()) tryPlay(); else render(false);
})();

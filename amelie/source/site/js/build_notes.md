# Notas de build — Amélie 2004 (recreación 2026)

Fuente canónica: `DaVinci - Amelie/Backup/amelie/`

Transformaciones aplicadas por `tools/build.py` (idempotente, siempre desde la fuente):

1. HTML transcodificado ISO-8859-1 → UTF-8, meta charset actualizado.
2. Links `index.php` → `index.html` (el splash ya no necesita PHP).
3. `js/amelie-modern.js` inyectado antes de `</body>` en páginas de contenido:
   reemplaza `MM_dragLayer` (roto en browsers modernos) por Pointer Events,
   conservando coordenadas de snap, tolerancia de 30px y navegación original.
4. `sound*.html` regenerados: el embed Flash pasa a `<audio loop>` con toggle.
   Mapa: sound→musicafinal, sound_rojo→musica_rojo, sound_azul→musica_azul,
   sound_verde→silencio (así era en 2004).
5. `index.html` (splash) recreado a mano: el texto fecha/hora que generaba
   PHP+GD con la Mistral ahora es client-side (webfont + reloj en vivo).

Pendiente en fases siguientes: trailer mp4, upscale @2x, escenario iMac.

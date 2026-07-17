# Amélie 2004 — Recreación para LAB

Recreación del sitio "Mundo Amélie / Mundo Jeunet" (proyecto de estudio, DaVinci 2004),
destino final: `lab.pablozarate.com/amelie`, fechado 2004.

## Cómo probarlo

Abrir `site/index.html` en el browser (doble click). El splash con el reloj en vivo
lleva a los dos mundos. Todo navega igual que en 2004.

Para probar: el puzzle de **Personajes** (arrastrar una pieza hasta su lugar — encastra
y navega), la pieza suelta en **Su Esencia**, la tele de **Trailers** (click para play),
el hover sobre el molino en **La Receta** (sonido), y la música por sección (♪ en la
columna derecha, rojo y azul tienen música, verde es silencio — así era el original).

## Estado

- [x] Fase 1 — Núcleo: splash sin PHP (reloj client-side con la Mistral), drag del
      puzzle reescrito con Pointer Events (mismas coordenadas de snap y tolerancia),
      UTF-8, fix de comentarios JS rotos de la fuente 2004, 55 páginas, 0 errores.
- [x] Fase 2 — Media: música extraída de los SWF a MP3, trailer .avi → mp4/webm
      reproduciendo inline en la tele, endiveau.wav y son_toi con Audio API.
- [x] Fase 3 — Upscale AI @2x: 415 imágenes (EDSR para gráficos chicos, FSRCNN para
      fotos grandes), transparencias GIF preservadas, originales en `site/.orig1x/`,
      manifest en `site/.upscaled.json`. Los 3 GIFs animados quedaron 1x.
- [x] Fase 4 — Escenario en `scene/index.html`: UNA foto (el close-up con el
      post-it "Amelie 7:30 Hoyts", elegida por pantalla más grande y frontal;
      servida @2x vía upscale para que el zoom no la muestre blanda). Click en
      la pantalla → zoom SUTIL (la iMac queda en cuadro, ~70% del ancho) → la
      ventana Safari 1.x se abre dentro de la pantalla de la propia foto, con
      el sitio adentro. Gema roja cierra la ventana (click en la pantalla la
      reabre), ESC o "alejarse" vuelve al plano inicial.
      Rect calibrado en SCREEN_RECT. `imac_wide.jpg` quedó en assets sin uso.
- [x] Mejoras de escena (aprobadas por Pablo, sin fallback mobile — "en 2004 no
      era una preocupación"): reflejo del vidrio + luz cálida sobre la ventana,
      gema verde = zoom (la ventana escala a viewport completo), post-it
      clickeable → abre Trailers vía deep-link (?p=&s= en los framesets),
      La Valse d'Amélie en loop bajito antes del zoom (fade out al entrar),
      caption "Proyecto de estudio · Escuela Da Vinci · 2004", URL y título
      vivos en el chrome (solo funciona same-origin: VERIFICAR en deploy,
      en file:// se omite silenciosamente), meta OG con assets/og.jpg.
      Trailer en ventana QuickTime propia sobre la escena (postMessage
      trailers.html→escena, con ack; sin escena cae a reproducir en la tele),
      arrastrable, ESC cierra por capas: QT → maxi → zoom.
- [x] Revisión de Pablo.
- [x] Fase 5 — Integración a LAB y deploy en `/amelie`.
- [ ] Idea pendiente: arranque con encendido.

## Estructura

- `site/` — el sitio reconstruido (estático, sin backend)
- `tools/build.py` — build idempotente desde la fuente (`DaVinci - Amelie/Backup/amelie`)
- `site/js/amelie-modern.js` — capa 2026: drag, sonidos, fixes
- `site/js/amelie-sound.js` — reemplazo del reproductor Flash
- `site/js/build_notes.md` — detalle de transformaciones

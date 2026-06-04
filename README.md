# Lab

Espacio de laboratorio de Pablo Zarate.

El índice es un **canvas de tarjetas con scroll vertical** (inspirado en la
estructura de rauno.me, con marca propia): una tarjeta Intro seguida de una
tarjeta por proyecto, que flotan en un mundo que una cámara panea por
`transform` (sin snap), con zoom-out por velocidad e intro con clip-reveal. Se
navega arrastrando, con rueda/flechas, o con el minimap lateral. Soporta
light/dark (sigue `prefers-color-scheme` por defecto, con un toggle en el footer
que persiste la elección).

## Agregar un proyecto

1. Creá la carpeta `<slug>` con su `page.tsx`.
2. Agregá una entrada al manifiesto `projects.ts`:

   ```ts
   { slug: "<slug>", title: "Título", year: 2026, kind: "Tipo" }
   ```

   Eso genera automáticamente la tarjeta, su número de índice y su línea en el
   minimap. `accent` (color por proyecto) y `href` (link externo, abre en pestaña
   nueva con ↗) son opcionales. El `slug` define la carpeta del proyecto.

## Estructura

- `page.tsx` — server component (metadata) que renderiza el canvas.
- `lab-canvas.tsx` — client: motor de cámara (rAF), drag/rueda/teclado, tema.
- `panel.tsx` — tarjeta Intro + tarjeta de proyecto.
- `minimap.tsx` — navegación lateral.
- `wordmark.tsx` — wordmark `PabloZarate™` con lineamientos RAMS.
- `projects.ts` — manifiesto (fuente única de proyectos).
- `lab.module.css` — tokens (light/dark), tarjetas, tipografía, overlays.

## Projects

- `shader-experiment-01`: interactive PabloZarate wordmark shader with
  RAMS-aligned dark-mode typography and visual effects.

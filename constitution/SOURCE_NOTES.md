# The Designer's Constitution

Static source of the essay published at https://constitution.design/.

- Plain HTML, CSS and classic scripts with relative paths.
  `index.html` holds the English text (served at `/`). `es/index.html` is the
  Spanish page (served at `/es`), generated from `index.html` by
  `node constitution/tools/build-es.mjs`, which also holds the Spanish copy;
  `--check` fails when it is out of date. Edit `index.html` or the tool, never
  the generated file.
- `assets/js/i18n.js` exposes the page language and the wheel labels, and
  stores an explicit EN/ES choice in the `pz-lang` cookie.
- The parent site serves a copy of this folder from `public/lab/constitution/`
  and maps the `constitution.design` host to it.
- Fonts are not part of this public repository. Timeless Text and Timeless
  Grotesk (Timeless Free Font License 1.2, which does not allow public
  redistribution) live only in the parent site's copy under
  `assets/fonts/`. The PabloZarate™ wordmark font is loaded from
  pablozarate.com.
- `assets/js/analytics.js` only runs on the production origin.

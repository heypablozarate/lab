(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduceMotion = motionPreference.matches;
  var still = /[?&](still|poster)\b/.test(location.search); // snapshot mode: no easing, no intro
  var posterMode = /[?&]poster\b/.test(location.search);

  var initialHash = location.hash;
  var entryInterrupted = false;
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (type) {
    window.addEventListener(type, function () { entryInterrupted = true; }, { passive: true, once: true });
  });
  function isDeepEntry() {
    return window.scrollY > window.innerHeight * 0.4 || (initialHash && initialHash !== '#top');
  }
  function settleInitialAnchor() {
    if (entryInterrupted || !initialHash || initialHash === '#top' || location.hash !== initialHash) return;
    var id;
    try { id = decodeURIComponent(initialHash.slice(1)); } catch (err) { return; }
    var anchor = document.getElementById(id);
    if (anchor) scrollToReadingAnchor(anchor, 'instant');
  }
  function scrollToReadingAnchor(anchor, behavior) {
    // Chapter sections include generous breathing room; land on the actual text.
    var content = anchor.querySelector('.panel-inner') || anchor;
    content.scrollIntoView({ block: 'start', behavior: behavior });
  }
  window.addEventListener('hashchange', function () {
    var id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (err) { return; }
    var anchor = document.getElementById(id);
    if (anchor) scrollToReadingAnchor(anchor, 'instant');
  });
  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest('a[href^="#"]');
    if (!link) return;
    var hash = link.getAttribute('href'), id;
    try { id = decodeURIComponent(hash.slice(1)); } catch (err) { return; }
    var anchor = document.getElementById(id);
    if (!anchor) return;
    event.preventDefault();
    if (location.hash !== hash) history.pushState(null, '', hash);
    scrollToReadingAnchor(anchor, reduceMotion || event.detail === 0 ? 'instant' : 'smooth');
  });

  function markReady() {
    root.classList.add('ready');
    // After the entrance, freeze the hero so a language switch doesn't replay it.
    if (still || reduceMotion || isDeepEntry()) root.classList.add('intro-done');
    else setTimeout(function () { root.classList.add('intro-done'); }, 4200);
  }
  function deg(d) { return d * Math.PI / 180; }
  function clamp01(x) { return Math.min(1, Math.max(0, x)); }
  function smoothstep(e0, e1, x) { var t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }

  // Ring geometry shared by the 3D model and the small-screen schematic.
  var RINGS = [
    { ri: 2.50, ro: 3.00 },
    { ri: 2.00, ro: 2.42, n: 6 },
    { ri: 1.36, ro: 1.92, n: 7 },
    { ri: 0.96, ro: 1.28 },
    { ri: 0, ro: 0.88 }
  ];

  // =====================================================================
  // Page chrome. Works with or without WebGL.
  // =====================================================================

  var verdicts = Array.prototype.slice.call(document.querySelectorAll('.verdict'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-state]'));
  var sectionMetrics = [], verdictMetrics = [];
  var scrollLayoutDirty = true, curtainFrame = 0;
  var lastCurtain = '';

  function measureScrollLayout() {
    if (!scrollLayoutDirty) return;
    // Read all geometry together, before any scroll-dependent style writes.
    var scrollY = window.scrollY;
    sectionMetrics = sections.map(function (el) {
      var rect = el.getBoundingClientRect();
      return { center: rect.top + scrollY + rect.height * 0.5, name: el.getAttribute('data-state') };
    });
    verdictMetrics = verdicts.map(function (el) {
      var rect = el.getBoundingClientRect();
      return { el: el, center: rect.top + scrollY + rect.height * 0.5, dark: el.classList.contains('verdict--dark'), value: '' };
    });
    scrollLayoutDirty = false;
  }
  function scheduleCurtain() {
    if (!curtainFrame) curtainFrame = requestAnimationFrame(function () { curtainFrame = 0; updateCurtain(); });
  }
  function invalidateScrollLayout() { scrollLayoutDirty = true; scheduleCurtain(); }
  function updateCurtain() {
    measureScrollLayout();
    var vh = window.innerHeight, center = window.scrollY + vh * 0.5, c = 0;
    verdictMetrics.forEach(function (v) {
      var d = Math.abs(v.center - center);
      var f = 1 - smoothstep(vh * 0.16, vh * 0.55, d);
      var value = f.toFixed(3);
      if (v.value !== value) {
        v.el.style.setProperty('--f', value);
        v.el.classList.toggle('is-full', f > 0.995);
        v.value = value;
      }
      if (v.dark) c = Math.max(c, 1 - smoothstep(vh * 0.3, vh * 0.8, d));
    });
    var curtain = (c * 0.97).toFixed(3);
    if (curtain !== lastCurtain) { root.style.setProperty('--curtain', curtain); lastCurtain = curtain; }
    root.classList.toggle('is-dark', c > 0.55);
    root.classList.toggle('scrolled', window.scrollY > vh * 0.4);
  }
  window.addEventListener('scroll', scheduleCurtain, { passive: true });
  window.addEventListener('resize', invalidateScrollLayout);
  window.addEventListener('pageshow', invalidateScrollLayout);
  if ('ResizeObserver' in window) {
    var layoutObserver = new ResizeObserver(invalidateScrollLayout);
    sections.forEach(function (el) { layoutObserver.observe(el); });
  }
  updateCurtain();

  // Full-screen lines: one size for all. Each starts at the shared measure and,
  // if it runs past the allowed number of lines, widens until it fits (or hits the page width).
  var verdictLines = Array.prototype.slice.call(document.querySelectorAll('.verdict-line'));
  function fitVerdicts() {
    var cs = getComputedStyle(root);
    var maxLines = parseInt(cs.getPropertyValue('--verdict-lines'), 10) || 3;
    verdictLines.forEach(function (el) {
      el.style.maxWidth = '';
      el.style.fontSize = '';
      var st = getComputedStyle(el);
      var lh = parseFloat(st.lineHeight) || parseFloat(st.fontSize);
      var pad = parseFloat(st.paddingBottom) || 0;
      // Leave room for the ring rail on wide screens.
      var rail = document.querySelector('.rail');
      var limit = el.parentNode.clientWidth;
      if (rail && window.innerWidth > 820) {
        limit = Math.min(limit, 2 * (rail.getBoundingClientRect().left - 32 - window.innerWidth / 2));
      }
      if (el.offsetWidth > limit) el.style.maxWidth = limit + 'px';
      var w = Math.min(el.offsetWidth, limit);
      var lines = function () { return Math.round((el.offsetHeight - pad) / lh); };
      var guard = 0;
      while (lines() > maxLines && w < limit && guard++ < 60) {
        w = Math.min(limit, w + parseFloat(st.fontSize) * 0.5);
        el.style.maxWidth = w + 'px';
      }
      // Last resort: at full width and still too long, the line shrinks until it fits.
      var base = parseFloat(st.fontSize), f = 1;
      while (lines() > maxLines && f > 0.6) {
        f -= 0.02;
        el.style.fontSize = (base * f) + 'px';
        lh = parseFloat(getComputedStyle(el).lineHeight);
        pad = parseFloat(getComputedStyle(el).paddingBottom) || 0;
      }
      el.dataset.fit = f < 1 ? Math.round(f * 100) + '%' : '';
    });
    invalidateScrollLayout();
  }
  window.PZFitVerdicts = fitVerdicts;
  fitVerdicts();
  var resizeFrame = 0, lastFitWidth = window.innerWidth;
  window.addEventListener('resize', function () {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(function () {
      resizeFrame = 0;
      // Mobile browser chrome changes height repeatedly without changing type.
      if (lastFitWidth !== window.innerWidth) { fitVerdicts(); lastFitWidth = window.innerWidth; }
      if (renderer && STATES) resize();
      if (io && !reduceMotion) observeReveals();
    });
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitVerdicts(); settleInitialAnchor(); });
  if (window.PZLang) window.PZLang.onChange(function () { requestAnimationFrame(fitVerdicts); });

  // Text reveal as each section crosses the middle of the screen.
  var revealables = Array.prototype.slice.call(document.querySelectorAll('.panel, .finale, .foot'));
  if (still || reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    observeReveals();
  }
  var io;
  function observeReveals() {
    if (io) io.disconnect();
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { (e.target.closest('.panel') || e.target).classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -' + Math.round(window.innerHeight * 0.12) + 'px 0px' });
    revealables.forEach(function (el) {
      if (!el.classList.contains('is-in')) io.observe(el.querySelector('.panel-inner') || el);
    });
  }

  motionPreference.addEventListener('change', function (event) {
    reduceMotion = event.matches;
    if (reduceMotion) {
      revealables.forEach(function (el) { el.classList.add('is-in'); });
      if (io) io.disconnect();
      root.classList.add('intro-done');
      INTRO = 0;
    }
  });

  // Hover state shared by the list, the schematic and the wheel.
  var items = Array.prototype.slice.call(document.querySelectorAll('.item'));
  var hovered = null; // { layer, seg, fromCanvas }
  var hoverListeners = [];

  function setHover(h) {
    hovered = h;
    items.forEach(function (el) {
      var on = !!h && +el.dataset.layer === h.layer && +el.dataset.seg === h.seg;
      el.classList.toggle('is-active', on);
    });
    hoverListeners.forEach(function (fn) { fn(h); });
  }

  items.forEach(function (el) {
    var h = { layer: +el.dataset.layer, seg: +el.dataset.seg };
    el.addEventListener('mouseenter', function () { setHover(h); });
    el.addEventListener('mouseleave', function () { setHover(null); });
    el.addEventListener('focus', function () { setHover(h); });
    el.addEventListener('blur', function () { setHover(null); });
  });

  // Small-screen schematic: a flat drawing of the wheel at the top of each chapter card.
  (function buildMinis() {
    var NS = 'http://www.w3.org/2000/svg';
    function pt(r, t) { return [(r * Math.sin(deg(t))).toFixed(3), (-r * Math.cos(deg(t))).toFixed(3)]; }
    function sector(ri, ro, t0, t1) {
      var large = (t1 - t0) > 180 ? 1 : 0;
      var a = pt(ro, t0), b = pt(ro, t1);
      if (ri <= 0) return 'M0 0 L' + a + ' A' + ro + ' ' + ro + ' 0 ' + large + ' 1 ' + b + ' Z';
      var c = pt(ri, t1), d = pt(ri, t0);
      return 'M' + a + ' A' + ro + ' ' + ro + ' 0 ' + large + ' 1 ' + b + ' L' + c + ' A' + ri + ' ' + ri + ' 0 ' + large + ' 0 ' + d + ' Z';
    }
    function segsFor(li) {
      var ring = RINGS[li], out = [];
      var n = li === 0 ? 2 : li === 3 ? 3 : ring.n || 1;
      var start = li === 0 ? -90 : 0;
      if (li === 4) return [{ d: sector(0, ring.ro, 0, 359.99), seg: -1 }];
      var span = 360 / n, gap = 2.2;
      for (var i = 0; i < n; i++) {
        var c = start + (li === 0 ? span / 2 : 0) + i * span;
        if (li === 0) c = i === 0 ? 0 : 180;
        out.push({ d: sector(ring.ri, ring.ro, c - span / 2 + gap / 2, c + span / 2 - gap / 2), seg: i });
      }
      return out;
    }
    document.querySelectorAll('.chapter').forEach(function (sec) {
      var active = +sec.dataset.chapter;
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'mini');
      svg.setAttribute('viewBox', '-3.1 -3.1 6.2 6.2');
      svg.setAttribute('aria-hidden', 'true');
      RINGS.forEach(function (ring, li) {
        var g = document.createElementNS(NS, 'g');
        if (li === active) g.setAttribute('class', 'is-ring');
        segsFor(li).forEach(function (s) {
          var p = document.createElementNS(NS, 'path');
          p.setAttribute('d', s.d);
          p.dataset.seg = s.seg;
          p.setAttribute('vector-effect', 'non-scaling-stroke');
          g.appendChild(p);
        });
        svg.appendChild(g);
      });
      var inner = sec.querySelector('.panel-inner');
      inner.insertBefore(svg, inner.firstChild);
      hoverListeners.push(function (h) {
        var ring = svg.querySelector('.is-ring');
        Array.prototype.forEach.call(ring.querySelectorAll('path'), function (p) {
          var on = !!h && h.layer === active && (+p.dataset.seg === h.seg || +p.dataset.seg === -1);
          p.classList.toggle('is-hot', on);
        });
      });
    });
  })();

  // =====================================================================
  // The wheel
  // =====================================================================

  var THREE = window.THREE;
  if (!THREE) { root.classList.add('no-webgl'); markReady(); return; }

  var canvas = document.getElementById('stage');
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (err) {
    root.classList.add('no-webgl'); markReady(); return;
  }

  var PAPER = '#e9e9e6';
  var INK = '#262626';
  var MUTED = '#6a6a66';
  var ACCENT = '#ff460c';
  var SANS = '"Timeless Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif';
  var DISPLAY = SANS;
  var SERIF = '"Timeless Text",Georgia,serif';

  function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER); // clear color is written as-is, so it matches the page

  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  // ---------- Model definition ----------
  // Angles: theta in degrees, clockwise from the far side of the wheel ("north").

  var LAYERS = [
    { key: 'ground', tint: '#f5f8f7', dist: 4.55, depth: 0.12 },
    { key: 'studies', tint: '#f5f8f7', dist: 4.55, depth: 0.12,
      segs: ['Representation', 'People', 'Limits', 'Space, time and interaction', 'Systems', 'Agents'] },
    { key: 'materials', tint: '#f5f8f7', dist: 4.55, depth: 0.14,
      segs: ['Distribution', 'Data', 'Code', 'Interface', 'Motion', 'Models', 'Language'] },
    { key: 'core', tint: '#ff9a6e', dist: 1.1, base: '#ffe3d6', depth: 0.14 },
    { key: 'build', tint: '#ff5a1f', dist: 0.55, base: '#ff7a45', depth: 0.24 }
  ];
  LAYERS.forEach(function (l, i) { l.ri = RINGS[i].ri; l.ro = RINGS[i].ro; });
  var STACK_GAP = 0.8;
  var BEVEL_T = 0.025;
  var SEG_GAP = 0.09;

  function sectorGeometry(ri, ro, a0, a1, depth) {
    var shape = new THREE.Shape();
    var full = (a1 - a0) >= Math.PI * 2 - 1e-4;
    if (full) {
      shape.absarc(0, 0, ro, 0, Math.PI * 2, false);
      if (ri > 0) {
        var hole = new THREE.Path();
        hole.absarc(0, 0, ri, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
    } else {
      shape.absarc(0, 0, ro, a0, a1, false);
      shape.absarc(0, 0, ri, a1, a0, true);
    }
    var geo = new THREE.ExtrudeGeometry(shape, {
      depth: depth,
      bevelEnabled: true,
      bevelThickness: BEVEL_T,
      bevelSize: 0.018,
      bevelSegments: 4,
      curveSegments: full ? 160 : 64
    });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  // Optional geometry authored in Blender. The local preview loads a classic
  // script before this file and exposes evaluated, axis-converted meshes as
  // window.PZBlenderRings. Everything around the geometry (groups, materials,
  // labels, picking and scroll choreography) remains owned by this runtime.
  var blenderRingMeshes = Object.create(null);
  if (window.PZBlenderRings && window.PZBlenderRings.version === 1 && Array.isArray(window.PZBlenderRings.meshes)) {
    window.PZBlenderRings.meshes.forEach(function (mesh) {
      if (!mesh || !Array.isArray(mesh.positions) || mesh.positions.length < 9) return;
      blenderRingMeshes[mesh.layer + ':' + mesh.seg] = mesh;
    });
  }

  function blenderGeometry(li, seg) {
    var source = blenderRingMeshes[li + ':' + seg];
    if (!source) return null;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(source.positions, 3));
    if (Array.isArray(source.indices) && source.indices.length >= 3) geo.setIndex(source.indices);
    if (Array.isArray(source.normals) && source.normals.length === source.positions.length) {
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(source.normals, 3));
    } else {
      geo.computeVertexNormals();
    }
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    geo.userData.sourceName = source.name || ('ring-' + li + '-segment-' + seg);
    return geo;
  }

  function ringGeometry(li, seg, ri, ro, a0, a1, depth) {
    return blenderGeometry(li, seg) || sectorGeometry(ri, ro, a0, a1, depth);
  }

  // Cycles appearance, projected onto the original 3D pieces from five views.
  // The original Blender camera has shift_y = -0.055 (UV centre y = 0.555).
  // Geometry, camera motion, picking and layer separation remain live WebGL.
  var opticViews = [[0, 8, 8], [8, 8, 0], [0, 8, -8], [-8, 8, 0], [0, 11.3, 0.001]];
  var opticNames = ['front', 'right', 'back', 'left', 'top'];
  var opticMatrices = [], opticDirections = [], opticTextures = [];
  var assetBase = new URL('../optics/', document.querySelector('script[src*="assets/js/main.js"]').src);
  var opticsReady = [];
  var opticSpans = [6.5, 5.34, 4.34, 3.04, 2.24];
  opticViews.forEach(function (position) {
    opticDirections.push(new THREE.Vector3().fromArray(position).sub(new THREE.Vector3(0, 0.1, 0)).normalize());
  });
  LAYERS.forEach(function (layer, li) {
    opticMatrices[li] = opticViews.map(function (position) {
      var half = opticSpans[li] / 2;
      var probeCamera = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, 100);
      probeCamera.position.fromArray(position); probeCamera.lookAt(0, 0.1, 0);
      probeCamera.updateMatrixWorld(true);
      return new THREE.Matrix4().multiplyMatrices(probeCamera.projectionMatrix, probeCamera.matrixWorldInverse);
    });
    opticTextures[li] = opticNames.map(function (name) {
      var texture;
      opticsReady.push(new Promise(function (resolve, reject) {
        texture = new THREE.TextureLoader().load(new URL(li + '-' + name + '.jpg', assetBase).href, resolve, undefined, reject);
      }));
      texture.encoding = THREE.sRGBEncoding;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      return texture;
    });
  });
  function acrylic() {
    var material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, depthWrite: false, side: THREE.FrontSide });
    material.roughness = 0.1;
    return material;
  }

  function bindOptics(mesh, li) {
    var material = mesh.material;
    // Compose each layer before its labels and the next layer above it.
    mesh.renderOrder = 10 + li * 3;
    material.onBeforeCompile = function (shader) {
      shader.uniforms.opticFocus = { value: 1 };
      shader.uniforms.opticHover = { value: 0 };
      shader.uniforms.opticCoral = { value: lin(ACCENT) };
      shader.uniforms.opticEye = { value: mesh.worldToLocal(camera.position.clone()) };
      for (var i = 0; i < 5; i++) {
        shader.uniforms['opticMap' + i] = { value: opticTextures[li][i] };
        shader.uniforms['opticMatrix' + i] = { value: opticMatrices[li][i] };
        shader.uniforms['opticDirection' + i] = { value: opticDirections[i] };
      }
      material.userData.shader = shader;
      var varyings = 'varying vec3 opticPosition; varying vec3 opticNormal; varying vec4 opticUV01; varying vec4 opticUV23; varying vec2 opticUV4;\n';
      var vertexDeclarations = varyings;
      var projection = '#include <begin_vertex>\nopticPosition = position; opticNormal = normal;\n';
      var declarations = varyings + 'uniform vec3 opticEye; uniform float opticFocus; uniform float opticHover; uniform vec3 opticCoral;\n';
      var blend = 'vec3 opticView = normalize(opticEye - opticPosition); vec3 opticN = normalize(opticNormal); vec3 baked = vec3(0.0); float total = 0.0;\n';
      var uvNames = ['opticUV01.xy', 'opticUV01.zw', 'opticUV23.xy', 'opticUV23.zw', 'opticUV4'];
      for (var j = 0; j < 5; j++) {
        vertexDeclarations += 'uniform mat4 opticMatrix' + j + ';\n';
        projection += uvNames[j] + ' = (opticMatrix' + j + ' * vec4(position, 1.0)).xy * 0.5 + vec2(0.5, 0.555);\n';
        declarations += 'uniform sampler2D opticMap' + j + '; uniform vec3 opticDirection' + j + ';\n';
        blend += 'float w' + j + ' = pow(max(dot(opticView, opticDirection' + j + '), 0.01), 12.0) * smoothstep(0.0, 0.2, dot(opticN, opticDirection' + j + '));\n' +
          'vec3 c' + j + ' = texture2D(opticMap' + j + ', ' + uvNames[j] + ').rgb;\n' +
          'baked += c' + j + ' * w' + j + '; total += w' + j + ';\n';
      }
      // Views above the model cannot illuminate an underside; retain that
      // layer's baked colour, darkened, instead of a generic grey substitute.
      blend += 'baked = total > 0.00001 ? baked / total : c4 * 0.86;\n' +
        'baked = min(vec3(1.0), baked * 1.16 + vec3(0.025));\n' +
        'float fresnel = pow(1.0 - clamp(dot(opticN, opticView), 0.0, 1.0), 2.0);\n' +
        'outgoingLight = mix(vec3(0.76), baked, opticFocus);\n' +
        'outgoingLight *= mix(vec3(1.0), opticCoral, 0.28 * opticHover);\n' +
        'diffuseColor.a *= mix(0.62, 0.88, fresnel);\n#include <output_fragment>';
      shader.vertexShader = vertexDeclarations + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', projection);
      shader.fragmentShader = declarations + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', blend);
    };
    var eye = new THREE.Vector3();
    var hoverTint = 0, lastTintTime = performance.now();
    mesh.onBeforeRender = function () {
      var now = performance.now();
      var tintTarget = hovered && hovered.layer === li && hovered.seg === mesh.userData.seg && LAYERS[li].segs ? 1 : 0;
      hoverTint += (tintTarget - hoverTint) * (reduceMotion ? 1 : 1 - Math.exp(-Math.min(now - lastTintTime, 100) / 90));
      lastTintTime = now;
      var shader = material.userData.shader;
      if (shader) {
        shader.uniforms.opticHover.value = hoverTint;
        eye.copy(camera.position); mesh.worldToLocal(eye);
        shader.uniforms.opticEye.value.copy(eye);
        shader.uniforms.opticFocus.value = 0.5 + 0.5 * clamp01((0.6 - material.roughness) / 0.5);
      }
    };
  }

  // ---------- Generated textures ----------

  var PX = 560; // texture pixels per world unit

  function makeCanvas(size) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }

  function canvasTexture(c) {
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.needsUpdate = true;
    return t;
  }

  // Text that follows a circle. Upper half reads clockwise, lower half is flipped so it stays upright.
  function arcText(ctx, text, cx, cy, r, thetaDeg, fontPx, font, color, spacing) {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var chars = Array.from(text);
    var sp = spacing || 0;
    var widths = chars.map(function (ch) { return ctx.measureText(ch).width; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + sp * (chars.length - 1);
    var theta = deg(thetaDeg);
    var flip = Math.cos(theta) < -0.15;
    var span = total / r;
    var acc = 0;
    for (var i = 0; i < chars.length; i++) {
      var w = widths[i];
      var a = flip ? theta + span / 2 - (acc + w / 2) / r : theta - span / 2 + (acc + w / 2) / r;
      var x = cx + r * Math.sin(a);
      var y = cy - r * Math.cos(a);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(flip ? a + Math.PI : a);
      ctx.fillText(chars[i], 0, 0);
      ctx.restore();
      acc += w + sp;
    }
    ctx.restore();
  }

  function words() {
    return window.PZLang ? window.PZLang.wheel() : null;
  }

  function labelTexture(layer) {
    var W = words();
    var span = layer.ro * 2 + 0.2;
    var size = Math.min(4096, Math.ceil(span * PX));
    var px = size / span;
    var c = makeCanvas(size);
    var ctx = c.getContext('2d');
    var cx = size / 2, cy = size / 2;
    var mid = (layer.ri + layer.ro) / 2 * px;

    var labelScale = 1.12;
    function sans(sizeU, weight) { return (weight || 500) + ' ' + Math.round(sizeU * labelScale * px) + 'px ' + SANS; }

    if (layer.key === 'ground') {
      var gw = W ? W.ground : ['Foundations of form', 'Composition, color, typography, time', 'Conscious praxis', 'Design sense, judgment, craft'];
      arcText(ctx, gw[0], cx, cy, 2.83 * px, 0, 0, sans(0.118), INK, 0.012 * px);
      arcText(ctx, gw[1], cx, cy, 2.64 * px, 0, 0, sans(0.072, 400), MUTED, 0.006 * px);
      arcText(ctx, gw[2], cx, cy, 2.67 * px, 180, 0, sans(0.118), INK, 0.012 * px);
      arcText(ctx, gw[3], cx, cy, 2.86 * px, 180, 0, sans(0.072, 400), MUTED, 0.006 * px);
    } else if (layer.segs) {
      var segs = W ? W[layer.key] : layer.segs;
      var n = segs.length;
      segs.forEach(function (name, i) {
        var fs = name.length > 18 ? 0.082 : 0.105;
        arcText(ctx, name, cx, cy, mid, i * 360 / n, 0, sans(fs), INK, 0.008 * px);
      });
    } else if (layer.key === 'core') {
      (W ? W.core : ['Vision', 'Trust', 'Responsibility']).forEach(function (name, i) {
        arcText(ctx, name, cx, cy, mid, i * 120, 0, sans(0.09), '#3a1a0e', 0.008 * px);
      });
    } else if (layer.key === 'build') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#2a0f05';
      var bw = W ? W.build : 'Build';
      ctx.font = '400 ' + Math.round((bw.length > 6 ? 0.25 : 0.36) * 1.05 * px) + 'px ' + SERIF;
      ctx.fillText(bw, cx, cy - 0.12 * px);
      ctx.font = sans(0.064, 500);
      ctx.fillStyle = '#3a1a0e';
      (W ? W.answers : ['What and why', 'How it works', 'How it fails', 'How it runs']).forEach(function (t, i) {
        ctx.fillText(t, cx, cy + (0.08 + i * 0.1) * px);
      });
    }
    return { tex: canvasTexture(c), span: span };
  }

  function blueprintTexture(span) {
    var size = 3072;
    var px = size / span;
    var c = makeCanvas(size);
    var ctx = c.getContext('2d');
    var cx = size / 2, cy = size / 2;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, size, size);

    // Soft contact shadows remain visible through the translucent layers.
    RINGS.forEach(function (ring, li) {
      var rr = (ring.ri + ring.ro) * 0.5 * px;
      ctx.strokeStyle = li === 4 ? 'rgba(106,37,16,0.08)' : 'rgba(34,34,32,0.07)';
      ctx.lineWidth = (ring.ro - ring.ri + 0.06) * px;
      ctx.filter = 'blur(' + (0.055 * px) + 'px)';
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.filter = 'none';
    return canvasTexture(c);
  }

  // Gropius's 1922 scheme, redrawn in line with its original German labels, sized to sit under the wheel.
  function gropiusTexture(span) {
    var size = 4096;
    var px = size / span;
    var c = makeCanvas(size);
    var ctx = c.getContext('2d');
    var cx = size / 2, cy = size / 2;
    var ink = 'rgba(30,30,28,0.9)';
    function heavy(u) { return '700 ' + Math.round(u * px) + 'px ' + DISPLAY; }
    function circle(r, w) { ctx.lineWidth = w; ctx.beginPath(); ctx.arc(cx, cy, r * px, 0, Math.PI * 2); ctx.stroke(); }
    function radial(t, r0, r1, w) {
      var a = deg(t);
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(cx + r0 * px * Math.sin(a), cy - r0 * px * Math.cos(a));
      ctx.lineTo(cx + r1 * px * Math.sin(a), cy - r1 * px * Math.cos(a));
      ctx.stroke();
    }

    ctx.strokeStyle = ink;
    circle(3.0, 9); circle(2.5, 6); circle(2.0, 6); circle(1.36, 6); circle(1.3, 3);
    [0, 70, 145, 215, 290].forEach(function (t) { radial(t, 2.0, 2.5, 5); });
    for (var k = 0; k < 7; k++) radial(k * 360 / 7, 1.36, 2.0, 5);
    radial(0, 2.5, 3.0, 5);

    var sp = 0.012 * px;
    arcText(ctx, 'VORLEHRE', cx, cy, 2.75 * px, 305, 0, heavy(0.22), ink, 0.02 * px);
    arcText(ctx, 'VORLEHRE', cx, cy, 2.75 * px, 55, 0, heavy(0.22), ink, 0.02 * px);
    arcText(ctx, 'ELEMENTARE FORMLEHRE', cx, cy, 2.64 * px, 180, 0, heavy(0.105), ink, sp);
    arcText(ctx, 'MATERIESTUDIEN IN DER VORWERKSTATT', cx, cy, 2.86 * px, 180, 0, heavy(0.095), ink, sp);
    arcText(ctx, '½ JAHR', cx, cy, 2.75 * px, 10, 0, heavy(0.07), ink, sp);
    arcText(ctx, '3 JAHRE', cx, cy, 2.25 * px, 10, 0, heavy(0.07), ink, sp);

    arcText(ctx, 'MATERIAL- UND', cx, cy, 2.36 * px, 325, 0, heavy(0.08), ink, sp);
    arcText(ctx, 'WERKZEUGLEHRE', cx, cy, 2.16 * px, 325, 0, heavy(0.08), ink, sp);
    arcText(ctx, 'NATURSTUDIUM', cx, cy, 2.25 * px, 38, 0, heavy(0.09), ink, sp);
    arcText(ctx, 'LEHRE VON DEN STOFFEN', cx, cy, 2.25 * px, 107, 0, heavy(0.085), ink, sp);
    arcText(ctx, 'RAUMLEHRE · FARBLEHRE', cx, cy, 2.16 * px, 180, 0, heavy(0.08), ink, sp);
    arcText(ctx, 'KOMPOSITIONSLEHRE', cx, cy, 2.36 * px, 180, 0, heavy(0.08), ink, sp);
    arcText(ctx, 'LEHRE DER KONSTRUKTIONEN', cx, cy, 2.36 * px, 252, 0, heavy(0.075), ink, sp);
    arcText(ctx, 'UND DER DARSTELLUNG', cx, cy, 2.16 * px, 252, 0, heavy(0.075), ink, sp);

    ['STEIN', 'HOLZ', 'METALL', 'GEWEBE', 'FARBE', 'GLAS', 'TON'].forEach(function (w, i) {
      arcText(ctx, w, cx, cy, 1.68 * px, -360 / 14 + i * 360 / 7 + (i === 0 ? 0 : 0), 0, heavy(0.2), ink, 0.016 * px);
    });

    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = heavy(0.36);
    ctx.fillText('BAU', cx, cy - 0.3 * px);
    ctx.font = heavy(0.085);
    ['BAUPLATZ', 'VERSUCHSPLATZ', 'ENTWURF', 'BAU U. INGENIEURWISSEN'].forEach(function (t, i) {
      ctx.fillText(t, cx, cy + (-0.06 + i * 0.13) * px);
    });
    return canvasTexture(c);
  }

  function shadowTexture() {
    var size = 512;
    var c = makeCanvas(size);
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(30,30,28,0.14)');
    g.addColorStop(0.55, 'rgba(30,30,28,0.07)');
    g.addColorStop(1, 'rgba(30,30,28,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return canvasTexture(c);
  }

  // ---------- Build the wheel ----------

  var wheel = new THREE.Group();
  scene.add(wheel);

  var pickables = [];
  var drawing;

  function buildScene() {
    var BP = 9.6;
    var plate = new THREE.Mesh(
      new THREE.PlaneGeometry(BP, BP),
      new THREE.MeshBasicMaterial({ map: blueprintTexture(BP), toneMapped: false })
    );
    // Redraw every label when the reader switches language.
    if (window.PZLang) window.PZLang.onChange(function () {
      var old = plate.material.map;
      plate.material.map = blueprintTexture(BP); plate.material.needsUpdate = true; old.dispose();
      LAYERS.forEach(function (layer) {
        if (!layer.label) return;
        var prev = layer.label.material.map;
        layer.label.material.map = labelTexture(layer).tex;
        layer.label.material.needsUpdate = true;
        prev.dispose();
      });
    });
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = -0.08;
    plate.material.transparent = true;
    wheel.add(plate);
    wheel.userData.plate = plate;

    var GS = 6.4;
    drawing = new THREE.Mesh(
      new THREE.PlaneGeometry(GS, GS),
      new THREE.MeshBasicMaterial({ map: gropiusTexture(GS), transparent: true, opacity: 0, depthWrite: false, toneMapped: false })
    );
    drawing.rotation.x = -Math.PI / 2;
    drawing.position.y = -0.072;
    drawing.renderOrder = 1;
    wheel.add(drawing);

    var shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(7.6, 7.6),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, toneMapped: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.075;
    wheel.add(shadow);
    wheel.userData.shadow = shadow;

    LAYERS.forEach(function (layer, li) {
      var g = new THREE.Group();
      layer.group = g;
      layer.meshes = [];
      layer.lift = [];
      layer.liftTarget = [];

      if (layer.segs) {
        var n = layer.segs.length;
        var mid = (layer.ri + layer.ro) / 2;
        var half = Math.PI / n - (SEG_GAP / 2) / mid;
        for (var i = 0; i < n; i++) {
          var th = deg(i * 360 / n);
          var a0 = Math.PI / 2 - (th + half);
          var a1 = Math.PI / 2 - (th - half);
          var m = new THREE.Mesh(ringGeometry(li, i, layer.ri, layer.ro, a0, a1, layer.depth), acrylic());
          m.userData = { layer: li, seg: i };
          g.add(m);
          layer.meshes.push(m);
          layer.lift.push(0); layer.liftTarget.push(0);
          pickables.push(m);
        }
      } else {
        var mesh = new THREE.Mesh(ringGeometry(li, -1, layer.ri, layer.ro, 0, Math.PI * 2, layer.depth), acrylic());
        mesh.userData = { layer: li, seg: -1 };
        g.add(mesh);
        layer.meshes.push(mesh);
        layer.lift.push(0); layer.liftTarget.push(0);
        pickables.push(mesh);
      }

      layer.meshes.forEach(function (mesh) { bindOptics(mesh, li); });
      var lt = labelTexture(layer);
      var label = new THREE.Mesh(
        new THREE.PlaneGeometry(lt.span, lt.span),
        new THREE.MeshBasicMaterial({ map: lt.tex, transparent: true, depthWrite: false, toneMapped: false })
      );
      label.rotation.x = -Math.PI / 2;
      label.position.y = layer.depth + BEVEL_T + 0.004;
      label.renderOrder = 11 + li * 3;
      g.add(label);
      layer.label = label;

      wheel.add(g);
    });
  }

  // ---------- Scroll states ----------

  function S(o) {
    return {
      cam: o.cam, tgt: o.tgt, tilt: o.tilt || 0, gx: o.gx || 0, /* gx: offset as a fraction of the visible width */ explode: o.explode || 0,
      spin: o.spin === undefined ? 0 : o.spin,
      focus: o.focus || [1, 1, 1, 1, 1],
      gropius: o.gropius || 0, lift: o.lift || 0, mark: o.mark || 0
    };
  }

  function chapterState(i, mobile) {
    var focus = [0, 0, 0, 0, 0]; focus[i] = 1;
    var y = i * STACK_GAP;
    var D = [17.5, 14.2, 11.4, 9.0, 7.6][i] * (mobile ? 1.3 : 1);
    var el = deg(mobile ? 52 : 44);
    var tgtY = mobile ? y - 0.35 * D * 0.2 : y + 0.05;
    return S({
      cam: [0, tgtY + D * Math.sin(el), D * Math.cos(el)],
      tgt: [0, tgtY, mobile ? -D * 0.12 : 0],
      // Build changes only the viewing angle; retain the original camera path.
      tilt: i === 4 ? deg(mobile ? 65 : 70) - Math.atan2(D * Math.sin(el), D * Math.cos(el) + (mobile ? D * 0.12 : 0)) : 0,
      gx: mobile ? 0 : -0.245, explode: 1, focus: focus
    });
  }

  function statesFor(mobile) {
    var s = {};
    if (mobile) {
      s.hero = S({ cam: [0, 12.5, 14.5], tgt: [0, 3.9, 0], spin: 1 });
      s.thesis = S({ cam: [0, 13.5, 6.5], tgt: [0, 0, -2.2], spin: 0.6 });
      s.macro = S({ cam: [2.2, 2.2, 6.4], tgt: [0.4, 0.1, -1.0], spin: 0.35 });
      s.origin = S({ cam: [0, 16.5, 1.0], tgt: [0, 0, -2.7], gropius: 1, lift: 1 });
      s.land = S({ cam: [0, 15.5, 2.2], tgt: [0, 0, -2.6], gropius: 0.45 });
      s.assembled = S({ cam: [0, 11.5, 13.0], tgt: [0, 3.2, 0], spin: 0.25, mark: 1, gropius: 0.12 });
      s.closing = S({ cam: [0, 13.5, 6.5], tgt: [0, 0, -2.2], spin: 1 });
      s.final = S({ cam: [0, 9.5, 9.5], tgt: [0, 0, -2.4], spin: 1 });
      s.foot = S({ cam: [0, 12.5, 14.5], tgt: [0, 3.9, 0], spin: 1 });
    } else {
      s.hero = S({ cam: [0, 6.9, 9.6], tgt: [0, 3.25, 0], spin: 1 });
      s.thesis = S({ cam: [0, 8.2, 7.2], tgt: [0, 0, 0], gx: 0.29, spin: 0.6 });
      s.macro = S({ cam: [2.4, 0.75, 5.2], tgt: [0.6, 0.55, 0.9], gx: 0.34, spin: 0.35 });
      s.origin = S({ cam: [0, 11.8, 0.9], tgt: [0, 0, 0], gx: 0.32, gropius: 1, lift: 1 });
      s.land = S({ cam: [0, 10.2, 3.9], tgt: [0, 0, 0], gx: 0.32, gropius: 0.45 });
      s.assembled = S({ cam: [0, 8.4, 7.4], tgt: [0, 2.3, 0], spin: 0.25, mark: 1, gropius: 0.12 });
      s.closing = S({ cam: [0, 8.2, 7.2], tgt: [0, 0, 0], gx: 0.29, spin: 1 });
      s.final = S({ cam: [0, 4.4, 8.8], tgt: [0, 0.35, 0], gx: 0.26, spin: 1 });
      s.foot = S({ cam: [0, 6.9, 9.6], tgt: [0, 3.25, 0], spin: 1 });
    }
    for (var i = 0; i < 5; i++) s['ring' + i] = chapterState(i, mobile);
    // Tuning aid: ?tune=state&cam=x,y,z&tgt=x,y,z&gx=n overrides one state.
    var q = new URLSearchParams(location.search);
    if (q.get('tune') && s[q.get('tune')]) {
      var st = s[q.get('tune')];
      if (q.get('cam')) st.cam = q.get('cam').split(',').map(Number);
      if (q.get('tgt')) st.tgt = q.get('tgt').split(',').map(Number);
      if (q.get('gx')) st.gx = +q.get('gx');
    }
    s.poster = S({ cam: [0, 8.6, 8.4], tgt: [0, 0.15, 0], spin: 0 });
    return s;
  }

  function mixArr(a, b, t) { return a.map(function (v, i) { return v + (b[i] - v) * t; }); }
  function mixState(a, b, t) {
    return {
      cam: mixArr(a.cam, b.cam, t), tgt: mixArr(a.tgt, b.tgt, t),
      tilt: a.tilt + (b.tilt - a.tilt) * t,
      gx: a.gx + (b.gx - a.gx) * t, explode: a.explode + (b.explode - a.explode) * t,
      spin: a.spin + (b.spin - a.spin) * t, focus: mixArr(a.focus, b.focus, t),
      gropius: a.gropius + (b.gropius - a.gropius) * t,
      lift: a.lift + (b.lift - a.lift) * t,
      mark: a.mark + (b.mark - a.mark) * t
    };
  }
  function cloneState(s) { return mixState(s, s, 0); }

  var mobile = false;
  var STATES = statesFor(false);

  function targetFromScroll() {
    if (posterMode) return { state: STATES.poster, index: 0, t: 0 };
    measureScrollLayout();
    var center = window.scrollY + window.innerHeight * 0.5;
    if (center <= sectionMetrics[0].center) return { state: STATES[sectionMetrics[0].name], index: 0, t: 0 };
    for (var i = 0; i < sectionMetrics.length - 1; i++) {
      var a = sectionMetrics[i], b = sectionMetrics[i + 1];
      if (center < b.center) {
        var raw = (center - a.center) / (b.center - a.center);
        var t = reduceMotion ? (raw < 0.5 ? 0 : 1) : smoothstep(0.22, 0.78, raw);
        return { state: mixState(STATES[a.name], STATES[b.name], t), index: raw < 0.5 ? i : i + 1, t: t };
      }
    }
    var last = sectionMetrics.length - 1;
    return { state: STATES[sectionMetrics[last].name], index: last, t: 0 };
  }

  // ---------- Interaction ----------

  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2();
  var pointerIn = false;
  var parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  var activeChapter = -1;

  canvas.addEventListener('pointermove', function (e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    pointerIn = true;
  });
  canvas.addEventListener('pointerleave', function () { pointerIn = false; if (hovered && hovered.fromCanvas) setHover(null); });
  window.addEventListener('pointermove', function (e) {
    parallax.tx = (e.clientX / window.innerWidth - 0.5);
    parallax.ty = (e.clientY / window.innerHeight - 0.5);
  });

  function pickFromCanvas() {
    if (!pointerIn || activeChapter < 1 || activeChapter > 2) return;
    raycaster.setFromCamera(pointer, camera);
    var hit = raycaster.intersectObjects(LAYERS[activeChapter].meshes, false)[0];
    if (hit) {
      var u = hit.object.userData;
      if (!hovered || hovered.layer !== u.layer || hovered.seg !== u.seg) {
        setHover({ layer: u.layer, seg: u.seg, fromCanvas: true });
      }
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = '';
      if (hovered && hovered.fromCanvas) setHover(null);
    }
  }

  canvas.addEventListener('click', function () {
    if (!hovered || !hovered.fromCanvas) return;
    var el = items.filter(function (it) { return +it.dataset.layer === hovered.layer && +it.dataset.seg === hovered.seg; })[0];
    if (el) el.focus({ preventScroll: true });
  });

  // ---------- Rail ----------

  var rail = document.querySelector('.rail');
  var railLinks = Array.prototype.slice.call(document.querySelectorAll('[data-rail]'));

  function updateChrome(index) {
    var name = sections[index] ? sections[index].getAttribute('data-state') : '';
    var m = /^ring(\d)$/.exec(name);
    var nextChapter = m ? +m[1] : -1;
    if (nextChapter === activeChapter) return;
    activeChapter = nextChapter;
    canvas.style.cursor = '';
    if (hovered && hovered.fromCanvas) setHover(null);
    rail.classList.toggle('is-on', activeChapter >= 0);
    railLinks.forEach(function (a) {
      a.setAttribute('aria-current', String(+a.dataset.rail === activeChapter));
    });
  }

  // ---------- Resize ----------

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    var wasMobile = mobile;
    mobile = w <= 820;
    camera.fov = mobile ? 36 : 30;
    camera.updateProjectionMatrix();
    if (wasMobile !== mobile || !STATES) STATES = statesFor(mobile);
    fitHero();
  }

  // The first screen: keep the whole wheel below the title and the lede.
  // Pans the hero camera down (camera and target together) until the far rim clears the text.
  var heroBase = {};
  var probe = new THREE.PerspectiveCamera();
  var rimPt = new THREE.Vector3();
  function fitHero() {
    var lede = document.querySelector('.hero .lede');
    if (!lede || !STATES) return;
    var y = 0, e = lede;
    while (e) { y += e.offsetTop; e = e.offsetParent; }
    var limit = y + lede.offsetHeight + (mobile ? 20 : 36); // px from the top of the page
    var h = window.innerHeight;
    var key = mobile ? 'm' : 'd';
    if (!heroBase[key]) heroBase[key] = { cam: STATES.hero.cam.slice(), tgt: STATES.hero.tgt.slice() };
    var b = heroBase[key];
    function rimTop(d) {
      probe.fov = camera.fov; probe.aspect = camera.aspect; probe.near = 0.1; probe.far = 100;
      probe.updateProjectionMatrix();
      probe.position.set(b.cam[0], b.cam[1] + d, b.cam[2]);
      probe.lookAt(b.tgt[0], b.tgt[1] + d, b.tgt[2]);
      probe.updateMatrixWorld(true);
      rimPt.set(0, 0.32, -3.05).project(probe);
      return (1 - rimPt.y) / 2 * h;
    }
    var d = 0;
    if (rimTop(0) < limit) {
      var lo = 0, hi = 8;
      for (var i = 0; i < 24; i++) { var mid = (lo + hi) / 2; if (rimTop(mid) < limit) lo = mid; else hi = mid; }
      d = hi;
    }
    ['hero', 'foot'].forEach(function (k) {
      STATES[k].cam = [b.cam[0], b.cam[1] + d, b.cam[2]];
      STATES[k].tgt = [b.tgt[0], b.tgt[1] + d, b.tgt[2]];
    });
  }
  if (window.PZLang) window.PZLang.onChange(function () { requestAnimationFrame(fitHero); });

  // ---------- Loop ----------

  var current = null;
  var spinAngle = posterMode ? 0 : -0.35;
  var clock = new THREE.Clock();
  var introStart = 0;
  var INTRO = (reduceMotion || still || isDeepEntry()) ? 0 : 2.0;
  var tmpTarget = new THREE.Vector3();
  var orbitOffset = new THREE.Vector3();
  var orbitAxis = new THREE.Vector3(1, 0, 0);

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function frame() {
    var dt = Math.min(clock.getDelta(), 0.05);
    var now = clock.elapsedTime;

    var target = targetFromScroll();
    if (INTRO && window.scrollY > window.innerHeight * 0.4) { INTRO = 0; root.classList.add('intro-done'); }
    updateChrome(target.index);
    if (!current || reduceMotion || still) current = cloneState(target.state);
    else {
      var k = 1 - Math.pow(0.0015, dt); // frame-rate independent easing
      current = mixState(current, target.state, k);
    }

    // Spin while the wheel is whole; settle to a readable angle when it is taken apart.
    if (!reduceMotion) spinAngle += dt * 0.09 * current.spin;
    var settle = 1 - current.spin;
    var nearest = Math.round(spinAngle / (Math.PI * 2)) * Math.PI * 2;
    if (reduceMotion) spinAngle = 0;
    else spinAngle += (nearest - spinAngle) * Math.min(1, settle * dt * 2.2);

    parallax.x += (parallax.tx - parallax.x) * Math.min(1, dt * 3);
    parallax.y += (parallax.ty - parallax.y) * Math.min(1, dt * 3);

    var camDist = Math.hypot(current.cam[0] - current.tgt[0], current.cam[1] - current.tgt[1], current.cam[2] - current.tgt[2]);
    var viewW = 2 * camDist * Math.tan(deg(camera.fov) / 2) * camera.aspect;
    wheel.position.x = current.gx * viewW;
    wheel.rotation.y = spinAngle + (reduceMotion ? 0 : parallax.x * 0.12);
    wheel.rotation.x = reduceMotion ? 0 : parallax.y * 0.05;

    var intro = INTRO ? Math.min(1, (now - introStart) / INTRO) : 1;

    // Rings inside the focused one move further up, so the focused ring is never hidden.
    var fsum = current.focus.reduce(function (a, b) { return a + b; }, 0);
    var fpos = current.focus.reduce(function (a, b, i) { return a + b * i; }, 0) / Math.max(0.001, fsum);

    LAYERS.forEach(function (layer, li) {
      var drop = 0;
      if (intro < 1) {
        // Rings drop into place, outer ring first, with a short weighted settle.
        // They are all down by ~1.8s; the title waits for them (site.css).
        var lt = clamp01((intro - 0.075 - li * 0.08) / 0.55);
        drop = (1 - easeOut(lt)) * (1.8 + li * 0.6);
        if (lt > 0.72 && lt < 1) drop -= 0.03 * Math.sin(Math.PI * (lt - 0.72) / 0.28);
      }
      // Lifted off the drawing: the ground leaves last and lands first.
      var la = clamp01((current.lift - (1 - li / 4) * 0.4) / 0.6);
      var away = la * la * 13;
      layer.group.position.y = current.explode * (li * STACK_GAP + Math.max(0, li - fpos) * 4.6) + drop + away;
      layer.group.visible = la < 0.97;

      var f = current.focus[li];
      var rough = 0.6 + (0.10 - 0.6) * f;
      var labelOpacity = 0.06 + 0.94 * f;
      if (intro < 1) labelOpacity *= clamp01((intro - 0.35) / 0.5);
      layer.label.material.opacity = labelOpacity;

      layer.meshes.forEach(function (m, si) {
        var isHot = hovered && hovered.layer === li && hovered.seg === si && layer.segs;
        layer.liftTarget[si] = isHot && !reduceMotion ? 0.07 : 0;
        if (reduceMotion) layer.lift[si] = 0;
        else layer.lift[si] += (layer.liftTarget[si] - layer.lift[si]) * Math.min(1, dt * 8);
        m.position.y = layer.lift[si];
        m.material.roughness = rough;
      });
    });

    drawing.material.opacity = current.gropius;
    var sh = wheel.userData.shadow;
    sh.material.opacity = (1 - current.explode * 0.45) * (1 - current.lift) * (intro < 1 ? easeOut(intro) : 1);

    camera.position.set(current.cam[0], current.cam[1], current.cam[2]);
    tmpTarget.set(current.tgt[0], current.tgt[1], current.tgt[2]);
    if (intro < 1) {
      // Entrance: the camera starts closer and eases back to its framing; the grid draws in first.
      var pull = 1 - 0.2 * (1 - easeInOut(intro));
      camera.position.sub(tmpTarget).multiplyScalar(pull).add(tmpTarget);
    }
    wheel.userData.plate.material.opacity = intro < 1 ? easeOut(clamp01(intro / 0.3)) : 1;
    // Rotate around the unchanged target after the original camera interpolation.
    // Rotation preserves distance at every scroll position, including easing.
    if (current.tilt) {
      orbitOffset.copy(camera.position).sub(tmpTarget).applyAxisAngle(orbitAxis, -current.tilt);
      camera.position.copy(tmpTarget).add(orbitOffset);
    }
    camera.lookAt(tmpTarget);
    wheel.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    pickFromCanvas();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // ---------- Start ----------

  function start() {
    try {
      buildScene();
    } catch (err) {
      console.error(err);
      root.classList.add('no-webgl'); markReady(); return;
    }
    resize();
    settleInitialAnchor();
    invalidateScrollLayout();
    clock.start();
    introStart = 0;
    markReady();
    requestAnimationFrame(frame);
  }

  canvas.addEventListener('webglcontextlost', function () { root.classList.add('no-webgl'); });

  var fontsReady = document.fonts && document.fonts.load
    ? Promise.all([
        document.fonts.load('300 64px "Timeless Text"'),
        document.fonts.load('400 64px "Timeless Text"'),
        document.fonts.load('400 32px "Timeless Grotesk"'),
        document.fonts.load('500 32px "Timeless Grotesk"'),
        document.fonts.load('700 32px "Timeless Grotesk"'),
        document.fonts.load('700 32px "PZ Wordmark"')
      ]).catch(function () {})
    : Promise.resolve();

  var timeout = new Promise(function (res) { setTimeout(res, 2500); });
  Promise.all([Promise.race([fontsReady, timeout]), Promise.all(opticsReady)]).then(start).catch(function (err) {
    console.error('Unable to load the Blender appearance', err);
    root.classList.add('no-webgl'); markReady();
  });
})();

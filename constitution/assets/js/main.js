(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var still = /[?&](still|poster)\b/.test(location.search); // snapshot mode: no easing, no intro
  var posterMode = /[?&]poster\b/.test(location.search);
  var lite = /[?&]lite\b/.test(location.search); // test mode: plain materials instead of transmission

  function markReady() {
    root.classList.add('ready');
    // After the entrance, freeze the hero so a language switch doesn't replay it.
    if (still || reduceMotion) root.classList.add('intro-done');
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

  function updateCurtain() {
    var vh = window.innerHeight, c = 0;
    verdicts.forEach(function (v) {
      var r = v.getBoundingClientRect();
      var d = Math.abs(r.top + r.height / 2 - vh / 2);
      var f = 1 - smoothstep(vh * 0.16, vh * 0.55, d);
      v.style.setProperty('--f', f.toFixed(3));
      v.classList.toggle('is-full', f > 0.995);
      if (v.classList.contains('verdict--dark')) c = Math.max(c, 1 - smoothstep(vh * 0.3, vh * 0.8, d));
    });
    root.style.setProperty('--curtain', (c * 0.97).toFixed(3));
    root.classList.toggle('is-dark', c > 0.55);
    root.classList.toggle('scrolled', window.scrollY > window.innerHeight * 0.4);
  }
  window.addEventListener('scroll', updateCurtain, { passive: true });
  window.addEventListener('resize', updateCurtain);
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
  }
  window.PZFitVerdicts = fitVerdicts;
  fitVerdicts();
  window.addEventListener('resize', fitVerdicts);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitVerdicts);
  if (window.PZLang) window.PZLang.onChange(function () { requestAnimationFrame(fitVerdicts); });

  // Text reveal as each section crosses the middle of the screen.
  var revealables = Array.prototype.slice.call(document.querySelectorAll('.panel, .finale, .foot'));
  if (still || reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '-30% 0px -30% 0px' });
    revealables.forEach(function (el) { io.observe(el); });
  }

  // Hover state shared by the list, the schematic, the leader lines and the wheel.
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

  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;

  var key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(5, 9, 4);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(-6, 3, -5);
  scene.add(rim);

  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  // ---------- Model definition ----------
  // Angles: theta in degrees, clockwise from the far side of the wheel ("north").

  var LAYERS = [
    { key: 'ground', tint: '#d7ebe6', dist: 2.4, depth: 0.12 },
    { key: 'studies', tint: '#d7ebe6', dist: 2.4, depth: 0.12,
      segs: ['Representation', 'People', 'Limits', 'Space, time and interaction', 'Systems', 'Agents'] },
    { key: 'materials', tint: '#d2e8e3', dist: 2.0, depth: 0.14,
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

  function acrylic(tint, dist, base) {
    if (lite) {
      return new THREE.MeshStandardMaterial({ color: base ? lin(base) : lin('#f2f5f4'), roughness: 0.2, metalness: 0, transparent: true, opacity: 0.72 });
    }
    return new THREE.MeshPhysicalMaterial({
      color: base ? lin(base) : 0xffffff,
      metalness: 0,
      roughness: 0.06,
      transmission: 1,
      thickness: 0.6,
      ior: 1.49,
      specularIntensity: 1,
      clearcoat: 0.5,
      clearcoatRoughness: 0.04,
      attenuationColor: lin(tint),
      attenuationDistance: dist,
      envMapIntensity: 0.85
    });
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

    function sans(sizeU, weight) { return (weight || 500) + ' ' + Math.round(sizeU * px) + 'px ' + SANS; }

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
      ctx.font = '400 ' + Math.round((bw.length > 6 ? 0.25 : 0.36) * px) + 'px ' + SERIF;
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

    // Fine drafting grid: gives the acrylic something to bend.
    ctx.strokeStyle = 'rgba(38,38,38,0.075)';
    ctx.lineWidth = 1;
    var step = 0.2 * px;
    ctx.beginPath();
    for (var gx = cx % step; gx < size; gx += step) { ctx.moveTo(gx, 0); ctx.lineTo(gx, size); }
    for (var gy = cy % step; gy < size; gy += step) { ctx.moveTo(0, gy); ctx.lineTo(size, gy); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(38,38,38,0.22)';
    for (var dx = cx % (step * 5); dx < size; dx += step * 5) {
      for (var dy = cy % (step * 5); dy < size; dy += step * 5) { ctx.fillRect(dx - 3, dy - 3, 6, 6); }
    }

    ctx.strokeStyle = 'rgba(38,38,38,0.22)';
    ctx.lineWidth = 1.6;
    [3.0, 2.5, 2.42, 2.0, 1.92, 1.36, 1.28, 0.96, 0.88].forEach(function (r) {
      ctx.beginPath(); ctx.arc(cx, cy, r * px, 0, Math.PI * 2); ctx.stroke();
    });

    ctx.setLineDash([6, 10]);
    ctx.beginPath(); ctx.arc(cx, cy, 3.32 * px, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    for (var d = 0; d < 360; d += 3) {
      var a = deg(d);
      var long = d % 30 === 0;
      var r0 = 3.08 * px, r1 = (long ? 3.24 : 3.14) * px;
      ctx.beginPath();
      ctx.moveTo(cx + r0 * Math.sin(a), cy - r0 * Math.cos(a));
      ctx.lineTo(cx + r1 * Math.sin(a), cy - r1 * Math.cos(a));
      ctx.lineWidth = long ? 2 : 1.2;
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(38,38,38,0.12)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - 4.2 * px, cy); ctx.lineTo(cx + 4.2 * px, cy);
    ctx.moveTo(cx, cy - 4.2 * px); ctx.lineTo(cx, cy + 4.2 * px);
    ctx.stroke();

    var W = words();
    arcText(ctx, W ? W.credit : 'Redrawn after Walter Gropius, Bauhaus curriculum, Weimar 1922', cx, cy, 3.5 * px, 180, 0,
      '400 ' + Math.round(0.07 * px) + 'px ' + SANS, 'rgba(38,38,38,0.55)', 0.01 * px);
    arcText(ctx, W ? W.title : 'The Designer’s Constitution', cx, cy, 3.5 * px, 0, 0,
      '400 ' + Math.round(0.09 * px) + 'px ' + SERIF, 'rgba(38,38,38,0.6)', 0.006 * px);

    // Fade the plate into the page so it has no visible edge.
    var g = ctx.createRadialGradient(cx, cy, 3.7 * px, cx, cy, span / 2 * px);
    g.addColorStop(0, 'rgba(233,233,230,0)');
    g.addColorStop(1, 'rgba(233,233,230,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
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
    g.addColorStop(0, 'rgba(30,30,28,0.26)');
    g.addColorStop(0.55, 'rgba(30,30,28,0.12)');
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

    var edgeMat = function () {
      return new THREE.MeshBasicMaterial({ color: lin(ACCENT), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    };

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
          var m = new THREE.Mesh(sectorGeometry(layer.ri, layer.ro, a0, a1, layer.depth), acrylic(layer.tint, layer.dist, layer.base));
          m.userData = { layer: li, seg: i };
          g.add(m);
          layer.meshes.push(m);
          layer.lift.push(0); layer.liftTarget.push(0);
          pickables.push(m);
        }
      } else {
        var mesh = new THREE.Mesh(sectorGeometry(layer.ri, layer.ro, 0, Math.PI * 2, layer.depth), acrylic(layer.tint, layer.dist, layer.base));
        mesh.userData = { layer: li, seg: -1 };
        g.add(mesh);
        layer.meshes.push(mesh);
        layer.lift.push(0); layer.liftTarget.push(0);
        pickables.push(mesh);
      }

      var lt = labelTexture(layer);
      var label = new THREE.Mesh(
        new THREE.PlaneGeometry(lt.span, lt.span),
        new THREE.MeshBasicMaterial({ map: lt.tex, transparent: true, depthWrite: false, toneMapped: false })
      );
      label.rotation.x = -Math.PI / 2;
      label.position.y = layer.depth + BEVEL_T + 0.004;
      label.renderOrder = 2;
      g.add(label);
      layer.label = label;

      // Accent outline that marks the ring in focus.
      var em = edgeMat();
      var top = layer.depth + BEVEL_T + 0.007;
      [layer.ro + 0.004, layer.ri > 0 ? layer.ri - 0.004 : -1].forEach(function (r) {
        if (r <= 0) return;
        var e = new THREE.Mesh(new THREE.RingGeometry(r - 0.011, r + 0.011, 192), em);
        e.rotation.x = -Math.PI / 2;
        e.position.y = top;
        e.renderOrder = 3;
        g.add(e);
      });
      layer.edge = em;

      wheel.add(g);
    });
  }

  // ---------- Scroll states ----------

  function S(o) {
    return {
      cam: o.cam, tgt: o.tgt, gx: o.gx || 0, /* gx: offset as a fraction of the visible width */ explode: o.explode || 0,
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
      gx: a.gx + (b.gx - a.gx) * t, explode: a.explode + (b.explode - a.explode) * t,
      spin: a.spin + (b.spin - a.spin) * t, focus: mixArr(a.focus, b.focus, t),
      gropius: a.gropius + (b.gropius - a.gropius) * t,
      lift: a.lift + (b.lift - a.lift) * t,
      mark: a.mark + (b.mark - a.mark) * t
    };
  }
  function cloneState(s) { return mixState(s, s, 0); }

  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-state]'));
  var mobile = false;
  var STATES = statesFor(false);

  function targetFromScroll() {
    if (posterMode) return { state: STATES.poster, index: 0, t: 0 };
    var center = window.innerHeight * 0.5;
    var anchors = sections.map(function (s) {
      var r = s.getBoundingClientRect();
      return r.top + r.height * 0.5;
    });
    var names = sections.map(function (s) { return s.getAttribute('data-state'); });
    if (center <= anchors[0]) return { state: STATES[names[0]], index: 0, t: 0 };
    for (var i = 0; i < anchors.length - 1; i++) {
      if (center < anchors[i + 1]) {
        var raw = (center - anchors[i]) / (anchors[i + 1] - anchors[i]);
        var t = smoothstep(0.22, 0.78, raw);
        return { state: mixState(STATES[names[i]], STATES[names[i + 1]], t), index: raw < 0.5 ? i : i + 1, t: t };
      }
    }
    var last = names.length - 1;
    return { state: STATES[names[last]], index: last, t: 0 };
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

  // ---------- Leader lines: each list item drawn to its part of the wheel ----------

  var svg = document.querySelector('.leaders');
  var SVGNS = 'http://www.w3.org/2000/svg';
  var leaders = items.map(function (el) {
    var g = document.createElementNS(SVGNS, 'g');
    var line = document.createElementNS(SVGNS, 'path'); line.setAttribute('class', 'ld-line');
    var dot = document.createElementNS(SVGNS, 'circle'); dot.setAttribute('class', 'ld-dot'); dot.setAttribute('r', '3.5');
    var num = document.createElementNS(SVGNS, 'text'); num.setAttribute('class', 'ld-num');
    num.textContent = el.querySelector('.item-num').textContent;
    g.appendChild(line); g.appendChild(dot); g.appendChild(num);
    g.style.opacity = 0;
    svg.appendChild(g);
    return { el: el, g: g, line: line, dot: dot, num: num, layer: +el.dataset.layer, seg: +el.dataset.seg };
  });

  var tmpV = new THREE.Vector3();
  // Each item points at the outer rim of its part; the number sits just outside it, like a callout on a drawing.
  function rimPoint(li, seg, extra) {
    var layer = LAYERS[li];
    var top = layer.depth + BEVEL_T + layer.lift[layer.segs ? seg : 0];
    var t;
    if (li === 0) t = seg === 0 ? 0 : 180;
    else if (layer.segs) t = seg * 360 / layer.segs.length;
    else if (li === 3) t = seg * 120;
    else t = 35 + seg * 30;
    var r = layer.ro + 0.03 + (extra || 0);
    tmpV.set(r * Math.sin(deg(t)), top, -r * Math.cos(deg(t)));
    return layer.group.localToWorld(tmpV).project(camera);
  }

  function updateLeaders() {
    var show = !mobile && activeChapter >= 0;
    svg.style.display = show ? '' : 'none';
    if (!show) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    var single = clamp01(2 - current.focus.reduce(function (a, b) { return a + b; }, 0));
    leaders.forEach(function (L) {
      var vis = single * smoothstep(0.75, 0.98, current.focus[L.layer]) * smoothstep(0.85, 1, current.explode);
      var r = L.el.getBoundingClientRect();
      var y0 = r.top + 13;
      if (y0 < 70 || y0 > vh - 30) vis = 0;
      L.g.style.opacity = vis.toFixed(3);
      if (vis <= 0.001) return;
      var p = rimPoint(L.layer, L.seg, 0);
      var px = (p.x * 0.5 + 0.5) * vw, py = (-p.y * 0.5 + 0.5) * vh;
      var q = rimPoint(L.layer, L.seg, 0.24);
      var nx = (q.x * 0.5 + 0.5) * vw, ny = (-q.y * 0.5 + 0.5) * vh;
      var x0 = r.left - 14, ex = x0 - 34;
      L.line.setAttribute('d', 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' H' + ex.toFixed(1) + ' L' + px.toFixed(1) + ' ' + py.toFixed(1));
      L.dot.setAttribute('cx', px.toFixed(1));
      L.dot.setAttribute('cy', py.toFixed(1));
      L.num.setAttribute('x', nx.toFixed(1));
      L.num.setAttribute('y', (ny + 3.5).toFixed(1));
      var hot = hovered && hovered.layer === L.layer && hovered.seg === L.seg;
      L.g.setAttribute('class', hot ? 'is-hot' : '');
    });
  }

  // ---------- Rail ----------

  var rail = document.querySelector('.rail');
  var railLinks = Array.prototype.slice.call(document.querySelectorAll('[data-rail]'));

  function updateChrome(index) {
    var name = sections[index] ? sections[index].getAttribute('data-state') : '';
    var m = /^ring(\d)$/.exec(name);
    activeChapter = m ? +m[1] : -1;
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
  var INTRO = (reduceMotion || still) ? 0 : 2.0;
  var tmpTarget = new THREE.Vector3();

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function frame() {
    var dt = Math.min(clock.getDelta(), 0.05);
    var now = clock.elapsedTime;

    updateCurtain();

    var target = targetFromScroll();
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
    spinAngle += (nearest - spinAngle) * Math.min(1, settle * dt * 2.2);

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
    var single = clamp01(2 - fsum);

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
      var rough = 0.6 + (0.05 - 0.6) * f;
      var labelOpacity = 0.06 + 0.94 * f;
      if (intro < 1) labelOpacity *= clamp01((intro - 0.35) / 0.5);
      layer.label.material.opacity = labelOpacity;

      layer.meshes.forEach(function (m, si) {
        var isHot = hovered && hovered.layer === li && hovered.seg === si && layer.segs;
        layer.liftTarget[si] = isHot ? 0.16 : 0;
        layer.lift[si] += (layer.liftTarget[si] - layer.lift[si]) * Math.min(1, dt * 8);
        m.position.y = layer.lift[si];
        var dim = hovered && hovered.layer === li && layer.segs && !isHot ? 0.18 : 0;
        m.material.roughness = Math.min(0.62, rough + dim);
      });
      if (layer.segs) {
        var maxLift = Math.max.apply(null, layer.lift);
        layer.label.position.y = layer.depth + BEVEL_T + 0.004 + (hovered && hovered.layer === li ? maxLift : 0);
      }
      var edge = Math.max(f * single * current.explode, li === 3 ? current.mark : 0);
      layer.edge.opacity = edge * 0.95;
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
    camera.lookAt(tmpTarget);
    wheel.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    pickFromCanvas();
    updateLeaders();
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
    window.addEventListener('resize', resize);
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
  Promise.race([fontsReady, timeout]).then(start);
})();

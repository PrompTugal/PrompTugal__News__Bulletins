/* Presenters: a small language for synthetic presenters (bulletins.b@, 20 Nov 2026; Dinis: "define almost a DSL for
 * this, and then you just basically programmatically create the agents"). Four layers, each plain data:
 *   1. SPEC (presenters.json): what a presenter is, in high-level words: kind (humanoid, boxbot, owl, mosaic, cube3d),
 *      its looks (hair, outfit, props...) and a render style (flat, line, hatch, realistic, hologram, teletext).
 *   2. PARTS + RIG: compile(spec) turns the spec into drawable parts (ellipse, rect, path, grid) and a rig: where the
 *      head pivots, where the eyes and mouth are, which arm can point.
 *   3. ACTIONS: direct(timeline) turns a bulletin's timeline into actions: speak, blink, nod, look, point, emote.
 *   4. STATE: stateAt(actions, t, amp) folds the actions at time t into one state {mouth, blink, tilt, nod, look,
 *      arm, smile, bob}; any presenter applies any state. So every frame is a pure function of t.
 * Sets text with textContent only; makes no network request; draws only into the element it is given. */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, a) { var e = document.createElementNS(NS, tag); Object.keys(a || {}).forEach(function (k) { if (a[k] != null) e.setAttribute(k, String(a[k])); }); return e; }
  function rng(seed) { var s = 0; String(seed).split('').forEach(function (c) { s = (s * 31 + c.charCodeAt(0)) >>> 0; }); return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var bump = function (x) { return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x); };

  /* ---------- 2. Compile: spec -> parts + rig. Every presenter lives in a 240 x 320 box. ---------- */
  // A part: {shape:'ellipse'|'rect'|'path'|'grid', layer:'body'|'head'|'arm'|'front', fill, stroke, ...geometry, role?}
  var HAIR = {
    short: 'M72 112 C70 70 96 54 120 54 C146 54 170 70 168 112 C162 92 148 84 130 84 C110 90 90 90 78 100 Z',
    side: 'M70 118 C64 70 92 50 124 52 C156 54 174 76 170 116 C166 96 152 80 120 80 C104 82 92 96 80 120 Z',
    quiff: 'M72 112 C68 66 96 38 132 42 C160 46 176 74 168 112 C160 90 150 80 132 80 C112 86 92 88 78 104 Z',
    curly: 'M66 118 C56 80 80 46 120 46 C160 46 186 80 174 118 C170 100 164 96 156 98 C150 84 138 80 124 84 C108 80 92 86 86 100 C78 98 72 104 66 118 Z',
    grey: 'M74 110 C72 72 96 58 120 58 C146 58 168 72 166 110 C158 92 146 86 120 86 C98 86 84 94 74 110 Z',
    bald: 'M84 92 C96 76 144 76 156 92 C146 84 96 84 84 92 Z',
  };
  function humanoid(p) {
    var parts = [], skin = p.skin || '#e0b48c', hair = p.hair || { style: 'short', color: '#2b2b2b' }, o = p.outfit || { style: 'suit', color: '#283a5c' };
    var ink = p.ink || '#1b1b1f';
    // Body: shoulders and outfit.
    parts.push({ layer: 'body', shape: 'path', d: 'M22 320 C26 254 54 230 94 218 L146 218 C186 230 214 254 218 320 Z', fill: o.color, role: 'torso' });
    if (o.style === 'suit') {
      parts.push({ layer: 'body', shape: 'path', d: 'M96 218 L120 262 L144 218 Z', fill: o.shirt || '#f4f4f2' });
      if (o.tie) parts.push({ layer: 'body', shape: 'path', d: 'M114 236 L126 236 L130 296 L120 308 L110 296 Z', fill: o.tie });
      parts.push({ layer: 'body', shape: 'path', d: 'M96 218 L120 262 L104 304 L72 236 Z', fill: o.lapel || shade(o.color, -0.18) });
      parts.push({ layer: 'body', shape: 'path', d: 'M144 218 L120 262 L136 304 L168 236 Z', fill: o.lapel || shade(o.color, -0.18) });
    } else if (o.style === 'jumper') {
      parts.push({ layer: 'body', shape: 'path', d: 'M98 218 Q120 240 142 218 Z', fill: o.shirt || '#f4f4f2' });
    } else if (o.style === 'shirt') {
      parts.push({ layer: 'body', shape: 'path', d: 'M98 218 L120 248 L142 218 Z', fill: shade(o.color, 0.15) });
      parts.push({ layer: 'body', shape: 'path', d: 'M118 248 L122 248 L122 320 L118 320 Z', fill: shade(o.color, -0.25) });
    }
    parts.push({ layer: 'body', shape: 'rect', x: 104, y: 182, width: 32, height: 42, rx: 10, fill: skin });
    // Head.
    parts.push({ layer: 'head', shape: 'ellipse', cx: 72, cy: 132, rx: 7, ry: 13, fill: skin });
    parts.push({ layer: 'head', shape: 'ellipse', cx: 168, cy: 132, rx: 7, ry: 13, fill: skin });
    parts.push({ layer: 'head', shape: 'ellipse', cx: 120, cy: 128, rx: 47, ry: 58, fill: skin, role: 'face' });
    if (p.beard) parts.push({ layer: 'head', shape: 'path', d: 'M76 140 C80 176 98 190 120 190 C142 190 160 176 164 140 C158 160 146 168 120 170 C94 168 82 160 76 140 Z', fill: p.beard });
    parts.push({ layer: 'head', shape: 'path', d: HAIR[hair.style] || HAIR.short, fill: hair.color });
    parts.push({ layer: 'head', shape: 'path', d: 'M90 112 Q101 106 112 112', fill: 'none', stroke: hair.brow || hair.color, sw: 4 });
    parts.push({ layer: 'head', shape: 'path', d: 'M128 112 Q139 106 150 112', fill: 'none', stroke: hair.brow || hair.color, sw: 4 });
    parts.push({ layer: 'head', shape: 'path', d: 'M120 132 L113 154 L124 155', fill: 'none', stroke: shade(skin, -0.3), sw: 2.5 });
    if (p.glasses) {
      parts.push({ layer: 'front', shape: 'ellipse', cx: 101, cy: 128, rx: 15, ry: 12, fill: 'none', stroke: p.glasses, sw: 3, inHead: true });
      parts.push({ layer: 'front', shape: 'ellipse', cx: 139, cy: 128, rx: 15, ry: 12, fill: 'none', stroke: p.glasses, sw: 3, inHead: true });
      parts.push({ layer: 'front', shape: 'path', d: 'M116 127 L124 127', fill: 'none', stroke: p.glasses, sw: 3, inHead: true });
    }
    // Arm (the one that points), with a prop in the hand.
    var arm = [{ shape: 'path', d: 'M182 250 C200 262 206 282 204 300', fill: 'none', stroke: o.color, sw: 20 }, { shape: 'ellipse', cx: 204, cy: 302, rx: 11, ry: 11, fill: skin }];
    if (p.prop === 'tablet') arm.push({ shape: 'rect', x: 190, y: 270, width: 34, height: 44, rx: 4, fill: '#20242c', stroke: '#cfd6e6', sw: 2 });
    if (p.prop === 'mic') arm.push({ shape: 'rect', x: 200, y: 270, width: 8, height: 30, rx: 3, fill: '#333' }, { shape: 'ellipse', cx: 204, cy: 268, rx: 9, ry: 10, fill: '#555' });
    if (p.prop === 'pencil') arm.push({ shape: 'path', d: 'M206 300 L228 262 L234 266 L212 304 Z', fill: '#e8b23a' });
    arm.forEach(function (a) { a.layer = 'arm'; parts.push(a); });
    return { parts: parts, rig: { headPivot: [120, 186], eyes: [{ cx: 101, cy: 128, r: p.eyeR || 6 }, { cx: 139, cy: 128, r: p.eyeR || 6 }], eyeFill: p.eyeColor || ink, mouth: { cx: 120, cy: 168, w: 30, h: 13, color: p.lip || shade(skin, -0.35) }, shoulder: [184, 250], ink: ink } };
  }
  function boxbot(p) {
    var parts = [], h = p.head || {}, b = p.body || {}, ink = p.ink || '#23262b';
    var hw = h.w || 110, hh = h.h || 86, hx = 120 - hw / 2, hy = 70;
    if (b.shape === 'tunic') parts.push({ layer: 'body', shape: 'path', d: 'M78 186 L162 186 L176 300 L64 300 Z', fill: b.color || '#7fb7a8', role: 'torso' });
    else parts.push({ layer: 'body', shape: 'rect', x: 76, y: 184, width: 88, height: 104, rx: 12, fill: b.color || '#c0462a', role: 'torso' });
    parts.push({ layer: 'body', shape: 'path', d: 'M98 288 L98 318 M142 288 L142 318', fill: 'none', stroke: ink, sw: 5 });
    parts.push({ layer: 'body', shape: 'rect', x: 110, y: 160, width: 20, height: 28, fill: shade(h.color || '#e9eef2', -0.2) });
    if (p.antenna !== false) parts.push({ layer: 'head', shape: 'path', d: 'M120 70 L120 46', fill: 'none', stroke: ink, sw: 3 }, { layer: 'head', shape: 'ellipse', cx: 120, cy: 42, rx: 6, ry: 6, fill: p.antennaColor || '#e0a040' });
    parts.push({ layer: 'head', shape: 'rect', x: hx, y: hy, width: hw, height: hh, rx: 14, fill: h.color || '#e9eef2', role: 'face' });
    if (h.screen) parts.push({ layer: 'head', shape: 'rect', x: hx + 10, y: hy + 10, width: hw - 20, height: hh - 20, rx: 8, fill: h.screen });
    if (p.face === 'clock') parts.push({ layer: 'head', shape: 'ellipse', cx: 120, cy: hy + hh / 2, rx: 30, ry: 30, fill: '#fff', stroke: ink, sw: 3 }, { layer: 'head', shape: 'path', d: 'M120 ' + (hy + hh / 2) + ' L120 ' + (hy + hh / 2 - 20) + ' M120 ' + (hy + hh / 2) + ' L134 ' + (hy + hh / 2 + 6), fill: 'none', stroke: ink, sw: 3 });
    if (p.hat === 'hardhat') parts.push({ layer: 'head', shape: 'path', d: 'M' + (hx - 6) + ' ' + (hy + 6) + ' C' + (hx + 4) + ' ' + (hy - 34) + ' ' + (hx + hw - 4) + ' ' + (hy - 34) + ' ' + (hx + hw + 6) + ' ' + (hy + 6) + ' Z', fill: p.hatColor || '#3d7a3a' });
    if (p.hat === 'beret') parts.push({ layer: 'head', shape: 'ellipse', cx: 116, cy: hy - 2, rx: 46, ry: 12, fill: p.hatColor || '#c24a6a' });
    if (p.glasses) parts.push({ layer: 'front', shape: 'ellipse', cx: 102, cy: hy + 36, rx: 12, ry: 10, fill: 'none', stroke: ink, sw: 3, inHead: true }, { layer: 'front', shape: 'ellipse', cx: 138, cy: hy + 36, rx: 12, ry: 10, fill: 'none', stroke: ink, sw: 3, inHead: true });
    if (p.badge) parts.push({ layer: 'body', shape: 'rect', x: 92, y: 216, width: 56, height: 22, rx: 4, fill: '#fff', stroke: ink, sw: 2 }, { layer: 'body', shape: 'text', x: 120, y: 232, text: p.badge, fill: ink, size: 13 });
    var arm = [{ shape: 'path', d: 'M164 212 C186 222 194 244 196 262', fill: 'none', stroke: ink, sw: 4 }, { shape: 'ellipse', cx: 197, cy: 265, rx: 6, ry: 6, fill: p.handColor || '#2a8f8a' }];
    if (p.prop === 'magnifier') arm.push({ shape: 'ellipse', cx: 206, cy: 250, rx: 12, ry: 12, fill: 'rgba(255,255,255,.4)', stroke: ink, sw: 3 });
    if (p.prop === 'card') arm.push({ shape: 'rect', x: 196, y: 236, width: 30, height: 22, rx: 2, fill: '#fff', stroke: ink, sw: 2 });
    if (p.prop === 'keys') arm.push({ shape: 'ellipse', cx: 206, cy: 276, rx: 10, ry: 10, fill: 'none', stroke: '#1a7f5a', sw: 4 }, { shape: 'rect', x: 210, y: 280, width: 10, height: 18, rx: 2, fill: '#1a7f5a' });
    arm.forEach(function (a) { a.layer = 'arm'; parts.push(a); });
    var ey = hy + (p.face === 'clock' ? 18 : 36);
    return { parts: parts, rig: { headPivot: [120, 170], eyes: p.face === 'clock' ? [] : [{ cx: 102, cy: ey, r: 5 }, { cx: 138, cy: ey, r: 5 }], eyeFill: p.eyeColor || ink, mouth: { cx: 120, cy: hy + hh - 22, w: 24, h: 8, color: ink }, shoulder: [164, 212], ink: ink } };
  }
  function owl(p) {
    var c = p.color || '#8a5a2b', bel = p.belly || '#e8d3ac', ink = p.ink || '#2a1a0c', parts = [];
    parts.push({ layer: 'body', shape: 'ellipse', cx: 120, cy: 236, rx: 80, ry: 84, fill: c, role: 'torso' });
    parts.push({ layer: 'body', shape: 'ellipse', cx: 120, cy: 250, rx: 52, ry: 62, fill: bel });
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) parts.push({ layer: 'body', shape: 'path', d: 'M' + (96 + j * 24) + ' ' + (222 + i * 24) + ' q6 8 12 0', fill: 'none', stroke: shade(bel, -0.3), sw: 2 });
    parts.push({ layer: 'head', shape: 'path', d: 'M50 70 L80 100 L160 100 L190 70 L178 150 C170 196 70 196 62 150 Z', fill: c, role: 'face' });
    parts.push({ layer: 'head', shape: 'ellipse', cx: 96, cy: 130, rx: 30, ry: 30, fill: '#fff8e8' }, { layer: 'head', shape: 'ellipse', cx: 144, cy: 130, rx: 30, ry: 30, fill: '#fff8e8' });
    parts.push({ layer: 'head', shape: 'path', d: 'M112 150 L128 150 L120 172 Z', fill: '#e8a020', role: 'beak' });
    if (p.glasses) parts.push({ layer: 'front', shape: 'ellipse', cx: 96, cy: 130, rx: 32, ry: 32, fill: 'none', stroke: ink, sw: 3, inHead: true }, { layer: 'front', shape: 'ellipse', cx: 144, cy: 130, rx: 32, ry: 32, fill: 'none', stroke: ink, sw: 3, inHead: true });
    parts.push({ layer: 'arm', shape: 'path', d: 'M190 210 C222 230 222 270 196 292 C206 262 200 236 186 226 Z', fill: shade(c, -0.15) });
    return { parts: parts, rig: { headPivot: [120, 190], eyes: [{ cx: 96, cy: 130, r: 11 }, { cx: 144, cy: 130, r: 11 }], eyeFill: ink, mouth: { cx: 120, cy: 172, w: 14, h: 10, color: '#7a3e10', beak: true }, shoulder: [188, 214], ink: ink } };
  }
  // Teletext mosaic: the face as a grid of cells; the mouth row swaps between closed, half and open.
  function mosaic(p) {
    var g = p.grid, mouths = p.mouths, pal = p.palette, cell = p.cell || 16;
    return { parts: [{ layer: 'head', shape: 'grid', rows: g, palette: pal, cell: cell, x0: 120 - g[0].length * cell / 2, y0: 40, role: 'face' }],
      rig: { headPivot: [120, 300], eyes: [], mosaic: { mouths: mouths, row: p.mouthRow, palette: pal, cell: cell, x0: 120 - g[0].length * cell / 2, y0: 40 }, mouth: null, shoulder: null } };
  }

  /* ---------- Drawing styles. ---------- */
  function shade(hex, k) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex;
    var n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = function (c) { return clamp(Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k), 0, 255); };
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }
  // A shape as points (for the hand-drawn wobble).
  function points(s) {
    var pts = [], i;
    if (s.shape === 'ellipse') for (i = 0; i < 28; i++) { var a = i / 28 * Math.PI * 2; pts.push([s.cx + s.rx * Math.cos(a), s.cy + s.ry * Math.sin(a)]); }
    else if (s.shape === 'rect') pts.push([s.x, s.y], [s.x + s.width, s.y], [s.x + s.width, s.y + s.height], [s.x, s.y + s.height]);
    return pts;
  }
  function wobble(pts, r, amt, closed) {
    var d = ''; pts.forEach(function (p, i) { d += (i ? 'L' : 'M') + (p[0] + (r() - 0.5) * amt).toFixed(1) + ' ' + (p[1] + (r() - 0.5) * amt).toFixed(1); });
    return d + (closed ? 'Z' : '');
  }
  function draw(g, s, st, defs, r) {
    var fill = s.fill, stroke = s.stroke, sw = s.sw;
    if (st.mode === 'hologram') { fill = fill === 'none' ? 'none' : 'url(#' + st.id + '-holo)'; stroke = stroke ? '#bff7ff' : null; }
    if (st.mode === 'realistic' && fill && fill !== 'none' && /^#/.test(fill) && (s.shape === 'ellipse' || s.role === 'torso' || s.role === 'face')) fill = gradient(defs, st.id, fill);
    if (st.mode === 'hatch' && fill && fill !== 'none' && /^#/.test(fill)) fill = hatch(defs, st.id, fill);
    var outline = st.mode === 'line' || st.mode === 'flat' || st.mode === 'hatch';
    var oStroke = stroke || (outline && fill !== 'none' ? st.ink : null), oSw = sw || (st.mode === 'line' ? 4 : st.mode === 'hatch' ? 2.2 : 1.6);
    if (s.shape === 'text') { var t = el('text', { x: s.x, y: s.y, 'text-anchor': 'middle', 'font-family': 'DejaVu Sans, sans-serif', 'font-weight': 700, 'font-size': s.size || 12, fill: s.fill }); t.textContent = s.text; g.appendChild(t); return; }
    if (s.shape === 'grid') { s.rows.forEach(function (row, y) { row.split('').forEach(function (c, x) { if (c === '.' || !s.palette[c]) return; g.appendChild(el('rect', { x: s.x0 + x * s.cell, y: s.y0 + y * s.cell, width: s.cell, height: s.cell, fill: s.palette[c] })); }); }); return; }
    if (st.mode === 'hatch' && (s.shape === 'ellipse' || s.shape === 'rect')) {
      var pts = points(s); g.appendChild(el('path', { d: wobble(pts, r, 1.5, true), fill: fill, stroke: 'none' }));
      if (oStroke) for (var k = 0; k < 2; k++) g.appendChild(el('path', { d: wobble(pts, r, 2.6, true), fill: 'none', stroke: oStroke, 'stroke-width': oSw, 'stroke-linejoin': 'round' }));
      return;
    }
    var a = { fill: fill, stroke: oStroke, 'stroke-width': oStroke ? oSw : null, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    if (s.shape === 'ellipse') { a.cx = s.cx; a.cy = s.cy; a.rx = s.rx; a.ry = s.ry; }
    else if (s.shape === 'rect') { a.x = s.x; a.y = s.y; a.width = s.width; a.height = s.height; a.rx = s.rx || 0; }
    else a.d = s.d;
    g.appendChild(el(s.shape === 'path' ? 'path' : s.shape, a));
  }
  var gid = 0;
  function gradient(defs, id, hex) { var n = id + '-g' + (gid++), gr = el('radialGradient', { id: n, cx: '40%', cy: '35%', r: '75%' }); gr.appendChild(el('stop', { offset: '0', 'stop-color': shade(hex, 0.22) })); gr.appendChild(el('stop', { offset: '0.7', 'stop-color': hex })); gr.appendChild(el('stop', { offset: '1', 'stop-color': shade(hex, -0.3) })); defs.appendChild(gr); return 'url(#' + n + ')'; }
  function hatch(defs, id, hex) { var n = id + '-h' + (gid++), pt = el('pattern', { id: n, width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(40)' }); pt.appendChild(el('rect', { width: 7, height: 7, fill: shade(hex, 0.7) })); pt.appendChild(el('path', { d: 'M0 0 L0 7', stroke: hex, 'stroke-width': 2.4 })); defs.appendChild(pt); return 'url(#' + n + ')'; }

  /* ---------- Build: spec -> a live presenter with apply(state). ---------- */
  function build(spec, host) {
    host.textContent = '';
    if (spec.kind === 'cube3d') return cube3d(spec, host);
    var c = ({ humanoid: humanoid, boxbot: boxbot, owl: owl, mosaic: mosaic })[spec.kind](spec.looks || {});
    var st = { mode: spec.render || 'flat', id: 'p-' + spec.id, ink: c.rig.ink || '#1b1b1f' }, r = rng(spec.id);
    var svgEl = el('svg', { viewBox: '0 0 240 320', 'class': 'presenter ' + st.mode, role: 'img', 'aria-label': spec.name + ', a synthetic presenter' });
    var defs = el('defs'); svgEl.appendChild(defs);
    if (st.mode === 'hologram') {
      var hg = el('linearGradient', { id: st.id + '-holo', x1: 0, y1: 0, x2: 0, y2: 1 }); hg.appendChild(el('stop', { offset: '0', 'stop-color': '#a8f4ff', 'stop-opacity': '0.95' })); hg.appendChild(el('stop', { offset: '1', 'stop-color': '#1b6dff', 'stop-opacity': '0.5' })); defs.appendChild(hg);
      var sp = el('pattern', { id: st.id + '-scan', width: 4, height: 4, patternUnits: 'userSpaceOnUse' }); sp.appendChild(el('rect', { width: 4, height: 1.3, fill: '#000', 'fill-opacity': '0.35' })); defs.appendChild(sp);
    }
    var all = el('g'), body = el('g'), arm = el('g'), head = el('g'), front = el('g');
    all.appendChild(body); all.appendChild(head); all.appendChild(arm); svgEl.appendChild(all);
    c.parts.forEach(function (p) { draw(p.layer === 'body' ? body : p.layer === 'arm' ? arm : p.inHead ? front : head, p, st, defs, r); });
    // Eyes, pupils and mouth belong to the rig, so actions can move them.
    var eyes = (c.rig.eyes || []).map(function (e) {
      var g = el('g'); var white = el('ellipse', { cx: e.cx, cy: e.cy, rx: e.r * 1.5, ry: e.r * 1.3, fill: st.mode === 'hologram' ? '#e8fdff' : '#ffffff', stroke: st.mode === 'line' ? st.ink : null, 'stroke-width': 2 });
      var pupil = el('ellipse', { cx: e.cx, cy: e.cy, rx: e.r * 0.8, ry: e.r * 0.8, fill: st.mode === 'hologram' ? '#063a6a' : c.rig.eyeFill });
      g.appendChild(white); g.appendChild(pupil);
      if (st.mode === 'realistic') g.appendChild(el('ellipse', { cx: e.cx + e.r * 0.3, cy: e.cy - e.r * 0.3, rx: e.r * 0.25, ry: e.r * 0.25, fill: '#fff' }));
      head.appendChild(g); return { g: g, pupil: pupil, cx: e.cx, cy: e.cy };
    });
    var m = c.rig.mouth, mouth = null, smile = null;
    if (m) {
      mouth = el('ellipse', { cx: m.cx, cy: m.cy, rx: m.w / 2, ry: 1, fill: m.beak ? m.color : '#3a1010', stroke: st.mode === 'line' || st.mode === 'hatch' ? st.ink : null, 'stroke-width': 2 });
      smile = el('path', { d: '', fill: 'none', stroke: st.mode === 'hologram' ? '#e8fdff' : m.color, 'stroke-width': 3, 'stroke-linecap': 'round' });
      head.appendChild(mouth); head.appendChild(smile);
    }
    head.appendChild(front);
    var mos = null;
    if (c.rig.mosaic) { mos = el('g'); head.appendChild(mos); }
    var band = null;
    if (st.mode === 'hologram') { svgEl.appendChild(el('rect', { width: 240, height: 320, fill: 'url(#' + st.id + '-scan)' })); band = el('rect', { x: 0, y: 0, width: 240, height: 12, fill: '#bff7ff', 'fill-opacity': 0.2 }); svgEl.appendChild(band); }
    host.appendChild(svgEl);
    var hp = c.rig.headPivot, sh = c.rig.shoulder;
    return { el: svgEl, apply: function (s) {
      head.setAttribute('transform', 'translate(0 ' + (s.nod * 4).toFixed(2) + ') rotate(' + s.tilt.toFixed(2) + ' ' + hp[0] + ' ' + hp[1] + ')');
      all.setAttribute('transform', 'translate(0 ' + (s.bob * 2).toFixed(2) + ')');
      if (sh) arm.setAttribute('transform', 'rotate(' + (-s.arm * 55).toFixed(2) + ' ' + sh[0] + ' ' + sh[1] + ')');
      eyes.forEach(function (e) { e.g.setAttribute('transform', 'translate(' + e.cx + ' ' + e.cy + ') scale(1 ' + Math.max(0.08, 1 - s.blink).toFixed(3) + ') translate(' + (-e.cx) + ' ' + (-e.cy) + ')'); e.pupil.setAttribute('cx', (e.cx + s.look * 3).toFixed(2)); });
      if (mouth) {
        var open = s.mouth; mouth.setAttribute('ry', (1 + open * m.h).toFixed(2)); mouth.setAttribute('rx', (m.w / 2 * (1 - open * 0.25)).toFixed(2));
        var curve = (s.smile * 8 - (1 - s.smile) * 0.5) * (1 - open);
        smile.setAttribute('d', 'M' + (m.cx - m.w / 2) + ' ' + m.cy + ' Q' + m.cx + ' ' + (m.cy + curve).toFixed(2) + ' ' + (m.cx + m.w / 2) + ' ' + m.cy);
        smile.setAttribute('opacity', open > 0.15 ? 0 : 1);
      }
      if (mos) {
        var M = c.rig.mosaic, rows = M.mouths[open3(s.mouth)]; mos.textContent = '';
        rows.forEach(function (row, y) { row.split('').forEach(function (ch, x) { if (!M.palette[ch]) return; mos.appendChild(el('rect', { x: M.x0 + x * M.cell, y: M.y0 + (M.row + y) * M.cell, width: M.cell, height: M.cell, fill: M.palette[ch] })); }); });
        if (s.blink > 0.5) M.eyesRow && null;
      }
      if (band) band.setAttribute('y', ((s.t * 120) % 340 - 20).toFixed(1));
      if (st.mode === 'hologram') all.setAttribute('opacity', (0.86 + 0.08 * Math.sin(s.t * 23) * Math.sin(s.t * 7)).toFixed(3));
    } };
  }
  function open3(m) { return m > 0.55 ? 2 : m > 0.2 ? 1 : 0; }

  // A true 3D presenter: a cube in CSS 3D with a face on the front, turning with the head state.
  function cube3d(spec, host) {
    var L = spec.looks || {}, size = L.size || 130, half = size / 2;
    var wrap = document.createElement('div'); wrap.className = 'cube3d'; wrap.style.cssText = 'width:240px;height:320px;perspective:600px;display:flex;align-items:center;justify-content:center';
    var cube = document.createElement('div'); cube.style.cssText = 'position:relative;width:' + size + 'px;height:' + size + 'px;transform-style:preserve-3d';
    var faces = { front: 'translateZ(' + half + 'px)', back: 'rotateY(180deg) translateZ(' + half + 'px)', right: 'rotateY(90deg) translateZ(' + half + 'px)', left: 'rotateY(-90deg) translateZ(' + half + 'px)', top: 'rotateX(90deg) translateZ(' + half + 'px)', bottom: 'rotateX(-90deg) translateZ(' + half + 'px)' };
    var cols = L.colors || { front: '#ffb000', right: '#e07000', left: '#e07000', top: '#ffd060', back: '#c05000', bottom: '#a04000' };
    var face = null;
    Object.keys(faces).forEach(function (k) {
      var f = document.createElement('div'); f.style.cssText = 'position:absolute;inset:0;border:3px solid #1b1b1f;border-radius:10px;background:' + cols[k] + ';transform:' + faces[k] + ';backface-visibility:hidden';
      if (k === 'front') face = f; cube.appendChild(f);
    });
    var s = el('svg', { viewBox: '0 0 100 100', width: size, height: size }); face.appendChild(s);
    var eL = el('ellipse', { cx: 34, cy: 40, rx: 7, ry: 9, fill: '#1b1b1f' }), eR = el('ellipse', { cx: 66, cy: 40, rx: 7, ry: 9, fill: '#1b1b1f' });
    var mouth = el('ellipse', { cx: 50, cy: 70, rx: 14, ry: 2, fill: '#5a1010' }); s.appendChild(eL); s.appendChild(eR); s.appendChild(mouth);
    wrap.appendChild(cube); host.appendChild(wrap);
    return { el: wrap, apply: function (st) {
      cube.style.transform = 'translateY(' + (st.bob * 3 - st.nod * 6).toFixed(2) + 'px) rotateX(' + (-12 + st.nod * 10).toFixed(2) + 'deg) rotateY(' + (-24 + st.look * 18 + st.tilt * 3 + st.arm * 20).toFixed(2) + 'deg) rotateZ(' + (st.tilt).toFixed(2) + 'deg)';
      [eL, eR].forEach(function (e) { e.setAttribute('ry', Math.max(0.8, 9 * (1 - st.blink)).toFixed(2)); });
      mouth.setAttribute('ry', (2 + st.mouth * 12).toFixed(2));
    } };
  }

  /* ---------- 3. Actions: the director turns a bulletin timeline into actions. ---------- */
  // Action language: {t, dur, do: 'speak'|'blink'|'nod'|'look'|'point'|'emote', dir?, mood?, amount?}
  function direct(tl, seed) {
    var r = rng(seed || 'director'), acts = [];
    (tl.segs || []).forEach(function (s, i) {
      acts.push({ t: s.start, dur: s.end - s.start, do: 'speak' });
      acts.push({ t: s.start, dur: 0.6, do: 'look', dir: i % 2 ? 'content' : 'camera' });
      if (s.kind === 'open' || s.kind === 'close') acts.push({ t: s.start, dur: s.end - s.start, do: 'emote', mood: 'smile' });
      (s.words || []).forEach(function (w) { if (/\d/.test(w.w)) acts.push({ t: w.start, dur: 0.45, do: 'nod', amount: 1 }); });
      if (s.kind === 'line') acts.push({ t: s.start + 0.6, dur: Math.min(2.4, s.end - s.start - 0.8), do: 'point', dir: 'content' });
      if (s.kind === 'line' && (s.bars || []).length) acts.push({ t: s.words[s.bars[0].word] ? s.words[s.bars[0].word].start : s.start, dur: 2, do: 'point', dir: 'content' });
    });
    for (var t = 0.8 + r() * 1.5; t < (tl.duration || 30); t += 2.6 + r() * 1.8) acts.push({ t: t, dur: 0.16, do: 'blink' });
    return acts.sort(function (a, b) { return a.t - b.t; });
  }

  /* ---------- 4. State at t: fold the actions; the voice's loudness opens the mouth while speaking. ---------- */
  function stateAt(acts, t, amp) {
    var s = { t: t, mouth: 0, blink: 0, tilt: Math.sin(t * 1.3) * 2, nod: 0, look: 0, arm: 0, smile: 0.25, bob: Math.sin(t * 2.1) };
    var lookTo = 0;
    acts.forEach(function (a) {
      var x = (t - a.t) / a.dur; if (t < a.t) return;
      if (a.do === 'look') lookTo = a.dir === 'content' ? -1 : 0;
      if (x > 1) return;
      if (a.do === 'speak') s.mouth = clamp(amp || 0, 0, 1);
      if (a.do === 'blink') s.blink = Math.max(s.blink, bump(x));
      if (a.do === 'nod') s.nod += bump(x) * (a.amount || 1);
      if (a.do === 'point') s.arm = Math.max(s.arm, clamp(Math.min(x * 4, (1 - x) * 4, 1), 0, 1));
      if (a.do === 'emote' && a.mood === 'smile') s.smile = 1;
    });
    s.look = lookTo; s.tilt += s.mouth * 1.5;
    return s;
  }

  root.Presenters = { build: build, direct: direct, stateAt: stateAt, compile: function (spec) { return ({ humanoid: humanoid, boxbot: boxbot, owl: owl, mosaic: mosaic })[spec.kind](spec.looks || {}); } };
})(window);

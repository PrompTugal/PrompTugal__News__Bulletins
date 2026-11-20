/* The video bulletin's stage (bulletins.b@, 20 Nov 2026). Every frame is a pure function of the time t, so the same
 * scenes play in the browser (driven by the audio) and are captured frame by frame for the MP4 (driven by Playwright).
 * Reads timeline.json from this folder; sets text with textContent only; no network beyond this folder. */
(function () {
  'use strict';
  var TL = null, root = null, els = {};
  var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var ease = function (x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); };
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function svg(tag, attrs) { var e = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, String(attrs[k])); }); return e; }

  // The presenter: an original holographic figure drawn in code (male, half body, suit), clearly synthetic.
  function buildAvatar() {
    var s = svg('svg', { viewBox: '0 0 240 320', 'class': 'av' });
    var defs = svg('defs');
    var g = svg('linearGradient', { id: 'holo', x1: 0, y1: 0, x2: 0, y2: 1 });
    g.appendChild(svg('stop', { offset: '0', 'stop-color': '#9ff3ff', 'stop-opacity': '0.95' }));
    g.appendChild(svg('stop', { offset: '1', 'stop-color': '#1b6dff', 'stop-opacity': '0.55' }));
    defs.appendChild(g);
    var sl = svg('pattern', { id: 'scan', width: 4, height: 4, patternUnits: 'userSpaceOnUse' });
    sl.appendChild(svg('rect', { width: 4, height: 1.2, fill: '#000', 'fill-opacity': '0.35' })); defs.appendChild(sl);
    s.appendChild(defs);
    var body = svg('g', { 'class': 'holo' });
    // Suit and shoulders, lapels, shirt and tie.
    body.appendChild(svg('path', { d: 'M20 320 C24 250 52 226 92 214 L148 214 C188 226 216 250 220 320 Z', fill: 'url(#holo)' }));
    body.appendChild(svg('path', { d: 'M92 214 L120 262 L148 214 L138 212 L120 240 L102 212 Z', fill: '#e8fdff', 'fill-opacity': '0.8' }));
    body.appendChild(svg('path', { d: 'M114 240 L126 240 L130 300 L120 312 L110 300 Z', fill: '#1b6dff' }));
    body.appendChild(svg('path', { d: 'M92 214 L120 262 L104 300 L70 232 Z', fill: '#3fa9ff', 'fill-opacity': '0.65' }));
    body.appendChild(svg('path', { d: 'M148 214 L120 262 L136 300 L170 232 Z', fill: '#3fa9ff', 'fill-opacity': '0.65' }));
    // Neck and head (on its own group, so it can nod).
    body.appendChild(svg('rect', { x: 104, y: 180, width: 32, height: 40, rx: 10, fill: 'url(#holo)' }));
    var head = svg('g', { 'class': 'head' });
    head.appendChild(svg('ellipse', { cx: 120, cy: 128, rx: 46, ry: 58, fill: 'url(#holo)' }));
    head.appendChild(svg('path', { d: 'M74 122 C72 78 96 62 122 62 C150 62 170 80 166 122 C160 100 150 92 132 90 C112 96 92 96 80 104 Z', fill: '#bff7ff', 'fill-opacity': '0.9' }));
    head.appendChild(svg('ellipse', { cx: 74, cy: 132, rx: 6, ry: 12, fill: 'url(#holo)' }));
    head.appendChild(svg('ellipse', { cx: 166, cy: 132, rx: 6, ry: 12, fill: 'url(#holo)' }));
    head.appendChild(svg('path', { d: 'M92 116 Q102 110 112 116', stroke: '#e8fdff', 'stroke-width': 3, fill: 'none' }));
    head.appendChild(svg('path', { d: 'M128 116 Q138 110 148 116', stroke: '#e8fdff', 'stroke-width': 3, fill: 'none' }));
    var eL = svg('ellipse', { cx: 102, cy: 128, rx: 5, ry: 4, fill: '#ffffff' }), eR = svg('ellipse', { cx: 138, cy: 128, rx: 5, ry: 4, fill: '#ffffff' });
    head.appendChild(eL); head.appendChild(eR);
    head.appendChild(svg('path', { d: 'M120 134 L114 156 L124 156', stroke: '#e8fdff', 'stroke-width': 2, fill: 'none', 'stroke-opacity': '0.7' }));
    var mouth = svg('ellipse', { cx: 120, cy: 168, rx: 14, ry: 1.5, fill: '#03243f', stroke: '#e8fdff', 'stroke-width': 1.5 });
    head.appendChild(mouth);
    body.appendChild(head);
    s.appendChild(body);
    s.appendChild(svg('rect', { width: 240, height: 320, fill: 'url(#scan)' }));
    var band = svg('rect', { x: 0, y: 0, width: 240, height: 10, fill: '#bff7ff', 'fill-opacity': '0.18' }); s.appendChild(band);
    return { el: s, eyes: [eL, eR], mouth: mouth, head: head, band: band, body: body };
  }

  function build() {
    root = document.getElementById('stage');
    root.textContent = '';
    var bar = h('div', 'bar'); els.barL = h('span', null); els.barR = h('span', null, TL.day);
    var b = h('b', null, 'P' + TL.page); els.barL.appendChild(b); els.barL.appendChild(document.createTextNode(' PrompTugal.news Bulletins'));
    bar.appendChild(els.barL); bar.appendChild(els.barR); root.appendChild(bar);
    els.main = h('div', 'main'); root.appendChild(els.main);
    els.rain = h('div', 'rain'); for (var i = 0; i < 60; i++) { var d = h('span', null, '|'); els.rain.appendChild(d); } root.appendChild(els.rain);
    els.side = h('div', 'side'); var av = buildAvatar(); els.av = av; els.side.appendChild(av.el); els.side.appendChild(h('div', 'avl', 'Synthetic presenter · synthetic voice')); root.appendChild(els.side);
    els.wipe = h('div', 'wipe'); for (var j = 0; j < 96; j++) els.wipe.appendChild(h('i')); root.appendChild(els.wipe);
    var foot = h('div', 'foot'); els.tick = h('div', 'tick', TL.ticker + '   ·   ' + TL.ticker); foot.appendChild(els.tick); root.appendChild(foot);
    els.prog = h('div', 'prog'); root.appendChild(els.prog);
    els.sub = h('div', 'sub'); root.appendChild(els.sub);
    var ch = h('div', 'chap'); TL.segs.forEach(function (sg) { var m = h('i'); m.style.left = (sg.start / TL.duration * 100).toFixed(2) + '%'; ch.appendChild(m); }); root.appendChild(ch);
    els.count = h('div', 'count'); root.appendChild(els.count);
    els.lab = h('div', 'lab', TL.label + ' · Voice: synthetic (' + TL.voice + ')'); root.appendChild(els.lab);
    // One scene per segment, built once and shown by time.
    els.scenes = TL.segs.map(function (s) {
      var sc = h('div', 'scene ' + s.kind);
      if (s.kind === 'open') {
        var t = h('div', 'title'); s.show.split('').forEach(function (c) { t.appendChild(h('span', null, c)); }); sc.appendChild(t);
        sc.appendChild(h('div', 'chip', TL.label));
      } else if (s.kind === 'line') {
        var p = h('div', 'line'); s.words.forEach(function (w) { var sp = h('span', /\d/.test(w.w) ? 'w num' : 'w', w.w + ' '); p.appendChild(sp); }); sc.appendChild(p);
        if (s.bars && s.bars.length) { var bx = h('div', 'bars'); s.bars.forEach(function (bb) { var r = h('div', 'brow'); r.appendChild(h('span', 'bn', bb.place)); var f = h('span', 'bf'); r.appendChild(f); r.appendChild(h('span', 'bv', bb.v + ' °C')); bx.appendChild(r); }); sc.appendChild(bx); }
        sc.appendChild(h('div', 'src', s.src));
      } else {
        var m = h('div', 'mapbox'); sc.appendChild(m);
        if (window.PTMap) window.PTMap.render(m, { places: TL.places, current: TL.current, london: TL.london, eu: null, label: 'Where this bulletin is' });
        sc.appendChild(h('div', 'title small', 'bulletins.promptugal.news'));
      }
      els.main.appendChild(sc); return sc;
    });
  }

  function render(t) {
    if (!TL) return;
    t = clamp(t, 0, TL.duration);
    var k = 0; TL.segs.forEach(function (s, i) { if (t >= s.start) k = i; });
    var s = TL.segs[k], lt = t - s.start, len = s.end - s.start;
    els.scenes.forEach(function (sc, i) { sc.style.display = i === k ? 'flex' : 'none'; });
    var sc = els.scenes[k];
    // Page-change wipe: teletext blocks cover then clear in the first 0.35 s of each scene after the first.
    var w = k > 0 ? clamp(1 - lt / 0.35, 0, 1) : 0;
    [].forEach.call(els.wipe.children, function (c, i) { var on = ((i * 37) % 96) / 96 < w; c.style.opacity = on ? 1 : 0; });
    if (s.kind === 'open') {
      [].forEach.call(sc.querySelector('.title').children, function (c, i) { var e = ease((lt - i * 0.05) / 0.4); c.style.opacity = e; c.style.transform = 'translateY(' + ((1 - e) * -60).toFixed(1) + 'px)'; });
      var chip = sc.querySelector('.chip'), ce = ease((lt - 1.2) / 0.6); chip.style.clipPath = 'inset(0 ' + ((1 - ce) * 100).toFixed(1) + '% 0 0)';
    } else if (s.kind === 'line') {
      [].forEach.call(sc.querySelectorAll('.w'), function (c, i) { var e = ease((t - s.words[i].start) / 0.25); c.style.opacity = 0.15 + 0.85 * e; c.style.transform = c.classList.contains('num') ? 'scale(' + (1 + 0.35 * Math.sin(Math.PI * clamp((t - s.words[i].start) / 0.4, 0, 1))).toFixed(3) + ')' : ''; });
      [].forEach.call(sc.querySelectorAll('.brow'), function (r, i) { var bb = s.bars[i], st = s.words[bb.word] ? s.words[bb.word].start : s.start; var e = ease((t - st) / 0.6); r.querySelector('.bf').style.width = (e * bb.v / TL.barMax * 100).toFixed(1) + '%'; r.style.opacity = e; });
      sc.querySelector('.src').style.opacity = ease((lt - 0.8) / 0.6);
    } else {
      var cur = sc.querySelector('.ptm-cur'); if (cur) cur.setAttribute('r', (6 + 3 * Math.abs(Math.sin(t * 3))).toFixed(2));
      sc.style.opacity = ease(lt / 0.5);
    }
    // Rain behind any line that speaks of rain.
    var raining = s.kind === 'line' && /rain/i.test(s.show);
    els.rain.style.opacity = raining ? ease(lt / 0.8) * 0.5 : 0;
    if (raining) [].forEach.call(els.rain.children, function (d, i) { var x = (i * 97) % 100, sp = 140 + (i * 53) % 120; var y = ((t * sp + i * 41) % 760) - 40; d.style.left = x + '%'; d.style.top = y.toFixed(1) + 'px'; });
    // The presenter: mouth from the voice's loudness, a blink every few seconds, a small bob.
    var a = TL.amp[Math.min(TL.amp.length - 1, Math.floor(t * TL.fps))] || 0;
    els.av.mouth.setAttribute('ry', (1.5 + a * 9).toFixed(2)); els.av.mouth.setAttribute('rx', (14 - a * 3).toFixed(2));
    var blink = (t % 3.7) < 0.13; els.av.eyes.forEach(function (e) { e.setAttribute('ry', blink ? 0.6 : 4); });
    els.av.head.setAttribute('transform', 'rotate(' + (Math.sin(t * 1.3) * 2.5 + a * 2).toFixed(2) + ' 120 180)');
    els.av.band.setAttribute('y', ((t * 120) % 340 - 20).toFixed(1));
    els.av.body.setAttribute('opacity', (0.86 + 0.08 * Math.sin(t * 23) * Math.sin(t * 7)).toFixed(3));
    // Subtitles: the words of the current sentence already spoken, the last ten.
    var said = s.words ? s.words.filter(function (w) { return w.start <= t; }).map(function (w) { return w.w; }) : [];
    els.sub.textContent = said.slice(-10).join(' ');
    els.sub.style.opacity = said.length ? 1 : 0;
    els.tick.style.transform = 'translateX(' + (-(t * 90) % (els.tick.scrollWidth / 2 || 1)).toFixed(1) + 'px)';
    els.prog.style.width = (t / TL.duration * 100).toFixed(2) + '%';
    els.count.textContent = String(k + 1).padStart(2, '0') + ' / ' + String(TL.segs.length).padStart(2, '0');
    if (els.list) [].forEach.call(els.list.children, function (li, i) { li.className = i === k ? 'on' : ''; });
  }

  // The interactive player: the audio drives the stage; each sentence can be clicked to jump to it.
  function player() {
    var audio = document.getElementById('voice'); if (!audio) return;
    els.list = document.getElementById('segs');
    TL.segs.forEach(function (s) {
      var li = h('li'); var btn = h('button', null, s.show); btn.type = 'button';
      btn.addEventListener('click', function () { audio.currentTime = s.start + 0.01; audio.play(); });
      li.appendChild(btn);
      (s.links || []).forEach(function (l) { if (!/^https:\/\//.test(l.url)) return; var a = h('a', null, l.id); a.href = l.url; a.rel = 'noopener'; li.appendChild(document.createTextNode(' ')); li.appendChild(a); });
      els.list.appendChild(li);
    });
    (function loop() { render(audio.currentTime || 0); requestAnimationFrame(loop); })();
  }

  window.renderAt = render;
  fetch('timeline.json', { credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (j) {
    TL = j; build(); render(0); player(); window.stageReady = true;
  });
})();

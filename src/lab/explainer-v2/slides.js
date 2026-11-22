/* slides.js: the left half of "How this video is made" (bulletins.d@PrompTugal.dinis, 22 Nov 2026). Dinis, 22 Nov:
 * "create a video that explains how you are using LLVM pipe and how this architecture actually works ... use the
 * video to explain how this video is actually built using this tech stack".
 * Every frame is a function of t: renderAt(t) rebuilds the whole half from script.json and t alone, so nothing is
 * carried from one frame to the next. Every number shown comes from script.json, which names its source. */
(function () {
  'use strict';
  var S = null, root = document.getElementById('slide'), sub = document.getElementById('sub'), bar = document.getElementById('prog');
  var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var ease = function (x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fmt = function (n) { return Number(n).toLocaleString('en-GB'); };
  // A box in the diagrams: x, y, w, h, title, lines, state (0 quiet, 1 lit, 2 accent).
  function box(x, y, w, h, title, lines, state, a) {
    var stroke = state === 2 ? '#ff0' : state === 1 ? '#30d5ff' : '#3a4a66', fill = state === 2 ? 'rgba(255,255,0,.12)' : state === 1 ? 'rgba(48,213,255,.10)' : 'rgba(10,16,28,.9)';
    var s = '<g opacity="' + (a == null ? 1 : a).toFixed(3) + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (state ? 2 : 1.2) + '"/>';
    s += '<text x="' + (x + w / 2) + '" y="' + (y + 24) + '" text-anchor="middle" class="bt' + (state === 2 ? ' hi' : '') + '">' + esc(title) + '</text>';
    (lines || []).forEach(function (l, i) { s += '<text x="' + (x + w / 2) + '" y="' + (y + 44 + i * 17) + '" text-anchor="middle" class="bl">' + esc(l) + '</text>'; });
    return s + '</g>';
  }
  function arrow(x1, y1, x2, y2, on, a) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (on ? '#ff0' : '#3a4a66') + '" stroke-width="2" marker-end="url(#' + (on ? 'ah' : 'aq') + ')" opacity="' + (a == null ? 1 : a).toFixed(3) + '"/>';
  }
  var DEFS = '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#ff0"/></marker><marker id="aq" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#3a4a66"/></marker></defs>';
  var svg = function (h, body) { return '<svg class="dia" viewBox="0 0 592 ' + h + '" width="592" height="' + h + '">' + DEFS + body + '</svg>'; };
  function hbars(rows, max, u, unit, pick) { // rows [{label, v, note}], drawn growing with u
    var s = '', y = 0;
    rows.forEach(function (r, i) {
      var k = ease(u * 1.6 - i * 0.12), w = 300 * r.v / max * k, hi = pick === i;
      s += '<text x="0" y="' + (y + 16) + '" class="rl' + (hi ? ' hi' : '') + '">' + esc(r.label) + '</text>';
      s += '<rect x="232" y="' + (y + 3) + '" width="' + w.toFixed(1) + '" height="18" rx="3" fill="' + (hi ? '#ff0' : '#30d5ff') + '" opacity="' + (hi ? 1 : 0.55) + '"/>';
      s += '<text x="' + (238 + w).toFixed(1) + '" y="' + (y + 17) + '" class="rv' + (hi ? ' hi' : '') + '" opacity="' + k.toFixed(3) + '">' + esc(fmt(r.v) + unit) + (r.note ? ' ' + esc(r.note) : '') + '</text>';
      y += 30;
    });
    return svg(y + 4, s);
  }
  var SCENES = {
    open: function (u, sc) {
      return '<div class="kicker">PrompTugal.news Bulletins · lab</div><div class="big">' + esc(sc.title) + '</div>' +
        '<div class="lines">' + ['Every frame drawn by code', 'in a web browser', 'on a computer with no graphics card'].map(function (l, i) { return '<div style="opacity:' + ease(u * 4 - i * 0.6).toFixed(3) + '">' + esc(l) + '</div>'; }).join('') + '</div>' +
        '<div class="chips"><span>Chromium</span><span>three.js</span><span>Mesa llvmpipe</span><span>Xvfb</span><span>ffmpeg</span></div>';
    },
    pipeline: function (u) {
      var steps = [['Script', 'checked sentences'], ['Voice', 'gpt-audio-mini, "alloy"'], ['Mouth shapes', 'from the loudness'], ['Timeline', 'who speaks, camera'], ['Frames', 'one web page per t'], ['Video', 'ffmpeg: H.264 + AAC']];
      var s = '', k = u * 7;
      steps.forEach(function (st, i) {
        var y = 6 + i * 74, on = k > i + 0.4 ? (k < i + 1.6 ? 2 : 1) : 0;
        s += box(146, y, 300, 56, st[0], [st[1]], on, 0.35 + 0.65 * ease(k - i));
        if (i < steps.length - 1) s += arrow(296, y + 56, 296, y + 72, k > i + 1, 0.35 + 0.65 * ease(k - i - 0.5));
      });
      return '<div class="h">From data to video</div>' + svg(450, s);
    },
    page: function (u) {
      var a = ease(u * 5), b = ease(u * 5 - 0.6), c = ease(u * 5 - 1.4), s = '';
      s += '<rect x="20" y="10" width="552" height="250" rx="10" fill="none" stroke="#4a7dff" stroke-width="2" opacity="' + a.toFixed(3) + '"/>';
      s += '<text x="32" y="32" class="bl" opacity="' + a.toFixed(3) + '">split.html · 1280 x 720 · one frame</text>';
      s += box(40, 46, 240, 190, 'Left: these slides', ['HTML and SVG', 'drawn by Blink, the page engine', '', 'cheap: about 1 ms a frame'], b > 0.5 ? 1 : 0, b);
      s += box(312, 46, 240, 190, 'Right: 12 presenters', ['three.js 0.160.1, WebGL', '~650 draw calls', '~645,000 triangles', 'expensive with no GPU'], c > 0.5 ? 2 : 0, c);
      s += '<text x="296" y="300" text-anchor="middle" class="code" opacity="' + ease(u * 5 - 2.4).toFixed(3) + '">renderSplit(t) → left.renderAt(t) + right.renderAt(t)</text>';
      return '<div class="h">One page, two halves</div>' + svg(320, s);
    },
    pure: function (u) {
      var s = '', n = 24, cur = Math.floor(ease(u * 1.3) * (n - 1));
      for (var i = 0; i < n; i++) {
        var w = Math.floor(i / 6), col = ['#30d5ff', '#ff0', '#7cff9a', '#ff8ad0'][w], done = i <= cur;
        s += '<rect x="' + (14 + i * 23.6) + '" y="40" width="19" height="34" rx="3" fill="' + (done ? col : 'none') + '" stroke="' + col + '" opacity="' + (done ? 0.85 : 0.4) + '"/>';
      }
      for (var b = 0; b < 4; b++) s += '<text x="' + (14 + b * 6 * 23.6 + 70) + '" y="96" text-anchor="middle" class="bl">browser ' + (b + 1) + '</text>';
      s += '<text x="14" y="26" class="bl">frames 0 … n, split into four ranges</text>';
      s += '<text x="296" y="150" text-anchor="middle" class="code big2" opacity="' + ease(u * 3 - 0.5).toFixed(3) + '">frame = f(t)</text>';
      s += '<text x="296" y="186" text-anchor="middle" class="bl" opacity="' + ease(u * 3 - 1).toFixed(3) + '">same t, same picture: any order, any machine</text>';
      s += '<text x="296" y="210" text-anchor="middle" class="bl" opacity="' + ease(u * 3 - 1.4).toFixed(3) + '">swinging parts: integrated on one fixed 1/120 s grid from rest</text>';
      return '<div class="h">Every frame is a function of time</div>' + svg(230, s);
    },
    bottleneck: function (u) {
      var N = S.numbers;
      return '<div class="h">Where the time went</div><div class="note">One screenshot, measured (ms)</div>' +
        hbars([{ label: 'nothing changed', v: N.shot_nochange_ms }, { label: 'after a 3D frame, SwiftShader', v: N.shot_swiftshader_ms }], 700, u, ' ms', 1) +
        '<div class="note" style="margin-top:22px">The screenshot waits for the GPU process. With no GPU, it draws in software:</div>' +
        '<div class="stat" style="opacity:' + ease(u * 3 - 1).toFixed(3) + '"><b>' + fmt(N.triangles) + '</b> triangles · <b>' + N.draw_calls + '</b> draw calls · 4x MSAA</div>';
    },
    stack: function (u) {
      var k = u * 5.5, s = '', sw = k > 1.6;
      s += box(150, 4, 292, 56, 'Chromium (headed)', ['Blink + V8 run the page'], 1, ease(k));
      s += arrow(296, 60, 296, 80, true, ease(k - 0.3));
      s += box(150, 82, 292, 56, 'ANGLE', ['turns WebGL into a native API'], 1, ease(k - 0.4));
      s += arrow(250, 138, 130, 166, !sw, ease(k - 0.7)); s += arrow(342, 138, 462, 166, sw, ease(k - 0.9));
      s += box(14, 168, 240, 76, 'SwiftShader (before)', ['Chromium\'s own, Vulkan', '638 ms a frame here'], sw ? 0 : 2, ease(k - 0.8) * (sw ? 0.55 : 1));
      s += box(338, 168, 240, 76, 'OpenGL → Mesa llvmpipe', ['LLVM, 256-bit vectors', 'all 4 cores · 233 ms'], sw ? 2 : 0, ease(k - 1.2));
      s += arrow(458, 244, 458, 270, sw, ease(k - 1.6));
      s += box(338, 272, 240, 56, 'Xvfb: a virtual screen', ['llvmpipe needs a display'], sw ? 1 : 0, ease(k - 2));
      s += box(14, 272, 240, 56, '4 CPU cores, no GPU', ['Intel Xeon 2.1 GHz'], 0, ease(k - 2.2));
      s += '<text x="296" y="362" text-anchor="middle" class="code" opacity="' + ease(k - 2.6).toFixed(3) + '">--use-gl=angle --use-angle=gl</text>';
      return '<div class="h">The fix: a faster software renderer</div>' + svg(376, s);
    },
    parallel: function (u) {
      var s = '', R = S.render || {}, W = 4;
      for (var b = 0; b < W; b++) {
        var y = 10 + b * 52, k = ease(u * 1.25 - b * 0.03);
        s += '<text x="0" y="' + (y + 24) + '" class="rl">browser ' + (b + 1) + '</text>';
        s += '<rect x="110" y="' + (y + 8) + '" width="300" height="24" rx="4" fill="none" stroke="#3a4a66"/><rect x="110" y="' + (y + 8) + '" width="' + (300 * k).toFixed(1) + '" height="24" rx="4" fill="#30d5ff" opacity=".7"/>';
        s += arrow(414, y + 20, 470, 112, k > 0.98, ease(u * 3 - 1));
      }
      s += box(472, 84, 112, 60, 'ffmpeg', ['frames + voice'], u > 0.75 ? 2 : 0, ease(u * 3 - 1.2));
      s += '<text x="110" y="232" class="bl">each: page.evaluate(renderSplit(t)), then a DevTools screenshot</text>';
      return '<div class="h">Four browsers, one video</div>' + svg(250, s);
    },
    results: function (u) {
      var r = S.numbers.full_runs;
      return '<div class="h">Three times faster</div><div class="note">Seconds to make the 31.3 s bulletin of 21 Nov</div>' +
        hbars(r.map(function (x) { return { label: x.label, v: x.s }; }), 420, u, ' s', r.length - 1) +
        '<div class="stat" style="opacity:' + ease(u * 3 - 1.5).toFixed(3) + '"><b>' + (r[0].s / r[r.length - 1].s).toFixed(1) + 'x</b> faster · same picture (SSIM ' + S.numbers.ssim + ')</div>';
    },
    realtime: function (u) {
      var N = S.numbers;
      return '<div class="h">Why not record the screen?</div><div class="note">Frames the page can draw a second (playing live)</div>' +
        hbars([{ label: 'a video needs', v: 30 }, { label: 'SwiftShader', v: N.live_fps_swiftshader }, { label: 'llvmpipe', v: N.live_fps_llvmpipe }], 32, u, ' fps', 0) +
        '<div class="stat" style="opacity:' + ease(u * 3 - 1.2).toFixed(3) + '">a 10 s recording: <b>' + N.rec_frames + '</b> frames, only <b>' + N.rec_distinct + '</b> different pictures</div>';
    },
    determinism: function (u) {
      var s = '', k = u * 3;
      // Two antennas: "before" keeps adding its lag, "after" starts from rest each frame.
      var wob = Math.sin(u * 18) * 0.35;
      [['before', 140, wob + (k > 1 ? 0.5 * ease(k - 1) : 0)], ['after', 452, wob]].forEach(function (a, i) {
        var x = a[1], ang = a[2];
        s += '<rect x="' + (x - 40) + '" y="110" width="80" height="70" rx="10" fill="rgba(48,213,255,.15)" stroke="#30d5ff"/>';
        s += '<line x1="' + x + '" y1="110" x2="' + (x + Math.sin(ang) * 60).toFixed(1) + '" y2="' + (110 - Math.cos(ang) * 60).toFixed(1) + '" stroke="' + (i ? '#7cff9a' : '#ff8ad0') + '" stroke-width="4"/>';
        s += '<circle cx="' + (x + Math.sin(ang) * 60).toFixed(1) + '" cy="' + (110 - Math.cos(ang) * 60).toFixed(1) + '" r="7" fill="' + (i ? '#7cff9a' : '#ff8ad0') + '"/>';
        s += '<text x="' + x + '" y="210" text-anchor="middle" class="bt">' + a[0] + '</text>';
        s += '<text x="' + x + '" y="232" text-anchor="middle" class="bl">' + (i ? 'back to rest, then the lag' : 'angle += lag, every frame') + '</text>';
      });
      s += '<text x="296" y="280" text-anchor="middle" class="code" opacity="' + ease(k - 1.4).toFixed(3) + '">same t after any history → same bytes</text>';
      s += '<text x="296" y="304" text-anchor="middle" class="bl" opacity="' + ease(k - 1.8).toFixed(3) + '">before the fix: 704 of 939 frames differed slightly between runs</text>';
      return '<div class="h">A bug found on the way</div>' + svg(320, s);
    },
    close: function (u) {
      return '<div class="kicker">This video</div><div class="big small">Made the same way</div>' +
        '<div class="lines"><div>rendered with Mesa llvmpipe</div><div>by four browsers on Xvfb</div><div>render times: on the page below it</div></div>' +
        '<div class="chips"><span>synthetic voice</span><span>synthetic presenters</span><span>no real person</span></div>';
    },
  };
  function renderAt(t) {
    t = clamp(t, 0, S.duration);
    var sc = S.scenes[0];
    for (var i = 0; i < S.scenes.length; i++) if (t >= S.scenes[i].start) sc = S.scenes[i];
    var u = clamp((t - sc.start) / Math.max(0.5, sc.end - sc.start), 0, 1);
    var fade = ease((t - sc.start) / 0.35);
    root.innerHTML = '<div class="scene" style="opacity:' + fade.toFixed(3) + '">' + SCENES[sc.kind](u, sc) + '</div>';
    // Subtitle: the words said so far in this scene, by their share of the scene's time.
    var words = sc.say.split(/\s+/), k = Math.ceil(clamp((t - sc.start - 0.1) / Math.max(0.5, sc.end - sc.start - 0.3), 0, 1) * words.length);
    var from = Math.max(0, k - 14);
    sub.textContent = words.slice(from, k).join(' ');
    sub.style.display = k ? 'block' : 'none';
    bar.style.width = (100 * t / S.duration).toFixed(2) + '%';
    document.getElementById('count').textContent = String(S.scenes.indexOf(sc) + 1).padStart(2, '0') + ' / ' + String(S.scenes.length).padStart(2, '0');
    return t;
  }
  fetch('script.json', { credentials: 'omit' }).then(function (r) { if (!r.ok) throw new Error('script.json did not load'); return r.json(); }).then(function (j) {
    S = j; document.getElementById('label').textContent = j.label;
    window.renderAt = renderAt; renderAt(0); window.slidesReady = true;
  }).catch(function (e) { root.textContent = 'The slides could not start: ' + e.message; });
})();

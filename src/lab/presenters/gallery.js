/* The presenters gallery and wall (bulletins.b@, 20 Nov 2026). One timeline and one voice drive every presenter at
 * once: the director makes the actions, stateAt folds them at time t, each presenter applies the same state.
 * index.html: cards, the audio drives them, each card shows its spec. wall.html: 1280 x 720, for the side-by-side
 * video, every frame a function of t (window.renderAt). */
(function () {
  'use strict';
  var wall = document.body.classList.contains('wall');
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  Promise.all([fetch('presenters.json', { credentials: 'omit' }).then(function (r) { return r.json(); }), fetch(document.body.getAttribute('data-timeline') || '../video/timeline.json', { credentials: 'omit' }).then(function (r) { return r.json(); })]).then(function (res) {
    // A timeline may carry its own actions (the explainer scripts them); otherwise the director writes them.
    var P = res[0].presenters, TL = res[1], acts = Array.isArray(TL.actions) ? TL.actions : window.Presenters.direct(TL, 'gallery');
    var grid = document.getElementById('grid'), live = [];
    P.forEach(function (spec) {
      var card = h('figure', 'card bd-' + spec.backdrop), stage = h('div', 'pstage');
      card.appendChild(stage);
      var cap = h('figcaption'); cap.appendChild(h('b', null, spec.name)); cap.appendChild(h('span', 'cat', spec.category));
      if (!wall) { cap.appendChild(h('span', 'tags', spec.tags.join(' · ') + ' · render: ' + spec.render + ' · kind: ' + spec.kind)); if (spec.credit) cap.appendChild(h('span', 'credit', spec.credit)); var pre = h('details'); pre.appendChild(h('summary', null, 'Its description in the presenter language')); pre.appendChild(h('pre', null, JSON.stringify(spec, null, 2))); cap.appendChild(pre); }
      card.appendChild(cap); grid.appendChild(card);
      live.push(window.Presenters.build(spec, stage));
    });
    var sub = document.getElementById('sub');
    function render(t) {
      var a = TL.amp[Math.min(TL.amp.length - 1, Math.floor(t * TL.fps))] || 0, s = window.Presenters.stateAt(acts, t, a);
      live.forEach(function (p) { p.apply(s); });
      if (window.onPresentersFrame) window.onPresentersFrame(t, s);
      if (sub) { var said = []; TL.segs.forEach(function (sg) { if (t >= sg.start && t < sg.end) said = sg.words.filter(function (w) { return w.start <= t; }).map(function (w) { return w.w; }); }); sub.textContent = said.slice(-12).join(' '); }
      var pr = document.getElementById('prog'); if (pr) pr.style.width = (t / TL.duration * 100).toFixed(2) + '%';
    }
    window.renderAt = render; render(0);
    var audio = document.getElementById('voice');
    if (audio) (function loop() { render(audio.currentTime || 0); requestAnimationFrame(loop); })();
    window.galleryReady = true;
  });
})();

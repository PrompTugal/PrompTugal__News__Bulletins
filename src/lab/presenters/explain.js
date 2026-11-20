/* The explainer's right half (bulletins.b@, 20 Nov 2026): each scene of explainer.json drawn at time t, beside the
 * presenters (gallery.js, same timeline, scripted actions). The state box shows the very state the presenters are
 * applying in that frame (window.onPresentersFrame), so the numbers and the drawings move together. */
(function () {
  'use strict';
  var TL = null, last = null;
  var $ = function (id) { return document.getElementById(id); };
  var ease = function (x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); };
  var ACTIONS = ['speak', 'blink', 'nod', 'look', 'point', 'emote'];
  window.onPresentersFrame = function (t, s) { last = s; };
  function bar(v) { return '<span class="bars"><i style="width:' + Math.round(Math.max(0, Math.min(1, Math.abs(v))) * 100) + '%"></i></span>'; }
  function render(t) {
    if (!TL) return;
    var k = 0; TL.segs.forEach(function (s, i) { if (t >= s.start) k = i; });
    var s = TL.segs[k], lt = t - s.start, len = s.end - s.start;
    var title = $('title'); title.textContent = s.title.slice(0, Math.ceil(s.title.length * ease(lt / 0.8)));
    [].forEach.call($('diagram').children, function (d, i) {
      var on = s.diagram === i || (s.code && s.diagram == null && i === 0) || (s.chips && i === 2);
      d.className = on ? 'on' : '';
    });
    var L = $('lines'); if (L.dataset.k !== String(k)) { L.dataset.k = k; L.textContent = ''; (s.lines || []).forEach(function (x) { var d = document.createElement('div'); d.textContent = x; L.appendChild(d); }); }
    [].forEach.call(L.children, function (d, i) { var e = ease((lt - 0.6 - i * (len - 1) / Math.max(1, (s.lines || []).length)) / 0.5); d.style.opacity = e; d.style.transform = 'translateX(' + ((1 - e) * 30).toFixed(1) + 'px)'; });
    var C = $('code'); C.style.display = s.code ? 'block' : 'none'; if (s.code) { C.textContent = s.code.slice(0, Math.ceil(s.code.length * ease((lt - 0.4) / Math.min(4, len * 0.7)))); C.style.top = s.lines ? '290px' : '196px'; }
    var H = $('chips'); if (H.dataset.k !== String(k)) { H.dataset.k = k; H.textContent = ''; if (s.chips) ACTIONS.forEach(function (a) { var c = document.createElement('span'); c.textContent = a; c.dataset.a = a; H.appendChild(c); }); }
    var pulse = 0.5 + 0.5 * Math.sin(t * 6);
    [].forEach.call(H.children, function (c) { var on = (s.chips || []).indexOf(c.dataset.a) >= 0; c.className = on ? 'on' : ''; c.style.transform = on ? 'scale(' + (1 + 0.06 * pulse).toFixed(3) + ')' : ''; });
    H.style.top = s.lines ? (180 + 34 * (s.lines.length + 2)) + 'px' : '330px';
    if (last) $('state').innerHTML = '<b>state at t = ' + t.toFixed(2) + ' s</b><br>mouth ' + bar(last.mouth) + last.mouth.toFixed(2) + ' &nbsp; blink ' + bar(last.blink) + last.blink.toFixed(2) + '<br>nod ' + bar(last.nod) + last.nod.toFixed(2) + ' &nbsp; look ' + bar(last.look) + last.look.toFixed(2) + '<br>arm ' + bar(last.arm) + last.arm.toFixed(2) + ' &nbsp; smile ' + bar(last.smile) + last.smile.toFixed(2);
    var said = s.words.filter(function (w) { return w.start <= t; }).map(function (w) { return w.w; });
    $('sub').textContent = said.slice(-11).join(' ');
    $('prog').firstChild.style.width = (t / TL.duration * 100).toFixed(2) + '%';
    $('count').textContent = String(k + 1).padStart(2, '0') + ' / ' + String(TL.segs.length).padStart(2, '0');
  }
  fetch('explainer.json', { credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (j) {
    TL = j;
    (function wait() {
      if (!window.galleryReady) return setTimeout(wait, 50);
      window.renderExplain = function (t) { window.renderAt(t); render(t); };
      window.renderExplain(0); window.explainReady = true;
    })();
  });
})();

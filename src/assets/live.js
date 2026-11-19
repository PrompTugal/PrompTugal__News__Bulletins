/*! bulletins.promptugal.news: live figures and the bulletin's age, in the browser (bulletins.b@PrompTugal.dinis).
 * Dinis, 19 Nov 2026, about 01:13 UTC: "load the data in the browser" (main repo board/guidance/
 * 2026-11-19-load-the-data-in-the-browser.md). Each [data-live] figure is re-read from our own data host only
 * (https://data.promptugal.news), with no cookie and no referrer. A value replaces the built one only if it is a
 * whole number within the element's bounds and its read time is newer than the built one; otherwise the built
 * figure stays. Every value is written with textContent. Each [data-written] bulletin shows its age, marked stale
 * past its cadence. Nothing is stored or sent. */
(function () {
  'use strict';
  var HOST = 'data.promptugal.news';
  function okUrl(u) { try { var x = new URL(u); return x.protocol === 'https:' && x.hostname === HOST && !x.port && !x.username && !x.password; } catch (e) { return false; } }
  function at(obj, path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : (k === 'length' && Array.isArray(o) ? o.length : o[k]); }, obj); }
  function hhmm(d) { return d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; }
  function ago(ms) { var m = Math.round(ms / 60000); return m < 60 ? m + ' minutes' : Math.round(m / 60) + ' hours'; }
  var cache = {};
  function get(u) { return cache[u] || (cache[u] = fetch(u, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); })); }
  function refresh() {
    cache = {};
    [].forEach.call(document.querySelectorAll('[data-live]'), function (el) {
      var u = el.getAttribute('data-url'), v = el.querySelector('.v'), s = el.querySelector('.s');
      var min = Number(el.getAttribute('data-min')), max = Number(el.getAttribute('data-max')), cad = Number(el.getAttribute('data-cadence-min')) || 60;
      var built = Date.parse(el.getAttribute('data-read-at'));
      if (!okUrl(u) || !v || !s) return;
      get(u).then(function (j) {
        var val = at(j, el.getAttribute('data-path')), t = Date.parse(at(j, el.getAttribute('data-read-at-path')));
        if (!(typeof val === 'number' && isFinite(val) && Math.floor(val) === val && val >= min && val <= max) || isNaN(t) || t < built) throw 0;
        v.textContent = String(val);
        var old = Date.now() - t > cad * 1.5 * 60000;
        s.textContent = (old ? 'stale: ' : 'live: ') + 'read ' + hhmm(new Date(t)) + (old ? ', ' + ago(Date.now() - t) + ' ago' : '');
        el.className = old ? 'live stale' : 'live now';
      }).catch(function () {
        var oldB = !isNaN(built) && Date.now() - built > cad * 1.5 * 60000;
        s.textContent = 'built copy: read ' + (isNaN(built) ? 'unknown' : hhmm(new Date(built))) + (oldB ? ' (stale)' : '');
      });
    });
    [].forEach.call(document.querySelectorAll('[data-written]'), function (el) {
      var t = Date.parse(el.getAttribute('data-written')), cad = Number(el.getAttribute('data-cadence-min')) || 180;
      if (isNaN(t)) return;
      var age = Date.now() - t;
      el.textContent = 'This bulletin is ' + ago(age) + ' old' + (age > cad * 60000 ? ': stale; a newer one is due at the next wake.' : '.');
      if (age > cad * 60000) el.className = 'age stale';
    });
  }
  refresh();
  setInterval(refresh, 5 * 60000);
})();

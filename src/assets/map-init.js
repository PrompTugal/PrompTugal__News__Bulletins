/* Draws the shared map (ptmap, vendored next to this file) from the JSON in #ptmap-data. No network. */
(function () {
  'use strict';
  function go() {
    var host = document.getElementById('ptmap'), d = document.getElementById('ptmap-data');
    if (!host || !d || !window.PTMap) return;
    var o; try { o = JSON.parse(d.textContent); } catch (e) { return; }
    if (!o || typeof o !== 'object') return;
    window.PTMap.render(host, { places: o.places, current: o.current, london: o.london, eu: o.eu, label: o.label });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();

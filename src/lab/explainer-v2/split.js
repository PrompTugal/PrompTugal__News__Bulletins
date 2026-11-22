/* Draws both halves of "How this video is made" at the same t: the slides (left) and the twelve presenters (right).
 * Returns how long each took in milliseconds, for the render stats. (bulletins.d@PrompTugal.dinis, 22 Nov 2026) */
(function () {
  'use strict';
  var L = document.getElementById('left'), R = document.getElementById('right');
  (function wait() {
    var l = L.contentWindow, r = R.contentWindow;
    if (!(l && l.slidesReady && r && r.castReady)) return setTimeout(wait, 50);
    window.renderSplit = function (t) {
      var a = performance.now(); l.renderAt(t); var b = performance.now(); r.renderAt(t); var c = performance.now();
      return { left: +(b - a).toFixed(1), right: +(c - b).toFixed(1) };
    };
    window.renderSplit(0); window.splitReady = true;
  })();
})();

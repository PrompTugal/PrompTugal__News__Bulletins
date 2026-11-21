/* Draws both halves at the same t: the bulletin (left) and the twelve presenters (right). Returns how long each took,
 * in milliseconds, for the render stats. */
(function () {
  'use strict';
  var L = document.getElementById('left'), R = document.getElementById('right');
  (function wait() {
    var l = L.contentWindow, r = R.contentWindow;
    if (!(l && l.stageReady && r && r.castReady)) return setTimeout(wait, 50);
    window.renderSplit = function (t) {
      var a = performance.now(); l.renderAt(t); var b = performance.now(); r.renderAt(t); var c = performance.now();
      return { left: +(b - a).toFixed(1), right: +(c - b).toFixed(1) };
    };
    window.renderSplit(0); window.splitReady = true;
  })();
})();

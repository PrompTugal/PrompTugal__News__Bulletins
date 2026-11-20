/* The split screen: the bulletin stage (../video/stage.js) on the left, the presenters (gallery.js) on the right, both
 * drawn at the same t by window.renderSplit(t). Same origin, so the frame's renderAt is reachable. */
(function () {
  'use strict';
  var frame = document.getElementById('right');
  function ready() { var w = frame.contentWindow; return window.galleryReady && w && w.stageReady; }
  (function wait() {
    if (!ready()) return setTimeout(wait, 50);
    var left = window.renderAt, right = frame.contentWindow.renderAt;
    window.renderSplit = function (t) { left(t); right(t); };
    window.renderSplit(0); window.splitReady = true;
  })();
})();

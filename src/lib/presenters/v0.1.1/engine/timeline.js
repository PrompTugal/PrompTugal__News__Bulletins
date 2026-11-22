/* timeline.js: the clock of a page. It is the only thing in version 2 that reads real time, and all it does with
 * it is choose which t to ask for. Drawing never looks at the clock: the page calls render(t), and render(t) gives
 * the same picture whether t came from playing, from the scrub bar or from the video exporter. */
export class Clock {
  constructor(duration, onFrame) { this.duration = duration; this.onFrame = onFrame; this.t = 0; this.speed = 1; this.playing = false; this.loop = false; this.last = null; this.raf = 0; this.tick = this.tick.bind(this); }
  tick(now) { // now is requestAnimationFrame's own timestamp
    if (!this.playing) return;
    if (this.last !== null) {
      let t = this.t + Math.min(0.1, (now - this.last) / 1000) * this.speed;
      if (t >= this.duration) { if (this.loop) t %= this.duration; else { t = this.duration; this.playing = false; } }
      this.t = t; this.onFrame(t, this);
    }
    this.last = now; if (this.playing) this.raf = requestAnimationFrame(this.tick); else this.onFrame(this.t, this);
  }
  play() { if (this.playing) return; if (this.t >= this.duration) this.t = 0; this.playing = true; this.last = null; this.raf = requestAnimationFrame(this.tick); this.onFrame(this.t, this); }
  pause() { this.playing = false; cancelAnimationFrame(this.raf); this.onFrame(this.t, this); }
  toggle() { if (this.playing) this.pause(); else this.play(); }
  seek(t) { this.t = Math.max(0, Math.min(this.duration, t)); this.last = null; this.onFrame(this.t, this); }
}

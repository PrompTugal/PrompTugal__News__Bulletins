/* captions.js: eight ways to show what is said, each a pure function of t (bulletins.d@PrompTugal.dinis, 22 Nov 2026).
 * Dinis, 22 Nov: "explore different ways of doing the subtitles ... this has to work outside sound ... every word is
 * highlighted or every group of words is highlighted ... different formats, different layouts. Sometimes you show more
 * of the page, sometimes you show less ... programmatically choose how much of the phrase is actually shown and the
 * pacing of it ... match the text being shown to the voice audio".
 * Input: words [{ w, s, e, p (phrase index), emph }], each with its spoken start and end in seconds, from the voice
 * itself (one take per phrase, so phrase times are exact; words inside a phrase are placed by syllables). Controls,
 * per style: window (how many words are on screen), lead (how early text appears), hold (how long it stays), and
 * the layout. Nothing is kept between calls: render(style, words, t, opt) returns the overlay's HTML. */
(function () {
  'use strict';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const clean = (w) => w.replace(/\*/g, '');
  // The word being spoken at t (or the last one spoken), -1 before the first.
  const current = (W, t) => { let k = -1; for (let i = 0; i < W.length; i++) if (W[i].s <= t) k = i; return k; };
  const phrases = (W) => { const P = []; for (const x of W) (P[x.p] = P[x.p] || []).push(x); return P.filter(Boolean); };
  const word = (x, t, cls = '') => {
    const st = t < x.s ? 'next' : t < x.e ? 'now' : 'done', fill = clamp((t - x.s) / Math.max(0.05, x.e - x.s), 0, 1);
    return `<span class="w ${st}${x.emph ? ' emph' : ''} ${cls}" style="--f:${(fill * 100).toFixed(1)}%">${esc(clean(x.w))}</span>`;
  };

  const STYLES = {
    // 1. Karaoke: the whole sentence stays; each word fills with colour as it is spoken.
    karaoke(W, t, o) {
      const P = phrases(W), k = current(W, t), pi = k < 0 ? 0 : W[k].p, cur = P.findIndex((ph) => ph[0].p === pi);
      // Show the phrase being spoken and the next one: a sentence-sized window.
      const show = P.slice(Math.max(0, cur), Math.max(0, cur) + (o.window || 2));
      return `<div class="cap karaoke">${show.map((ph) => `<div class="line">${ph.map((x) => word(x, t, 'kfill')).join(' ')}</div>`).join('')}</div>`;
    },
    // 2. One word at a time, big, centred.
    word(W, t, o) {
      const k = current(W, t); if (k < 0) return '';
      const x = W[k], lead = o.lead || 0, held = t <= x.e + (o.hold ?? 0.25) || (W[k + 1] && W[k + 1].s - lead <= t);
      const nx = W[k + 1] && t >= W[k + 1].s - lead ? W[k + 1] : x;
      const age = t - nx.s, pop = 0.82 + 0.18 * ease(age / 0.12);
      return held ? `<div class="cap one"><span class="big${nx.emph ? ' emph' : ''}" style="transform:scale(${pop.toFixed(3)})">${esc(clean(nx.w))}</span></div>` : '';
    },
    // 3. Small groups of N words; the spoken word is larger.
    groups(W, t, o) {
      const n = o.window || 3, k = current(W, t); if (k < 0) return '';
      const g = Math.floor(k / n), part = W.slice(g * n, g * n + n);
      const age = t - part[0].s, rise = (1 - ease(age / 0.15)) * 18;
      return `<div class="cap groups" style="transform:translateY(${rise.toFixed(1)}px);opacity:${ease(age / 0.12).toFixed(3)}">${part.map((x) => word(x, t)).join(' ')}</div>`;
    },
    // 4. Roll-up, broadcast style: two lines; a new line pushes the old one up.
    rolling(W, t, o) {
      const P = phrases(W), k = current(W, t); if (k < 0) return '';
      const pi = W[k].p, idx = P.findIndex((ph) => ph[0].p === pi), lines = P.slice(Math.max(0, idx - 1), idx + 1);
      const age = t - P[idx][0].s, shift = (1 - ease(age / 0.25)) * 44;
      // Each word is coloured as it is spoken, the whole word at once (Dinis, 23 Nov: "it should color code the word, the full word").
      return `<div class="cap rolling"><div class="roll" style="transform:translateY(${shift.toFixed(1)}px)">${lines.map((ph, i) => `<div class="line">${ph.map((x) => word(x, t, 'rl')).join(' ')}</div>`).join('')}</div></div>`;
    },
    // 5. The page: the whole paragraph is visible; spoken words turn bright, a marker follows the voice.
    page(W, t, o) {
      return `<div class="cap page"><div class="kick">${esc(o.title || '')}</div><p>${W.map((x) => word(x, t, 'pg')).join(' ')}</p></div>`;
    },
    // 6. A speech bubble from the presenter, one phrase per bubble, typed out with the voice.
    bubble(W, t, o) {
      const P = phrases(W), k = current(W, t); if (k < 0) return '';
      const ph = P.find((q) => q[0].p === W[k].p), first = ph[0], last = ph[ph.length - 1];
      if (t > last.e + (o.hold ?? 0.6) && (!W[k + 1] || W[k + 1].p !== W[k].p)) { /* between phrases: keep the bubble until the next */ }
      const chars = ph.map((x) => clean(x.w)).join(' '), shownTo = ph.filter((x) => x.s <= t).reduce((n, x) => n + clean(x.w).length + 1, 0);
      const cur = ph.find((x) => t >= x.s && t < x.e), part = cur ? clamp((t - cur.s) / (cur.e - cur.s), 0, 1) : 1;
      const n = Math.min(chars.length, Math.round(shownTo - (cur ? (clean(cur.w).length + 1) * (1 - part) : 0)));
      const pop = ease((t - first.s) / 0.18);
      return `<div class="cap bubble" style="transform:scale(${(0.9 + 0.1 * pop).toFixed(3)});opacity:${pop.toFixed(3)}"><span>${esc(chars.slice(0, Math.max(1, n)))}</span><span class="ghost">${esc(chars.slice(Math.max(1, n)))}</span></div>`;
    },
    // 7. Kinetic type: words marked important are big and coloured; small words stay quiet. One phrase at a time.
    kinetic(W, t, o) {
      const P = phrases(W), k = current(W, t); if (k < 0) return '';
      const ph = P.find((q) => q[0].p === W[k].p);
      return `<div class="cap kinetic">${ph.map((x) => { const on = x.s <= t + 0.02, a = ease((t - x.s) / 0.14); return `<span class="kw${x.emph ? ' emph' : ''}${on ? '' : ' wait'}" style="opacity:${on ? (0.35 + 0.65 * a).toFixed(3) : 0};transform:translateY(${on ? ((1 - a) * 14).toFixed(1) : 14}px)">${esc(clean(x.w))}</span>`; }).join(' ')}</div>`;
    },
    // 8. The ticker: the current phrase in a bar; everything already said in a column.
    ticker(W, t, o) {
      const P = phrases(W), k = current(W, t); if (k < 0) return '';
      const idx = P.findIndex((q) => q[0].p === W[k].p), ph = P[idx];
      const slide = (1 - ease((t - ph[0].s) / 0.3)) * 60;
      const said = P.slice(0, idx).map((q) => `<li>${esc(q.map((x) => clean(x.w)).join(' '))}</li>`).join('');
      return `<div class="cap ticker"><ol class="said">${said}</ol><div class="bar"><b>${esc(o.label || 'NOW')}</b><span style="transform:translateX(${slide.toFixed(1)}px)">${ph.map((x) => word(x, t, 'tk')).join(' ')}</span></div></div>`;
    },
  };
  /* The three recommended styles, and how to choose between them (Dinis, 23 Nov: "I really like the roll-up ... I like
   * the kinetic one ... the page is quite good ... when there's longer text ... between these three ... we choose
   * strategically when we use them"). choose(W) looks at a segment's words:
   *   page     long explanations: more than 40 words, or sentences longer than 22 words on average;
   *   kinetic  short lines that carry key words: at most 16 words with at least one word marked important;
   *   rolling  everything else: ordinary narration. */
  function choose(W) {
    const n = W.length, sentences = Math.max(1, W.filter((x) => /[.?!]$/.test(clean(x.w))).length), emph = W.filter((x) => x.emph).length;
    if (n > 40 || n / sentences > 22) return 'page';
    if (n <= 16 && emph > 0) return 'kinetic';
    return 'rolling';
  }
  const RECOMMENDED = ['rolling', 'kinetic', 'page'];
  window.Captions = {
    render(style, W, t, o = {}) { const st = style === 'auto' ? choose(W) : style, f = STYLES[st]; return f ? f(W, t, o) : ''; },
    choose, styles: Object.keys(STYLES), recommended: RECOMMENDED,
  };
})();

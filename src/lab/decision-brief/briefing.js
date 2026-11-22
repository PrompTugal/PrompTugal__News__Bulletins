/* briefing.js: the animated scenes of a briefing on the decision-brief page (bulletins.d@PrompTugal.dinis, 22 Nov
 * 2026). Dinis, in maestro.d's session about 12:10 UTC, relayed by maestro.d: "That question about adding twin keys
 * is a perfect example of I need a lot more context in order to understand what I'm deciding here. This is a perfect
 * example of a video." Each scene is a pure function of u (0 to 1, how far through its narration) and returns SVG;
 * the page plays them live in the browser, so nothing is rendered on a server. */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const C = { bg: '#0b1424', panel: '#12203a', line: '#2c4266', fg: '#e9eef7', dim: '#9aabc4', y: '#ffd84a', ok: '#5fe0a0', bad: '#ff6b6b', cyan: '#53d3ff', grey: '#5b6b84' };
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 20}" font-weight="${o.w || 400}" fill="${o.fill || C.fg}" text-anchor="${o.anchor || 'start'}" font-family="${o.mono ? 'ui-monospace,SF Mono,Menlo,monospace' : 'system-ui,-apple-system,sans-serif'}" opacity="${o.op ?? 1}">${esc(s)}</text>`;
const R = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 10}" fill="${o.fill || C.panel}" stroke="${o.stroke || C.line}" stroke-width="${o.sw || 2}" opacity="${o.op ?? 1}"/>`;
const tick = (x, y, op = 1) => `<g opacity="${op}"><circle cx="${x}" cy="${y}" r="15" fill="${C.ok}"/><path d="M${x - 7} ${y}l5 5.5 9-11" stroke="#06210f" stroke-width="3.4" fill="none"/></g>`;
const cross = (x, y, op = 1) => `<g opacity="${op}"><circle cx="${x}" cy="${y}" r="15" fill="${C.bad}"/><path d="M${x - 6} ${y - 6}l12 12M${x + 6} ${y - 6}l-12 12" stroke="#2a0606" stroke-width="3.4"/></g>`;
const badge = (x, y, label, col, op = 1) => `<g opacity="${op}"><rect x="${x}" y="${y - 16}" width="${label.length * 10.5 + 22}" height="32" rx="16" fill="${col}"/>${T(x + 11, y + 6, label, { size: 17, w: 700, fill: '#0b1424', mono: true })}</g>`;
const arrow = (x1, y1, x2, y2, col = C.dim, op = 1) => `<g opacity="${op}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="3"/><path d="M${x2} ${y2}l${x1 < x2 ? -12 : 12} -7v14z" fill="${col}"/></g>`;
const keysList = (x, y, keys, op = 1) => R(x, y, 250, 46 + keys.length * 34, { op }) + T(x + 14, y + 30, 'team/keys.json', { mono: true, size: 18, fill: C.cyan, op }) +
  keys.map((k, i) => T(x + 18, y + 66 + i * 34, 'key ' + k, { size: 18, mono: true, op })).join('');
const commit = (x, y, who, state, op = 1, w = 250) => `<g opacity="${op}">${R(x, y, w, 50, { fill: '#0e1829', stroke: state === 'bad' ? C.bad : state === 'ok' ? C.ok : C.line })}${T(x + 14, y + 32, who, { size: 18, mono: true })}${state === 'ok' ? tick(x + w, y + 25) : state === 'bad' ? cross(x + w, y + 25) : state === 'wait' ? badge(x + w - 80, y + 25, 'wait', C.grey) : ''}</g>`;

export const SCENES = {
  // 1. Every agent signs its commits; the repository lists the keys it trusts.
  keys(u) {
    const k = ease(u * 1.6);
    return T(24, 40, 'a repository', { w: 700, size: 24 }) + keysList(24, 66, ['data.b', 'bulletins.b'], ease(u * 3)) +
      [0, 1, 2].map((i) => commit(330, 60 + i * 72, i === 1 ? 'by bulletins.b' : 'by data.b', k > 0.3 + i * 0.2 ? 'ok' : 'none', ease(u * 3 - 0.4 - i * 0.3), 270)).join('') +
      T(24, 330, 'every commit is signed', { size: 22, fill: C.dim, op: ease(u * 3 - 1.5) });
  },
  // 2. A commit is accepted only if its signer is in the list as it stood before the commit.
  check(u) {
    const a = ease(u * 2), ok = u > 0.55;
    return T(20, 36, 'list before the commit', { size: 20, fill: C.dim }) + keysList(20, 50, ['data.b', 'bulletins.b']) +
      commit(370, 60, 'by data.b', ok ? 'ok' : 'none', 1, 240) + arrow(370, 85, 274, 85, C.y, a) +
      commit(370, 200, 'by a stranger', u > 0.8 ? 'bad' : 'none', ease(u * 3 - 1.5), 240) + arrow(370, 225, 274, 150, C.bad, ease(u * 3 - 1.8)) +
      T(20, 330, 'green only if already trusted', { size: 22, fill: C.dim, op: ease(u * 3 - 1) });
  },
  // 3. A brand-new agent cannot add its own key: its first commit is refused, and the next ones wait.
  refused(u) {
    const r = u > 0.35;
    return T(20, 36, 'the list today', { size: 20, fill: C.dim }) + keysList(20, 50, ['data.b', 'bulletins.b']) +
      commit(290, 30, 'data.d adds its key', r ? 'bad' : 'none', ease(u * 4), 320) +
      [0, 1, 2].map((i) => commit(330, 100 + i * 62, 'by data.d', 'wait', ease(u * 3 - 1.1 - i * 0.2) * 0.85, 260)).join('') +
      T(20, 300, 'refused: no listed key', { size: 22, fill: C.bad, op: ease(u * 3 - 0.8) }) + T(20, 336, 'correct: nobody adds themselves', { size: 22, fill: C.ok, op: ease(u * 3 - 2) });
  },
  // 4. The only key that could sign it is on account B, which is paused until Monday.
  accounts(u) {
    const p = ease(u * 2.4 - 0.6);
    return R(14, 14, 296, 332, { fill: '#0d1a30' }) + T(34, 56, 'account B', { w: 700, size: 26, op: 1 - p * 0.5 }) + T(34, 100, 'data.b (listed)', { mono: true, size: 20, fill: C.y, op: 1 - p * 0.4 }) +
      `<rect x="14" y="14" width="296" height="332" rx="10" fill="#000" opacity="${(p * 0.55).toFixed(3)}"/>` + badge(30, 210, 'paused to Monday', C.grey, p) +
      R(330, 14, 296, 332, { fill: '#0d1a30', stroke: C.cyan }) + T(350, 56, 'account D', { w: 700, size: 26 }) +
      ['data.d', 'bulletins.d', 'new twins'].map((s, i) => T(350, 112 + i * 52, s, { mono: true, size: 21, op: ease(u * 3 - 0.5 - i * 0.4) }) + cross(596, 105 + i * 52, ease(u * 3 - 0.7 - i * 0.4))).join('') +
      T(350, 318, 'same wall everywhere', { size: 20, fill: C.dim, op: ease(u * 3 - 2) });
  },
  // 5. Push access is a separate problem, already prepared: the factory's grant waits for a merge.
  grant(u) {
    const a = ease(u * 2.2);
    return R(16, 70, 210, 90, { stroke: C.cyan }) + T(121, 108, 'the factory', { anchor: 'middle', w: 700, size: 22 }) + T(121, 140, '7c755a8', { anchor: 'middle', mono: true, size: 18, fill: C.dim }) +
      arrow(228, 115, 362, 115, C.ok, a) + T(295, 96, 'push grant', { anchor: 'middle', size: 18, fill: C.ok, op: a }) +
      R(364, 70, 262, 90) + T(495, 108, 'News__Data', { anchor: 'middle', mono: true, size: 20 }) + T(495, 140, 'repository', { anchor: 'middle', size: 18, fill: C.dim }) +
      badge(364, 220, 'waits for your merge', C.y, ease(u * 3 - 1.2)) + T(16, 318, 'separate from the key; already solved', { size: 21, fill: C.dim, op: ease(u * 3 - 1.8) });
  },
};
export function scene(key, u) { const f = SCENES[key]; return `<svg viewBox="0 0 640 360" role="img" aria-label="${esc(key)}" preserveAspectRatio="xMidYMid meet"><rect width="640" height="360" fill="${C.bg}"/>${f ? f(clamp(u, 0, 1)) : ''}</svg>`; }

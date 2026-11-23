/* brief.js: a decision brief that plays in the browser, with no video render (bulletins.d@PrompTugal.dinis, 22 Nov
 * 2026). Dinis, relayed by maestro.d and confirmed in bulletins.d@'s session: "a briefing from one character ... the
 * questions and then the answers ... a place for me to put the answers, or I voice over the answers ... this would not
 * need to be rendered ... on my device, for example, the iPhone".
 * Version 2, after Dinis tried it on his iPhone (about 12:40 UTC, relayed by maestro.d): "the narrator should be on
 * the right, should be talking. I need the subtitles ... the narrator should not be the center of attention. You
 * should be using the UI to explain this to me ... my focus should be on the animation ... in the end ... you actually
 * present me the decision ... not ... until I get to the point where I need to decide ... this video player should
 * have controls ... go back and forward in the actual animation ... the end of the current frame animation and the
 * beginning of the next frame. They are both touch points".
 * Each decision is a story of beats: context first (animated scenes from briefing.js), the decision last. A player
 * clock t drives everything: the scene (a pure function of how far through its beat), the subtitles, and Duarte
 * (small, on the right, mouth on the narration). The voice is Claude's where offered, else the browser's (iPhone
 * Safari), else none; when a voice speaks, its word positions pull the clock along so all stay in step. */
import { scene } from './briefing.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WHO = 'anchor', WPS = 2.55, GAP = 0.45, L = (k) => String.fromCharCode(65 + k);
const state = { i: 0, t: 0, playing: false, answers: {}, reached: {}, db: null, me: null, tts: null, show: null, dict: null, items: [], spoken: null };

// ---------- Stories: each question becomes beats; the last beat is the decision ----------
function storyOf(q, brief) {
  const beats = [];
  const br = q.briefing && (brief.briefings || []).find((b) => b.id === q.briefing);
  if (br) for (const k of (q.beats || br.beats.map((_, k) => k))) { const b = br.beats[k]; beats.push({ kind: 'scene', visual: b.visual, narration: b.narration, caption: b.caption, sources: b.sources }); }
  else beats.push({ kind: 'context', narration: `${q.title} ${q.why}`, caption: `${q.title} ${q.why}`, sources: (q.numbers || []).map((n) => n.source) });
  const opts = q.options.map((o, k) => `${L(k)}: ${o.label}.`).join(' ');
  beats.push({ kind: 'decision', narration: `Here is the decision. ${q.options.map((o, k) => `${L(k)}, ${o.label}.`).join(' ')} My recommendation: ${q.recommend.say}`, caption: `The decision. ${opts} Recommended: ${q.recommend.say}`, sources: [] });
  return beats;
}
function timeBeats(beats, t0) {
  let t = t0;
  for (const b of beats) {
    b.words = []; b.start = t;
    for (const w of b.narration.split(/\s+/).filter(Boolean)) { const d = Math.max(0.22, (w.length + 1) / (5.5 * WPS)); b.words.push({ w, t, d }); t += d; }
    b.end = t + 0.6; t = b.end + GAP;
  }
  return t;
}
function plan(brief) {
  // One long show for Duarte: each item has its own stretch of the show's time, starting at item.off.
  let off = 0.2; const cues = [{ t: 0.05, who: WHO, do: 'straightenTie' }], mouth = [], items = [];
  for (const q of brief.questions) {
    const beats = storyOf(q, brief), end = timeBeats(beats, off), it = { q, beats, off, dur: end - off };
    for (const b of beats) {
      b.words.forEach((x, k) => mouth.push({ start: +x.t.toFixed(3), end: +(x.t + x.d * 0.82).toFixed(3), value: ['C', 'E', 'B', 'D', 'F', 'C'][(k + x.w.length) % 6] }));
      cues.push({ t: b.start, who: WHO, do: 'speak', track: 'brief', offset: b.start, dur: b.end - b.start },   // offset: the mouth track is in absolute time
         { t: b.start + 0.3, who: WHO, do: b.kind === 'decision' ? 'count' : 'present', dur: 2 });
    }
    for (const b of beats) { b.start -= off; b.end -= off; for (const w of b.words) w.t -= off; }   // item-local times
    items.push(it); off = end + 1;
  }
  return { cues, mouth, items, duration: off + 1 };
}

// ---------- The clock and the voice ----------
let raf = 0, last = 0, utter = null, token = 0;
const item = () => state.items[state.i];
const beatAt = (it, t) => { let k = 0; it.beats.forEach((b, i) => { if (t >= b.start - 0.001) k = i; }); return k; };
function points(it) { const p = []; it.beats.forEach((b) => p.push(b.start, b.end)); return [...new Set(p.map((x) => +x.toFixed(3)))].sort((a, b) => a - b); }
function stopVoice() { token++; try { state.tts?.stop(); } catch {} try { speechSynthesis.cancel(); } catch {} state.spoken = null; }
function voiceAvailable() { return !!state.tts || ('speechSynthesis' in window && speechSynthesis.getVoices().length > 0); }
// Speak the current beat from the word at t to its end. The beat's words pull the clock as they are spoken.
function speakFrom(t) {
  stopVoice(); if (!voiceAvailable()) return;
  const it = item(), k = beatAt(it, t), b = it.beats[k], w0 = b.words.findIndex((w) => w.t + w.d > t); if (w0 < 0) return;
  const words = b.words.slice(w0), text = words.map((w) => w.w).join(' '), my = token;
  state.spoken = { k, ended: false };
  const ended = () => { if (my !== token) return; state.spoken = { k, ended: true }; };
  if (state.tts) { state.tts.speak(text, { voice: 'rounded' }).then(ended, ended); return; }
  utter = new SpeechSynthesisUtterance(text); utter.lang = 'en-GB';
  const v = speechSynthesis.getVoices().find((x) => /en-GB/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang)); if (v) utter.voice = v;
  utter.onboundary = (e) => { if (my !== token || (e.name && e.name !== 'word')) return; let n = 0, j = 0; for (; j < words.length; j++) { n += words[j].w.length + 1; if (n > e.charIndex) break; } const w = words[Math.min(j, words.length - 1)]; if (w.t > state.t || state.t - w.t > 0.4) state.t = w.t; };
  utter.onend = ended; utter.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') ended(); };
  speechSynthesis.speak(utter);
}
function play() {
  const it = item(); if (state.t >= it.dur - 0.05) state.t = 0;
  state.playing = true; last = performance.now(); speakFrom(state.t); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); ui();
}
function pause() { state.playing = false; stopVoice(); cancelAnimationFrame(raf); ui(); draw(); }
function seek(t, resume = state.playing) {
  const it = item(); state.t = Math.max(0, Math.min(it.dur, t)); stopVoice();
  if (resume) { state.playing = true; last = performance.now(); speakFrom(state.t); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); } else { state.playing = false; cancelAnimationFrame(raf); }
  ui(); draw();
}
function tick(now) {
  if (!state.playing) return;
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const it = item(), k = beatAt(it, state.t), b = it.beats[k], sp = state.spoken;
  if (sp && sp.k === k && !sp.ended) state.t = Math.min(state.t + dt, b.end - 0.05);   // a voice is speaking: never run ahead of it
  else if (sp && sp.k === k && sp.ended && state.t < b.end) state.t = b.end;            // the voice finished this beat
  else state.t += dt;
  const k2 = beatAt(it, state.t);
  if (k2 !== k && state.t < it.dur) speakFrom(state.t);                                   // a new beat: speak it
  if (state.t >= it.dur) { state.t = it.dur; state.playing = false; stopVoice(); }
  draw(); ui(); if (state.playing) raf = requestAnimationFrame(tick);
}

// ---------- Drawing ----------
function draw() {
  const it = item(); if (!it) return;
  const t = state.t, k = beatAt(it, t), b = it.beats[k], rest = !state.playing && t === 0, u = rest ? 1 : (t - b.start) / Math.max(0.5, b.end - b.start);   // at rest, the first scene shows complete
  $('vis').innerHTML = b.kind === 'scene' ? scene(b.visual, u) : scene(b.kind, u, it.q);
  // Subtitles: the beat's caption, words filling as the narration reaches them, in a moving window.
  const cw = b.caption.split(/\s+/), said = b.words.filter((w) => w.t <= t).length, n = Math.round(cw.length * (b.words.length ? said / b.words.length : 1));
  const from = Math.max(0, Math.min(n - 6, cw.length - 18)), win = cw.slice(from, from + 18);
  $('subs').innerHTML = win.map((w, i) => `<span class="${from + i < n ? 'said' : 'tobe'}">${esc(w)}</span>`).join(' ');
  $('src').textContent = b.sources?.length ? 'Source: ' + b.sources.join('; ') : '';
  if (state.show) state.show.renderAt(it.off + t);
  // The decision appears only once the story reaches it.
  if (b.kind === 'decision' && !state.reached[it.q.id]) { state.reached[it.q.id] = true; renderDecision(); }
}
function fmt(s) { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function ui() {
  const it = item(); if (!it) return;
  $('pp').textContent = state.playing ? 'Pause' : (state.t >= it.dur - 0.05 ? 'Replay' : 'Play'); $('pp').setAttribute('aria-pressed', String(state.playing));
  const sc = $('scrub'); sc.max = it.dur.toFixed(2); if (document.activeElement !== sc) sc.value = state.t.toFixed(2);
  $('time').textContent = `${fmt(state.t)} / ${fmt(it.dur)}`;
  $('marks').innerHTML = it.beats.map((b) => `<i style="left:${(100 * b.start / it.dur).toFixed(2)}%" class="${b.kind === 'decision' ? 'dec' : ''}"></i>`).join('');
}
function renderItem() {
  const B = state.brief, it = item(), q = it.q;
  $('count').textContent = `Decision ${state.i + 1} of ${B.questions.length}`;
  $('dots').innerHTML = B.questions.map((x, k) => `<button type="button" class="dot${k === state.i ? ' on' : ''}${state.answers[x.id]?.saved ? ' done' : ''}" data-k="${k}" aria-label="Decision ${k + 1}${state.answers[x.id]?.saved ? ', answered' : ''}"></button>`).join('');
  $('qhead').innerHTML = `<p class="eyebrow">${esc(q.from)} · asked ${esc(q.asked)} · ${it.beats.length - 1} part${it.beats.length > 2 ? 's' : ''}, then the decision</p><h2 id="qtitle">${esc(q.title)}</h2>`;
  renderDecision(); ui(); draw();
}
function renderDecision() {
  const it = item(), q = it.q, a = state.answers[q.id] || {}, open = state.reached[q.id] || a.saved;
  if (!open) { $('q').innerHTML = `<p class="note">The options and the answer box appear when the story reaches the decision.</p><div class="row"><button type="button" id="skip" class="ghost">Skip to the decision</button></div>`; $('skip').onclick = () => { const d = it.beats[it.beats.length - 1]; state.reached[q.id] = true; seek(d.start, false); renderDecision(); }; return; }
  $('q').innerHTML = `
    ${q.blocks?.length ? `<div class="blocks"><span>Waiting on this:</span>${q.blocks.map((b) => `<span class="chip">${esc(b)}</span>`).join('')}</div>` : ''}
    ${q.numbers?.length ? `<div class="nums">${q.numbers.map((n) => `<figure class="num"><b>${esc(n.value)}</b><figcaption>${esc(n.label)}<small>${esc(n.source)}</small></figcaption></figure>`).join('')}</div>` : ''}
    <fieldset class="opts"><legend>Your decision</legend>${q.options.map((o, k) => {
      const id = `opt-${q.id}-${k}`, rec = k === q.recommend.option;
      return `<label class="opt${rec ? ' rec' : ''}" for="${id}"><input type="radio" name="opt-${q.id}" id="${id}" value="${k}"${a.choice === k ? ' checked' : ''}>
        <span class="letter">${L(k)}</span><span class="otext">${rec ? '<span class="badge">recommended</span>' : ''}<b>${esc(o.label)}</b>${o.detail ? `<span>${esc(o.detail)}</span>` : ''}${o.cost ? `<em>${esc(o.cost)}</em>` : ''}</span></label>`; }).join('')}</fieldset>
    <div class="rec-box"><b>Recommendation: ${L(q.recommend.option)}.</b> ${esc(q.recommend.why)}</div>
    <p class="why"><b>Context.</b> ${esc(q.why)}</p>
    <label class="alabel" for="ans">Your answer, in your words (optional)</label>
    <textarea id="ans" rows="4" placeholder="Type, or tap the microphone on your keyboard to dictate">${esc(a.text || '')}</textarea>
    <div class="row"><button type="button" id="mic" class="ghost" hidden>Dictate</button><button type="button" id="save">Save answer</button><span id="saved" role="status">${a.saved ? 'Saved ' + esc(new Date(a.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })) : ''}</span></div>`;
  $('save').onclick = save;
  if (state.dict) { const m = $('mic'); m.hidden = false; m.onclick = dictate; }
}
function renderSummary() {
  pause(); const B = state.brief;
  $('count').textContent = 'Summary'; $('dots').innerHTML = ''; $('qhead').innerHTML = '<h2 id="qtitle">Your answers</h2>';
  $('q').innerHTML = `<ol class="sum">${B.questions.map((q) => { const a = state.answers[q.id]; return `<li><b>${esc(q.title)}</b><span>${a?.saved ? `${a.choice != null ? esc(L(a.choice) + ': ' + q.options[a.choice].label) : 'No option chosen'}${a.text ? ' · "' + esc(a.text) + '"' : ''}` : '<i>Not answered yet</i>'}</span></li>`; }).join('')}</ol>
    <p class="note">${state.db ? 'Answers are kept with this page, so the agents can read them back.' : 'Answers are kept in this browser only, because this view has no shared store.'}</p>`;
}

// ---------- Answers ----------
async function save() {
  const q = item().q, sel = document.querySelector(`input[name="opt-${q.id}"]:checked`);
  const rec = { choice: sel ? +sel.value : null, text: $('ans').value.trim(), at: new Date().toISOString(), question: q.id, saved: true };
  state.answers[q.id] = rec; $('saved').textContent = 'Saving…';
  try {
    if (state.db) await state.db.doc('answers/' + q.id).set({ ...rec, by: state.me || null });
    try { localStorage.setItem('brief-answers', JSON.stringify(state.answers)); } catch {}
    $('saved').textContent = 'Saved'; renderItem();
  } catch (e) { $('saved').textContent = 'Not saved: ' + (e && e.message ? e.message : 'the store refused it') + '. Your text is still here.'; }
}
async function dictate() {
  const m = $('mic'), ta = $('ans');
  if (m.dataset.on === '1') { await state.dict.stop().catch(() => {}); return; }
  try { const p = state.dict.start(); m.dataset.on = '1'; m.textContent = 'Stop dictating'; await p; } catch (e) { m.dataset.on = ''; m.textContent = 'Dictate'; if (e && e.code === 'not_granted') m.hidden = true; }
  state.dict.onFinal(({ text }) => { ta.value = (ta.value ? ta.value + ' ' : '') + text; });
  state.dict.onState(({ state: s }) => { if (s === 'idle') { m.dataset.on = ''; m.textContent = 'Dictate'; } });
}

// ---------- Start ----------
function go(i) { pause(); state.i = Math.max(0, Math.min(state.items.length - 1, i)); state.t = 0; renderItem(); }
async function main() {
  state.brief = await fetch('brief.json').then((r) => { if (!r.ok) throw new Error('brief.json did not load'); return r.json(); });   // default credentials: the claude.ai viewer needs them
  $('btitle').textContent = state.brief.title; $('bsub').textContent = state.brief.subtitle;
  try { state.answers = JSON.parse(localStorage.getItem('brief-answers') || '{}'); } catch { state.answers = {}; }
  const p = plan(state.brief); state.items = p.items;
  renderItem();
  try {
    const lib = new URL(document.querySelector('[data-presenters]')?.dataset.presenters || './presenters/presenters.js', location.href).href;
    const { mount } = await import(lib);
    const get = (n) => fetch(new URL('data/' + n + '.json', lib)).then((r) => { if (!r.ok) throw new Error(n + '.json did not load (' + r.status + ')'); return r.json(); });
    const [characters, moves, choreography, visemes] = await Promise.all(['characters', 'moves', 'choreography', 'visemes'].map(get));
    state.show = await mount($('stage'), { data: { characters, moves, choreography, visemes }, presenters: [WHO], duration: p.duration, cues: p.cues, tracks: { brief: { mouthCues: p.mouth } },
      camera: [{ t: 0, focus: WHO, dist: 2.7, h: 0.8, lh: 0.76, fov: 30 }], tags: false, background: '#0b1424' });
    // Duarte is drawn at 240 x 320 and scaled to his small window, so the library's fixed label stays on him, in proportion.
    const fit = () => { $('stage').style.transform = `scale(${($('monframe').clientWidth / 240).toFixed(4)})`; };
    fit(); new ResizeObserver(() => { fit(); draw(); }).observe($('monframe'));
    draw();
  } catch (e) { $('stage').innerHTML = '<p class="nostage">Duarte could not be drawn here (' + esc(e && e.message ? e.message : e) + ').</p>'; }
  if (window.claude?.use) {
    claude.use('tts').then((t) => { state.tts = t; }).catch(() => {});
    claude.use('dictation').then((d) => { if (d) { state.dict = d; const m = $('mic'); if (m) { m.hidden = false; m.onclick = dictate; } } }).catch(() => {});
    claude.use('user').then(async (u) => { if (u) state.me = await u.id().catch(() => null); }).catch(() => {});
    claude.use('db').then((db) => {
      if (!db) return; state.db = db;
      db.collection('answers').onSnapshot((snap) => { for (const d of snap.docs) state.answers[d.id] = { ...d.data(), saved: true }; if (document.activeElement !== $('ans')) renderDecision(); }, () => {});
    }).catch(() => {});
  }
}
$('pp').onclick = () => (state.playing ? pause() : play());
$('back').onclick = () => { const p = points(item()), t = state.t; const prev = [...p].reverse().find((x) => x < t - 0.08); seek(prev ?? 0); };
$('fwd').onclick = () => { const p = points(item()), t = state.t; const nx = p.find((x) => x > t + 0.08); seek(nx ?? item().dur, nx != null && state.playing); };
$('scrub').oninput = (e) => { stopVoice(); state.t = +e.target.value; draw(); $('time').textContent = `${fmt(state.t)} / ${fmt(item().dur)}`; };
$('scrub').onchange = (e) => seek(+e.target.value);
$('prevq').onclick = () => go(state.i - 1);
$('nextq').onclick = () => { if (state.i === state.items.length - 1) renderSummary(); else go(state.i + 1); };
$('dots').onclick = (e) => { const b = e.target.closest('.dot'); if (b) go(+b.dataset.k); };
document.addEventListener('keydown', (e) => { if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return; if (e.code === 'Space') { e.preventDefault(); $('pp').click(); } else if (e.code === 'ArrowLeft') $('back').click(); else if (e.code === 'ArrowRight') $('fwd').click(); });
main().catch((e) => { $('q').innerHTML = '<p class="note">The brief could not start: ' + esc(e.message) + '</p>'; });

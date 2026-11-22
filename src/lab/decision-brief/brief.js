/* brief.js: a decision brief that plays in the browser, with no video render (bulletins.d@PrompTugal.dinis, 22 Nov
 * 2026). Dinis, relayed by maestro.d and confirmed in bulletins.d@'s session: "a briefing from one character ... the
 * questions and then the answers for me to provide, and then a place for me to put the answers, or I voice over the
 * answers ... this would not need to be rendered ... see if here we can just play it as a web page ... on my device,
 * for example, the iPhone".
 * One synthetic presenter (the presenters library, drawn live by the viewer's own GPU) reads each question; the page
 * shows the question, why it matters, its numbers with sources, the options and the recommendation, and keeps the
 * answer. Narration: Claude's voice where the viewer offers it, else the browser's own speech (iPhone Safari), else
 * the text alone. Answers: the artifact's db when granted, else this browser's storage. */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WHO = 'anchor', WPS = 2.55, GAP = 0.6;           // words a second the mouth track assumes, and a pause between parts
const state = { i: 0, answers: {}, db: null, me: null, tts: null, show: null, segs: [], speaking: false, dict: null };

// ---------- The script each question is read from, and its mouth track ----------
function lines(q) { return [q.title + '.', q.why, 'The options: ' + q.options.map((o, k) => `${String.fromCharCode(65 + k)}, ${o.label}.`).join(' '), 'My recommendation: ' + q.recommend.say]; }
function plan(brief) {
  // One long show: each question gets a segment; each segment's words get estimated times for the mouth and the cues.
  let t = 0.4; const cues = [], mouth = [], segs = [];
  brief.questions.forEach((q, qi) => {
    const start = t, words = [];
    for (const ln of lines(q)) { for (const w of ln.split(/\s+/).filter(Boolean)) { const d = Math.max(0.22, (w.length + 1) / (5.5 * WPS)); words.push({ w, t, d }); t += d; } t += GAP; }
    const end = t; segs.push({ start, end, words, text: lines(q).join(' ') });
    for (const [k, x] of words.entries()) { const shapes = ['C', 'E', 'B', 'D', 'F', 'C']; mouth.push({ start: +x.t.toFixed(3), end: +(x.t + x.d * 0.82).toFixed(3), value: shapes[(k + x.w.length) % shapes.length] }); }
    cues.push({ t: start, who: WHO, do: 'speak', track: 'brief', dur: end - start });
    cues.push({ t: start + 0.2, who: WHO, do: 'expression', name: 'smile', dur: 1.6 });
    const optAt = segs[qi].words.find((x) => x.w === 'options:')?.t ?? start + 3, recAt = segs[qi].words.find((x) => x.w === 'recommendation:')?.t ?? end - 3;
    cues.push({ t: optAt, who: WHO, do: 'count', dur: 2.2 }, { t: recAt, who: WHO, do: 'present', dur: 2.4 }, { t: recAt + 0.4, who: WHO, do: 'nod' });
    if (qi === 0) cues.push({ t: 0.1, who: WHO, do: 'straightenTie' });
    t += 1.2;
  });
  return { cues, mouth, segs, duration: t + 2 };
}

// ---------- Narration ----------
let utter = null, syncTimer = 0;
function stopSpeech() {
  clearInterval(syncTimer); state.speaking = false; $('play').textContent = 'Play'; $('play').setAttribute('aria-pressed', 'false');
  try { state.tts?.stop(); } catch {} try { speechSynthesis.cancel(); } catch {}
  state.show?.pause();
}
async function playQuestion() {
  if (state.speaking) { stopSpeech(); return; }
  const seg = state.segs[state.i]; if (!seg) return;
  state.speaking = true; $('play').textContent = 'Stop'; $('play').setAttribute('aria-pressed', 'true');
  const show = state.show;
  if (show) { show.seek(seg.start); show.play(); }
  const done = () => { if (!state.speaking) return; stopSpeech(); if (show) show.seek(seg.end); };
  // The show runs on its own clock; stop it at the end of the segment even if the voice is slower or absent.
  syncTimer = setInterval(() => { if (show && show.t >= seg.end) show.pause(); }, 100);
  if (state.tts) {
    try { await state.tts.speak(seg.text, { voice: 'rounded' }); } catch { /* stopped or refused: the text stays on screen */ }
    done(); return;
  }
  const mime = () => { const left = Math.max(0.5, seg.end - (show ? show.t : seg.start)); if (show && !show.playing) show.play(); setTimeout(done, left * 1000); };
  if ('speechSynthesis' in window && speechSynthesis.getVoices().length) {
    utter = new SpeechSynthesisUtterance(seg.text); utter.lang = 'en-GB'; utter.rate = 1;
    const v = speechSynthesis.getVoices().find((x) => /en-GB/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang)); if (v) utter.voice = v;
    // Each spoken word moves the mouth track to that word, so the presenter keeps up with the real voice.
    utter.onboundary = (e) => { if (!show || e.name && e.name !== 'word') return; let n = 0, k = 0; for (; k < seg.words.length; k++) { n += seg.words[k].w.length + 1; if (n > e.charIndex) break; } const w = seg.words[Math.min(k, seg.words.length - 1)]; if (Math.abs(show.t - w.t) > 0.25) show.seek(w.t); if (!show.playing) show.play(); };
    utter.onend = done; utter.onerror = (e) => { if (e.error === 'interrupted' || e.error === 'canceled') return done(); mime(); };
    speechSynthesis.cancel(); speechSynthesis.speak(utter); return;
  }
  mime();   // no voice here: the presenter mimes, the text is on screen
}

// ---------- Rendering a question ----------
function render() {
  const B = state.brief, q = B.questions[state.i], a = state.answers[q.id] || {};
  $('count').textContent = `Question ${state.i + 1} of ${B.questions.length}`;
  $('dots').innerHTML = B.questions.map((x, k) => `<button type="button" class="dot${k === state.i ? ' on' : ''}${state.answers[x.id]?.saved ? ' done' : ''}" data-k="${k}" aria-label="Question ${k + 1}${state.answers[x.id]?.saved ? ', answered' : ''}"></button>`).join('');
  $('q').innerHTML = `
    <p class="eyebrow">${esc(q.from)} · asked ${esc(q.asked)}</p>
    <h2 id="qtitle">${esc(q.title)}</h2>
    <p class="why">${esc(q.why)}</p>
    ${q.blocks?.length ? `<div class="blocks"><span>Waiting on this:</span>${q.blocks.map((b) => `<span class="chip">${esc(b)}</span>`).join('')}</div>` : ''}
    ${q.numbers?.length ? `<div class="nums">${q.numbers.map((n) => `<figure class="num"><b>${esc(n.value)}</b><figcaption>${esc(n.label)}<small>${esc(n.source)}</small></figcaption></figure>`).join('')}</div>` : ''}
    <fieldset class="opts"><legend>Options</legend>${q.options.map((o, k) => {
      const id = `opt-${q.id}-${k}`, rec = k === q.recommend.option;
      return `<label class="opt${rec ? ' rec' : ''}" for="${id}"><input type="radio" name="opt-${q.id}" id="${id}" value="${k}"${a.choice === k ? ' checked' : ''}>
        <span class="letter">${String.fromCharCode(65 + k)}</span><span class="otext">${rec ? '<span class="badge">recommended</span>' : ''}<b>${esc(o.label)}</b>${o.detail ? `<span>${esc(o.detail)}</span>` : ''}${o.cost ? `<em>${esc(o.cost)}</em>` : ''}</span></label>`; }).join('')}</fieldset>
    <div class="rec-box"><b>Recommendation: ${esc(String.fromCharCode(65 + q.recommend.option))}.</b> ${esc(q.recommend.why)}</div>
    <label class="alabel" for="ans">Your answer, in your words (optional)</label>
    <textarea id="ans" rows="4" placeholder="Type, or tap the microphone on your keyboard to dictate">${esc(a.text || '')}</textarea>
    <div class="row"><button type="button" id="mic" class="ghost" hidden>Dictate</button><button type="button" id="save">Save answer</button><span id="saved" role="status">${a.saved ? 'Saved ' + esc(new Date(a.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })) : ''}</span></div>`;
  $('prev').disabled = state.i === 0; $('next').textContent = state.i === B.questions.length - 1 ? 'Summary' : 'Next';
  $('save').onclick = save;
  if (state.dict) { const m = $('mic'); m.hidden = false; m.onclick = dictate; }
  if (state.show && !state.speaking) state.show.seek(state.segs[state.i].start);
}
function renderSummary() {
  stopSpeech();
  const B = state.brief;
  $('count').textContent = 'Summary'; $('dots').innerHTML = '';
  $('q').innerHTML = `<h2>Your answers</h2><ol class="sum">${B.questions.map((q) => { const a = state.answers[q.id]; return `<li><b>${esc(q.title)}</b><span>${a?.saved ? `${a.choice != null ? esc(String.fromCharCode(65 + a.choice) + ': ' + q.options[a.choice].label) : 'No option chosen'}${a.text ? ' · "' + esc(a.text) + '"' : ''}` : '<i>Not answered yet</i>'}</span></li>`; }).join('')}</ol>
    <p class="note">${state.db ? 'Answers are kept with this page, so the agents can read them back.' : 'Answers are kept in this browser only, because this view has no shared store.'}</p>`;
  $('prev').disabled = false; $('next').textContent = 'Start again';
}

// ---------- Answers ----------
async function save() {
  const q = state.brief.questions[state.i], sel = document.querySelector(`input[name="opt-${q.id}"]:checked`);
  const rec = { choice: sel ? +sel.value : null, text: $('ans').value.trim(), at: new Date().toISOString(), question: q.id, saved: true };
  state.answers[q.id] = rec; $('saved').textContent = 'Saving…';
  try {
    if (state.db) await state.db.doc('answers/' + q.id).set({ ...rec, by: state.me || null });
    try { localStorage.setItem('brief-answers', JSON.stringify(state.answers)); } catch {}
    $('saved').textContent = 'Saved'; render();
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
async function main() {
  state.brief = await fetch('brief.json')   // default credentials: the claude.ai viewer needs them to serve the page's own files
    .then((r) => { if (!r.ok) throw new Error('brief.json did not load'); return r.json(); });
  $('btitle').textContent = state.brief.title; $('bsub').textContent = state.brief.subtitle;
  try { state.answers = JSON.parse(localStorage.getItem('brief-answers') || '{}'); } catch { state.answers = {}; }
  const p = plan(state.brief); state.segs = p.segs;
  render();
  // The presenter: drawn live by this device; if WebGL is missing the brief still works as text. The library's path
  // comes from the page (the site uses /lib/presenters/v0.1.1/; the claude.ai copy ships it beside the page).
  try {
    const lib = new URL(document.querySelector('[data-presenters]')?.dataset.presenters || './presenters/presenters.js', location.href).href;
    const { mount } = await import(lib);
    // The presenter data is fetched here with default credentials and handed to mount(), so the library's own
    // credential-free fetch is not used (the claude.ai viewer refuses it for the page's own files).
    const get = (n) => fetch(new URL('data/' + n + '.json', lib)).then((r) => { if (!r.ok) throw new Error(n + '.json did not load (' + r.status + ')'); return r.json(); });
    const [characters, moves, choreography, visemes] = await Promise.all(['characters', 'moves', 'choreography', 'visemes'].map(get));
    state.show = await mount($('stage'), { data: { characters, moves, choreography, visemes }, presenters: [WHO], duration: p.duration, cues: p.cues, tracks: { brief: { mouthCues: p.mouth } },
      camera: [{ t: 0, focus: WHO, dist: 3.6, h: 0.74, lh: 0.7, fov: 30 }], tags: false, background: '#0b1424' });
    state.show.seek(state.segs[state.i].start);
    new ResizeObserver(() => { state.show.resize(); state.show.renderAt(state.show.t); }).observe($('stage'));
  } catch (e) { $('stage').innerHTML = '<p class="nostage">The presenter could not be drawn on this device (' + esc(e && e.message ? e.message : e) + '). The brief works without it.</p>'; }
  // Capabilities light up when the viewer offers them; the page works without each.
  if (window.claude?.use) {
    claude.use('tts').then((t) => { state.tts = t; }).catch(() => {});
    claude.use('dictation').then((d) => { if (d) { state.dict = d; const m = $('mic'); if (m) { m.hidden = false; m.onclick = dictate; } } }).catch(() => {});
    claude.use('user').then(async (u) => { if (u) state.me = await u.id().catch(() => null); }).catch(() => {});
    claude.use('db').then((db) => {
      if (!db) return; state.db = db;
      db.collection('answers').onSnapshot((snap) => { for (const d of snap.docs) { const v = d.data(); state.answers[d.id] = { ...v, saved: true }; } if ($('ans') && document.activeElement !== $('ans')) render(); }, () => {});
    }).catch(() => {});
  }
}
$('play').onclick = playQuestion;
$('prev').onclick = () => { stopSpeech(); if ($('count').textContent === 'Summary') state.i = state.brief.questions.length - 1; else state.i = Math.max(0, state.i - 1); render(); };
$('next').onclick = () => { stopSpeech(); if ($('next').textContent === 'Start again') { state.i = 0; render(); return; } if (state.i === state.brief.questions.length - 1) { renderSummary(); return; } state.i++; render(); };
$('dots').onclick = (e) => { const b = e.target.closest('.dot'); if (!b) return; stopSpeech(); state.i = +b.dataset.k; render(); };
main().catch((e) => { $('q').innerHTML = '<p class="note">The brief could not start: ' + esc(e.message) + '</p>'; });

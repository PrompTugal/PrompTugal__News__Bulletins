/* stage.js: the subtitles video's page (bulletins.d@PrompTugal.dinis, 22 Nov 2026). One synthetic presenter from the
 * presenters library, directed by timeline.json, and the captions of captions.js over it. renderFrame(t) draws both;
 * every frame is a function of t. */
const $ = (id) => document.getElementById(id);
async function main() {
  const tl = (new URLSearchParams(location.search).get('tl') || 'timeline.json').replace(/[^a-z0-9.-]/gi, '');
  const T = await fetch(tl).then((r) => { if (!r.ok) throw new Error('timeline.json did not load'); return r.json(); });
  const { mount } = await import(document.querySelector('[data-presenters]').dataset.presenters);
  const show = await mount($('stage'), { presenters: [T.who], duration: T.duration, cues: T.cues, camera: T.camera, tracks: { voice: { mouthCues: T.mouthCues } }, tags: false, background: '#0b1424' });
  $('foot').textContent = T.label;
  const segAt = (t) => { let s = T.segments[0]; for (const x of T.segments) if (t >= x.start) s = x; return s; };
  window.renderFrame = (t) => {
    t = Math.max(0, Math.min(T.duration, t));
    const a = performance.now(); show.renderAt(t); const b = performance.now();
    const s = segAt(t), W = T.words.filter((w) => w.seg === s.id);
    let html = Captions.render(s.style, W, t, s.opt || {});
    if (s.card && t < s.start + s.card) html = `<div class="title" style="opacity:${Math.min(1, (s.start + s.card - t) / 0.3).toFixed(3)}"><h1>${s.cardTitle}</h1><p>${s.cardSub}</p></div>` + html;
    $('cap').innerHTML = html; $('chip').textContent = s.chip || '';
    return { left: +(performance.now() - b).toFixed(1), right: +(b - a).toFixed(1) };
  };
  window.renderFrame(0); window.stageReady = true;
}
main().catch((e) => { document.getElementById('cap').textContent = 'The stage could not start: ' + e.message; });

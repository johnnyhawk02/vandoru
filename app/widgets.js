// The screen's controls, with no knowledge of sounds: knobs, bars, the padlock, the dice and the drag that turns
// them. Only a press and drag changes a control: the scroll wheel, the trackpad and the arrow keys never do, and
// passing the pointer over one is safe.

export const $ = (id) => document.getElementById(id);
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// every drag in progress, so a lost window or a hidden tab can end them all
const drags = new Set();
const endAll = () => { for (const end of [...drags]) end(); };
addEventListener('blur', endAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) endAll(); });

/** a drag on track changes a value from where it was (axis 'x' or 'y'). o: { min, max, get, put, len?, held? }.
 *  It ends on the button's release, on any move with the button up, on lost capture, on blur and on a hidden tab */
export function dragger(track, axis, o) {
  let d = null;
  const end = () => { if (!d) return; d = null; drags.delete(end); o.held && o.held(false); };
  track.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    try { track.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is gone already */ }
    e.preventDefault();
    const r = track.getBoundingClientRect(), len = o.len || (axis === 'x' ? r.width : r.height);
    // a press off a bar's end jumps there (not on a knob: it turns from where it is)
    if (!o.len) {
      const at = axis === 'x' ? (e.clientX - r.left) / r.width : (r.bottom - e.clientY) / r.height;
      const f = (o.get() - o.min) / (o.max - o.min);
      if (Math.abs(at - f) * len > 8) o.put(o.min + clamp(at, 0, 1) * (o.max - o.min));
    }
    d = { last: axis === 'x' ? e.clientX : e.clientY, acc: o.get(), len };
    drags.add(end);
    o.held && o.held(true);
  });
  track.addEventListener('pointermove', (e) => {
    if (!d) return;
    if (!e.buttons) { end(); return; } // (the release was missed)
    const p = axis === 'x' ? e.clientX : e.clientY, dp = axis === 'x' ? p - d.last : d.last - p;
    d.last = p; d.acc = clamp(d.acc + dp / d.len * (o.max - o.min) * (e.shiftKey ? 0.25 : 1), o.min, o.max);
    o.put(d.acc);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) track.addEventListener(ev, end);
}

/** a horizontal bar with a label and its value */
export function hbar(box, label, o) {
  const el = document.createElement('div'); el.className = 'hb';
  el.innerHTML = '<span class="lab"></span><div class="htrack" role="slider"><i></i></div><output></output>';
  el.querySelector('.lab').textContent = label;
  const tr = el.querySelector('.htrack'), out = el.querySelector('output');
  tr.setAttribute('aria-label', label); tr.setAttribute('aria-valuemin', o.min); tr.setAttribute('aria-valuemax', o.max);
  const draw = () => { const v = o.get(); tr.style.setProperty('--f', (v - o.min) / (o.max - o.min)); out.textContent = o.show(v); tr.setAttribute('aria-valuenow', v); };
  const put = (v) => { v = clamp(Math.round(v), o.min, o.max); if (v !== o.get()) { o.set(v); draw(); } };
  dragger(tr, 'x', { ...o, put });
  const reset = () => put(typeof o.dflt === 'function' ? o.dflt() : o.dflt);
  el.querySelector('.lab').addEventListener('dblclick', reset); tr.addEventListener('dblclick', reset);
  box.append(el);
  return draw;
}

// a knob in the LCD look: a ring of segments lit up to the value, a pointer, and a notch outside the ring for the
// value it had before a hand edit
export const KNOB_N = 25;
const KNOB_A0 = Math.PI * 0.75, KNOB_SWEEP = Math.PI * 1.5;
export const KNOB_SVG = (() => {
  let t = '';
  for (let i = 0; i < KNOB_N; i++) {
    const a = KNOB_A0 + i / (KNOB_N - 1) * KNOB_SWEEP, c = Math.cos(a), s = Math.sin(a);
    t += `<line class="tk" x1="${(32 + 20 * c).toFixed(2)}" y1="${(32 + 20 * s).toFixed(2)}" x2="${(32 + 28 * c).toFixed(2)}" y2="${(32 + 28 * s).toFixed(2)}"/>`;
  }
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${t}<line class="ptr" x1="32" y1="32" x2="46" y2="32"/><line class="notch" x1="61" y1="32" x2="64" y2="32"/></svg>`;
})();
// a plus-minus knob (a centre given: pan, fine, curve) has its centre at the top and lights from the top out to the
// value; any other knob lights from the bottom left
export const knobF = (v, max, c) => (c === undefined ? (max ? v / max : 0) : v <= c ? 0.5 * v / (c || 1) : 0.5 + 0.5 * (v - c) / ((max - c) || 1));
export const knobDeg = (v, max, c) => (KNOB_A0 + knobF(v, max, c) * KNOB_SWEEP) * 180 / Math.PI;
export function lightRing(ticks, v, max, c) {
  const lit = Math.round(knobF(v, max, c) * (KNOB_N - 1)), mid = (KNOB_N - 1) / 2;
  if (c === undefined) ticks.forEach((t, i) => t.classList.toggle('on', i <= lit && (v > 0 || i === 0)));
  else { const a = Math.min(lit, mid), b = Math.max(lit, mid); ticks.forEach((t, i) => t.classList.toggle('on', i >= a && i <= b)); }
}
/** a padlock (faint: open; solid: locked) */
export const LOCK_SVG = '<svg viewBox="0 0 16 18" aria-hidden="true"><path d="M4 8V5a4 4 0 0 1 8 0v3"/><rect x="1.5" y="8" width="13" height="9" rx="1"/></svg>';
/** a pan knob's L and R at the two ends of its ring */
export const LR_SVG = '<text class="lr" x="3" y="66">L</text><text class="lr" x="61" y="66">R</text>';

/** a knob in a cell: o = { label, max, centre?, get, put(v), show(v), dflt?, lr? }. Returns { el, draw, ... } */
export function knob(o) {
  const el = document.createElement('div'); el.className = 'vf';
  el.innerHTML = `<output></output><div class="knob" role="slider">${KNOB_SVG}</div><span class="lab"></span>`;
  el.querySelector('.lab').textContent = o.label;
  const tr = el.querySelector('.knob'), out = el.querySelector('output');
  const ticks = tr.querySelectorAll('.tk'), ptr = tr.querySelector('.ptr'), notch = tr.querySelector('.notch');
  tr.setAttribute('aria-label', o.label); tr.setAttribute('aria-valuemin', 0); tr.setAttribute('aria-valuemax', o.max);
  if (o.lr) tr.querySelector('svg').insertAdjacentHTML('beforeend', LR_SVG);
  const draw = () => {
    const v = o.get(), was = o.was ? o.was() : undefined;
    lightRing(ticks, v, o.max, o.centre);
    ptr.setAttribute('transform', `rotate(${knobDeg(v, o.max, o.centre)} 32 32)`);
    const text = o.show ? o.show(v) : String(Math.round(v));
    out.textContent = text; tr.setAttribute('aria-valuenow', v); tr.setAttribute('aria-valuetext', text);
    tr.classList.toggle('morphed', was !== undefined && was !== v);
    if (was !== undefined) notch.setAttribute('transform', `rotate(${knobDeg(was, o.max, o.centre)} 32 32)`);
  };
  dragger(tr, 'y', { min: 0, get max() { return o.max; }, len: 160, get: o.get, put: o.put, held: (h) => el.classList.toggle('held', h) });
  const reset = () => o.reset && o.reset();
  el.querySelector('.lab').addEventListener('dblclick', reset); tr.addEventListener('dblclick', reset);
  return { el, draw, tr };
}

/** a switch in a knob's cell: a button that steps through its settings, named on the button, lit away from the first */
export function switchCell(label, names, title, get, set) {
  const el = document.createElement('div'); el.className = 'vf vsw';
  el.innerHTML = '<output></output><button class="swb" type="button"></button><span class="lab"></span>';
  el.querySelector('.lab').textContent = label;
  const b = el.querySelector('.swb'); b.title = title;
  const draw = () => { const v = Number(get()) | 0; b.textContent = names[v] ?? names[0]; b.setAttribute('aria-pressed', v > 0); };
  b.addEventListener('click', (e) => { set(((Number(get()) | 0) + (e.shiftKey ? names.length - 1 : 1)) % names.length); draw(); });
  return { el, draw, b };
}

// the dice (NEW SOUND): seven pips, the lit ones its face. It turns once while its face changes a few times, a third
// of a second
const DICE_PIPS = { tl: [5, 5], tr: [19, 5], ml: [5, 12], mr: [19, 12], bl: [5, 19], br: [19, 19], c: [12, 12] };
const DICE_FACES = [[], ['c'], ['tl', 'br'], ['tl', 'c', 'br'], ['tl', 'tr', 'bl', 'br'], ['tl', 'tr', 'c', 'bl', 'br'], ['tl', 'tr', 'ml', 'mr', 'bl', 'br']];
export const DICE_SVG = `<svg viewBox="0 0 28 28" aria-hidden="true">${Object.entries(DICE_PIPS).map(([k, [x, y]]) => `<rect class="pip" data-p="${k}" x="${x}" y="${y}" width="4" height="4"/>`).join('')}</svg>`;
export function makeDice(els) {
  let face = 0, t = 0;
  const show = (n) => { face = n; for (const d of els) { d.dataset.face = n; for (const r of d.querySelectorAll('.pip')) r.classList.toggle('on', DICE_FACES[n].includes(r.dataset.p)); } };
  for (const d of els) d.addEventListener('animationend', () => d.classList.remove('roll'));
  show(5);
  return function roll() {
    clearInterval(t);
    const next = () => { let n; do n = 1 + Math.floor(Math.random() * 6); while (n === face); show(n); };
    next();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const d of els) { d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll'); }
    let left = 3; t = setInterval(() => { next(); if (!--left) clearInterval(t); }, 80);
  };
}

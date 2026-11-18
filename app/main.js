// VANDORU: the page. 25 keys on MIDI channel 1, split between 1 to 6 mono engines; every key has its own sound, and
// the knobs edit the key played last. The sound engine is in engine/ and sound/ (no UI there); this file holds the
// state, the keys, MIDI, the knob grid, the randomisers, undo, presets, the FX + MASTER tab and the phone view.
import { $, clamp, dragger, hbar, knob, switchCell, LOCK_SVG, DICE_SVG, makeDice } from './widgets.js?v=mwmeexdh';
import { setupColours } from './colours.js?v=mwmeexdh';
import { presetName, jumble } from './names.js?v=mwmeexdh';
import { PARAMS, PARAM, OUT_PARAMS, GRID_ROWS, GRID_COLS, cells, TARGETS, targetLabel, showValue, noteName, dialAt } from '../sound/params.js?v=mwmeexdh';
import { MAX_ENGINES, RETURNS, fxDefaults } from '../sound/instrument.js?v=mwmeexdh';
import { DIRT_DEFAULTS, dirtHz, scHz, decayMs, volDb, pregainDb, bassDb } from '../sound/dirt.js?v=mwmeexdh';
import { setupKits } from './kits.js?v=mwmeexdh';
import { KEYS, DEFAULT_ENGINES, DEFAULT_LOW, TYPES, zones, engineOf, tidySound, newKey, tidyKey, tidyPatch, tidyFx, cleanName, canon, copySound } from './patch.js?v=mwmeexdh';

const STORE = 'vandoru-v1', PRESET_STORE = 'vandoru-presets-v1';
const engName = (e) => `ENGINE ${e + 1}`;
const say = (html) => { $('detail').innerHTML = html; };

// ---------------------------------------------------------------------------------------------------------------
// the library: the starter set (hand-made, SPEC 8.6) and, from step 2, the imported kits' sounds
// ---------------------------------------------------------------------------------------------------------------
const STARTER = (await (await fetch(new URL('../sounds/starter.json?v=mwmeexdh', import.meta.url))).json()).map(tidySound);
const starterOf = (type) => STARTER.find((s) => s.type === type) || STARTER[0];
let kits = { library: () => [], close() {} }; // the imported kits (the KITS menu, set up below)
const library = () => [...STARTER, ...kits.library()];
// CLEAR: the engine's base sound, round the starter set
const BASE_TYPES = ['kick', 'snare', 'closed hat', 'tom', 'clap', 'open hat'];
const baseSound = (e) => starterOf(BASE_TYPES[e % BASE_TYPES.length]);

let rngState = (Date.now() ^ 0x9e3779b9) >>> 0 || 1;
const rnd = () => { rngState ^= rngState << 13; rngState >>>= 0; rngState ^= rngState >>> 17; rngState ^= rngState << 5; rngState >>>= 0; return rngState / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

// ---------------------------------------------------------------------------------------------------------------
// state, kept in this browser
// ---------------------------------------------------------------------------------------------------------------
const S = {
  keys: [], engines: DEFAULT_ENGINES, low: DEFAULT_LOW, sel: 0, editKey: [], view: 'synth',
  locks: Array.from({ length: MAX_ENGINES }, () => []), // each engine's closed knob padlocks (parameter ids)
  rand: { alter: 10, wild: false, source: 'kit' },
  fx: fxDefaults(), bpm: 120, ret: 2,
  settings: { freshNoise: true, softRetrig: false },
  ccMap: null, preset: { id: null, name: '' },
};
const Z = () => zones(S.engines);
const engineOfKey = (place) => engineOf(place, S.engines);
const noteOf = (place) => S.low + place;
const keyName = (place) => `${engName(engineOfKey(place))} ${noteName(noteOf(place))}`;
const resetEditKeys = () => { S.editKey = Z().map((z) => z.lo); };
function freshKeys() { return Array.from({ length: KEYS }, () => newKey(pick(library()))); }
try {
  const d = JSON.parse(localStorage.getItem(STORE));
  if (d && d.v === 1) {
    S.engines = clamp(d.engines | 0 || DEFAULT_ENGINES, 1, MAX_ENGINES);
    const p = tidyPatch({ keys: d.keys, engines: S.engines, fx: d.fx, bpm: d.bpm }, () => newKey(pick(library())));
    if (p) { S.keys = p.keys; S.fx = p.fx; S.bpm = p.bpm; }
    S.low = clamp(d.low | 0, 0, 127 - 24) || DEFAULT_LOW; S.ret = clamp(d.ret ?? 2, 0, RETURNS.length - 1);
    if (Array.isArray(d.locks)) S.locks = S.locks.map((_, e) => (Array.isArray(d.locks[e]) ? d.locks[e].filter((id) => PARAM[id] || ['send', 'pan', 'level'].includes(id)) : []));
    Object.assign(S.rand, d.rand); Object.assign(S.settings, d.settings);
    S.sel = clamp(d.sel | 0, 0, S.engines - 1); S.view = d.view === 'fx' ? 'fx' : 'synth';
    S.ccMap = d.ccMap && typeof d.ccMap === 'object' ? d.ccMap : null;
    if (d.preset) S.preset = { id: typeof d.preset.id === 'string' ? d.preset.id : null, name: cleanName(d.preset.name) };
    resetEditKeys();
    if (Array.isArray(d.editKey)) Z().forEach((z, e) => { const k = d.editKey[e]; if (k >= z.lo && k <= z.hi) S.editKey[e] = k; });
  }
} catch (e) { /* first visit, or storage blocked */ }
if (S.keys.length !== KEYS) S.keys = freshKeys();
if (S.editKey.length !== S.engines) resetEditKeys();
let saveT = 0;
const save = () => {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ v: 1, keys: S.keys, engines: S.engines, low: S.low, sel: S.sel, editKey: S.editKey, view: S.view,
        locks: S.locks, rand: S.rand, fx: S.fx, bpm: S.bpm, ret: S.ret, settings: S.settings, ccMap: S.ccMap, preset: S.preset }));
    } catch (e) { /* storage blocked: it just isn't kept */ }
    drawPreset();
  }, 300);
};
const place = () => S.editKey[S.sel];
const curKey = () => S.keys[place()];
const keyLocked = (p) => !!S.keys[p].lock;
const lockedMsg = () => say(`${keyName(place())} is locked: <em>LOCK KEY</em> (L) unlocks it`);

// ---------------------------------------------------------------------------------------------------------------
// audio
// ---------------------------------------------------------------------------------------------------------------
let ctx = null, node = null;
const send = (m) => { if (node) node.port.postMessage(m); };
async function startAudio() {
  if (ctx) { if (ctx.state !== 'running') await ctx.resume(); return; }
  ctx = new AudioContext({ latencyHint: 'interactive' });
  await ctx.audioWorklet.addModule(new URL('../sound/worklet.js?v=mwmeexdh', import.meta.url));
  node = new AudioWorkletNode(ctx, 'vandoru', { numberOfInputs: 0, outputChannelCount: [2] });
  node.port.onmessage = (e) => { if (e.data.type === 'peaks') { showPeaks(e.data.peaks); showSc(e.data.sc || 0); } };
  node.connect(ctx.destination);
  send({ type: 'engines', n: S.engines }); send({ type: 'settings', settings: S.settings }); sendTempo(); sendFx();
  if (ctx.state !== 'running') await ctx.resume();
}
const sendTempo = () => send({ type: 'tempo', bpm: S.bpm, ret: S.ret });
const sendFx = () => { send({ type: 'fx', fx: S.fx }); save(); };
const engKey = []; // the key each engine played last: an edit to it is heard on what's still ringing
const soundMsg = (p) => ({ sound: S.keys[p].sound.params, out: S.keys[p].out });
function play(p, vel, { back = false } = {}) {
  const e = engineOfKey(p);
  if (ctx && ctx.state !== 'running') ctx.resume();
  send({ type: 'play', engine: e, vel, back, ...soundMsg(p) });
  engKey[e] = p; S.editKey[e] = p;
  showLast(p, vel);
  if (e !== S.sel) select(e); else drawAll();
}
const sendKey = (p) => { const e = engineOfKey(p); if (engKey[e] === p) send({ type: 'update', engine: e, ...soundMsg(p) }); };

// ---------------------------------------------------------------------------------------------------------------
// UNDO: every change to the sounds, the last 40, newest first. A whole knob drag is one step (the same control again
// within 1.2 s), and so is anything that changes many keys at once. A preset load and INIT PATCH keep everything
// (the effects, the BPM, the patch's name); otherwise the effects aren't in the stack
// ---------------------------------------------------------------------------------------------------------------
const undoStack = [];
function snapshot(what, merge, whole) {
  const now = performance.now(), top = undoStack[undoStack.length - 1];
  if (top && (now - top.t0 < 60 || (merge && top.merge === merge && now - top.t < 1200))) { top.t = now; return; }
  undoStack.push({ what, merge, t: now, t0: now, engines: S.engines, keys: structuredClone(S.keys),
    ...(whole ? { fx: structuredClone(S.fx), bpm: S.bpm, preset: { ...S.preset } } : {}) });
  if (undoStack.length > 40) undoStack.shift();
  drawUndo();
}
function drawUndo() {
  const b = $('undo'), top = undoStack[undoStack.length - 1];
  b.disabled = !top; b.title = top ? `Take back: ${top.what} (Z, or Cmd+Z / Ctrl+Z); ${undoStack.length} step${undoStack.length === 1 ? '' : 's'} kept` : 'Nothing to take back yet';
}
function undo() {
  const u = undoStack.pop();
  if (!u) { say('nothing to undo'); return; }
  if (!u.fx) u.keys.forEach((k, i) => { if (S.keys[i].lock) u.keys[i] = S.keys[i]; }); // a key locked since stays as it is
  S.keys = u.keys;
  if (u.engines !== S.engines) showEngines(u.engines);
  if (u.fx) { S.fx = u.fx; S.bpm = u.bpm; S.preset = u.preset; sendFx(); sendTempo(); drawBpm(); buildFx(); }
  save(); drawUndo(); drawAll(); sendKey(place());
  say(`undone: <em>${u.what}</em>${undoStack.length ? ` · ${undoStack.length} more` : ''}`);
}
$('undo').addEventListener('click', undo);
// a change made by a button: one undo step, the screen redrawn, the message line says what happened
async function change(fn, what, whole) {
  snapshot(what.replace(/<[^>]+>/g, '').replace(/\s*(\(| · )UNDO takes it back\)?/, ''), undefined, whole);
  fn();
  save(); drawAll();
  say(what);
}

// ---------------------------------------------------------------------------------------------------------------
// editing a key by hand: the knob changes the key played last. The value it had is kept (edits), so its label
// lights, a notch outside its ring shows where it was, and a double-click puts it back
// ---------------------------------------------------------------------------------------------------------------
const valueNow = (id) => curKey().sound.params[id];
const isOut = (id) => id === 'send' || id === 'pan' || id === 'level';
function editValue(id, v) {
  const p = place(), k = S.keys[p];
  if (k.lock) { lockedMsg(); drawFaders(); return false; }
  const was = isOut(id) ? k.out[id] : k.sound.params[id];
  if (was === v) return false;
  snapshot(`${keyName(p)} ${(PARAM[id] || OUT_PARAMS.find((o) => o.id === id)).label}`, `key/${p}/${id}`);
  if (isOut(id)) k.out[id] = v;
  else {
    if (!(id in k.edits)) k.edits[id] = was;
    if (k.edits[id] === v) delete k.edits[id];
    k.sound.params[id] = v; k.home = null; // (ALTER's home: the sound as it is after a hand edit)
  }
  sendKey(p); save(); drawStrip(); drawHead();
  return true;
}
const editCount = (k) => Object.keys(k.edits).length;

// ---------------------------------------------------------------------------------------------------------------
// MIDI: channel 1, the 25 keys from LOW KEY up. Each engine is mono with last-note priority: the keys held in its zone,
// oldest first. A new key takes over; letting go of the newest while an earlier one is held brings that one back on
// the next step of the RETURN grid. Zones don't affect each other
// ---------------------------------------------------------------------------------------------------------------
const held = Array.from({ length: MAX_ENGINES }, () => []);
function keyDown(p, vel) {
  const st = held[engineOfKey(p)], i = st.findIndex((k) => k.p === p);
  if (i >= 0) st.splice(i, 1);
  st.push({ p, vel });
  play(p, vel);
}
function keyUp(p) {
  const e = engineOfKey(p), st = held[e], i = st.findIndex((k) => k.p === p);
  if (i < 0) return;
  st.splice(i, 1);
  if (i < st.length) return; // not the newest key: the zone stays on the newest
  if (!st.length) { send({ type: 'release', engine: e }); return; }
  const prev = st[st.length - 1];
  play(prev.p, prev.vel, { back: true });
}
function allOff() { held.forEach((st) => { st.length = 0; }); send({ type: 'alloff' }); }
function noteOn(ch, note, vel) {
  if (ch !== 1) { showLastText(`CH ${ch} · ${noteName(note)} · only channel 1 plays`); return; }
  const p = note - S.low;
  if (p < 0 || p >= KEYS) { showLastText(`${noteName(note)} #${note} · outside the keys (${noteName(S.low)}-${noteName(S.low + KEYS - 1)})`); return; }
  keyDown(p, vel);
}
const noteOff = (note) => { const p = note - S.low; if (p >= 0 && p < KEYS) keyUp(p); };
function midiStatus(text, live) { const el = $('midi-status'); el.textContent = text; el.classList.toggle('live', !!live); el.title = text; }
function onMidi(e) {
  const [st, a, b] = e.data, ch = (st & 0x0f) + 1, kind = st & 0xf0;
  if (kind === 0xb0) { if (ch === 1) onCC(a, b); return; }
  if (kind === 0x80 || (kind === 0x90 && !b)) { if (ch === 1) noteOff(a); return; }
  if (kind === 0x90) noteOn(ch, a, b);
}
async function startMidi() {
  if (!navigator.requestMIDIAccess) { midiStatus('MIDI: not in this browser (use Chrome or Edge)'); return; }
  try {
    const midi = await navigator.requestMIDIAccess();
    const hook = () => {
      const ins = [...midi.inputs.values()];
      for (const i of ins) i.onmidimessage = onMidi;
      midiStatus(ins.length ? 'MIDI: ' + ins.map((i) => i.name).join(', ') : 'MIDI: no input connected', ins.length);
    };
    midi.onstatechange = hook; hook();
  } catch (err) { midiStatus('MIDI: permission refused'); }
}

// ---------------------------------------------------------------------------------------------------------------
// hardware knobs: CCs on channel 1, acting on the key played last. The default map is the Bass Station 2's (Novation's
// published CC numbers); LEARN maps any knob to any control on screen
// ---------------------------------------------------------------------------------------------------------------
const CC_DEFAULT = {
  16: { t: 'par', id: 'cutoff' }, 82: { t: 'par', id: 'reso' }, 114: { t: 'par', id: 'drive' }, 90: { t: 'par', id: 'attack' },
  91: { t: 'par', id: 'decay' }, 85: { t: 'par', id: 'pAmount' }, 103: { t: 'par', id: 'pDecay' }, 94: { t: 'par', id: 'aAmount' },
  27: { t: 'par', id: 'tune' }, 26: { t: 'par', id: 'fine' }, 18: { t: 'par', id: 'lfoRate' }, 5: { t: 'par', id: 'send' },
  20: { t: 'eng', e: 0 }, 21: { t: 'eng', e: 1 }, 22: { t: 'eng', e: 2 },
};
const ccMap = () => S.ccMap || CC_DEFAULT;
const ctrl = (id) => PARAM[id] || OUT_PARAMS.find((o) => o.id === id);
const ccTargetName = (t) => (t.t === 'par' ? (ctrl(t.id)?.label || '?') : t.t === 'eng' ? `${engName(t.e)} level` : t.t === 'randkey' ? 'new sound on the key' : '?');
let learn = null; // null, { armed: true } waiting for a control, then { target } waiting for a knob
const ccHeld = {};
let ccDraw = 0;
function onCC(cc, val) {
  if (cc === 120 || cc === 123) { allOff(); return; }
  if (learn && learn.target) {
    S.ccMap = { ...ccMap() };
    for (const k in S.ccMap) if (canon(S.ccMap[k]) === canon(learn.target)) delete S.ccMap[k]; // one knob per control
    S.ccMap[cc] = learn.target; save();
    showLastText(`CC${cc} → ${ccTargetName(learn.target)}`);
    setLearn(null); return;
  }
  const t = ccMap()[cc];
  if (!t) { showLastText(`CC${cc} ${val} · not mapped (LEARN maps it)`); return; }
  let text;
  if (t.t === 'randkey') { const up = val >= 64, was = ccHeld[cc]; ccHeld[cc] = up; if (up && !was) randKey(); return; }
  if (t.t === 'eng') {
    S.fx.out.eng[t.e] = Math.round(val / 127 * 127); sendFx(); text = `${ccTargetName(t)} ${val}`;
  } else {
    const c = ctrl(t.id); if (!c) return;
    let v = c.ui === 'switch' ? val >= 64 : c.ui === 'target' ? (val ? TARGETS[Math.min(TARGETS.length - 1, Math.floor(val / 128 * TARGETS.length))] : null) : catchStop(c, val / 127 * c.max);
    if (typeof v === 'number' && (c.step || c.ui === 'steps' || c.ui === 'menu')) v = Math.round(v);
    editValue(t.id, v);
    text = `${keyName(place())} ${c.label} ${isOut(t.id) ? (c.show ? c.show(v) : Math.round(v)) : showValue(c, v, curKey().sound.params)}`;
  }
  showLastText(`CC${cc} · ${text}`);
  if (!ccDraw) ccDraw = requestAnimationFrame(() => { ccDraw = 0; drawFaders(); });
}
function setLearn(l) {
  learn = l;
  $('learn').setAttribute('aria-pressed', !!l);
  document.body.classList.toggle('learning', !!l);
  if (l && !l.target) say('LEARN: click a control on screen, then turn a knob (Esc cancels)');
  else if (l) say(`LEARN: now turn a knob for <em>${ccTargetName(l.target)}</em>`);
}
$('learn').addEventListener('click', () => { setLearn(learn ? null : { armed: true }); if (learn) openSettings(false); });
$('cc-reset').addEventListener('click', () => { S.ccMap = null; save(); setLearn(null); say('knobs: back to the Bass Station 2 map'); });
document.addEventListener('pointerdown', (e) => {
  if (!learn) return;
  const el = e.target.closest('[data-learn]');
  if (el) setLearn({ target: JSON.parse(el.dataset.learn) });
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && learn) setLearn(null); });

// ---------------------------------------------------------------------------------------------------------------
// the top bar's boxes: the last note, the engines' level lights, the sidechain meter
// ---------------------------------------------------------------------------------------------------------------
let lastT = 0;
function showLastText(t) {
  $('last-text').textContent = t;
  const box = $('last'); box.classList.add('hit'); clearTimeout(lastT); lastT = setTimeout(() => box.classList.remove('hit'), 90);
}
const showLast = (p, vel) => showLastText(`${keyName(p)} #${noteOf(p)} · V${vel}`);
const flash = (led, ms) => { led.classList.add('on'); clearTimeout(led._t); led._t = setTimeout(() => led.classList.remove('on'), ms); };
function showPeaks(peaks) { engBtns.forEach((b, e) => { if (peaks[e] > 0.02) flash(b.querySelector('i'), 80); }); }
let scShown = 0;
function showSc(v) {
  scShown = Math.max(v, scShown * 0.8);
  const n = Math.round(Math.min(1, scShown) * 12);
  document.querySelectorAll('.envm .segs i').forEach((x, i) => x.classList.toggle('on', i < n));
}

// ---------------------------------------------------------------------------------------------------------------
// the engine tabs, under their groups of keys, and the FX + MASTER tab
// ---------------------------------------------------------------------------------------------------------------
const engBtns = Array.from({ length: MAX_ENGINES }, (_, e) => {
  const b = document.createElement('button');
  b.className = 'btn snd'; b.type = 'button'; b.setAttribute('role', 'tab');
  b.innerHTML = `<i></i><span>${engName(e)}</span><span class="ch"></span>`;
  b.addEventListener('click', () => { S.view = 'synth'; select(e); });
  $('sounds').append(b);
  return b;
});
function select(e) { S.sel = e; save(); drawAll(); drawView(); }
function drawView() {
  const fx = S.view === 'fx';
  $('fxside').hidden = !fx; document.querySelector('.editor').hidden = fx;
  engBtns.forEach((b, k) => b.setAttribute('aria-selected', !fx && k === S.sel));
  $('fx-tab').setAttribute('aria-selected', fx);
}
$('fx-tab').addEventListener('click', () => { S.view = S.view === 'fx' ? 'synth' : 'fx'; save(); drawView(); });

// ---------------------------------------------------------------------------------------------------------------
// the knob grid: every control of the sound, on one grid shared by every engine (SPEC 5.19). Four rows of sections on
// 14 columns of equal cells, one knob to a cell (a menu takes two), so every knob lines up with the knobs above and
// below it. A row that doesn't fill the width ends in an empty filler. The two columns on the right are the key's
// own: its REVERB send and PAN on the first row, above its big LEVEL
// ---------------------------------------------------------------------------------------------------------------
let faderDraws = [];
const drawFaders = () => faderDraws.forEach((d) => d());
// a part that's silent now: its section is greyed, its knobs still turn
const PART_LEVEL = { 'mod a': 'aAmount', 'mod b': 'bAmount', noise: 'noise', pitch: 'pAmount', click: 'clickVol' };
const locked = (id) => S.locks[S.sel].includes(id);
function padlock(el, id, label) {
  const lock = document.createElement('button'); lock.type = 'button'; lock.className = 'lock'; lock.setAttribute('aria-label', `Lock ${label}`);
  lock.innerHTML = LOCK_SVG; el.append(lock);
  lock.addEventListener('click', () => {
    const L = S.locks[S.sel], on = !L.includes(id);
    if (on) L.push(id); else L.splice(L.indexOf(id), 1);
    save(); drawFaders(); drawLocks();
    say(on ? `${engName(S.sel)} ${label} <em>locked</em>: the randomisers leave it as it is, on every key of ${engName(S.sel)}` : `${engName(S.sel)} ${label} <em>unlocked</em>`);
  });
  return () => {
    const l = locked(id); lock.setAttribute('aria-pressed', l);
    lock.title = l ? `${label} is locked on ${engName(S.sel)}: the randomisers leave it as it is, on every key. Click to unlock` : `Lock ${label}: the randomisers then leave it as it is, on every key of ${engName(S.sel)}`;
  };
}
const catchStop = (c, x) => { if (c.ui !== 'dial') return x; for (const [, at] of c.stops) if (Math.abs(x - at) <= 2) return at; return x; };
function paramCell(c) {
  if (c.ui === 'switch') {
    const sw = switchCell(c.label, ['OFF', 'ON'], c.label, () => valueNow(c.id), (v) => { if (editValue(c.id, !!v)) say(`${keyName(place())} ${c.label} <em>${v ? 'ON' : 'OFF'}</em>`); });
    sw.el.dataset.learn = JSON.stringify({ t: 'par', id: c.id });
    const lit = () => sw.el.classList.toggle('keyed', c.id in curKey().edits);
    const dl = padlock(sw.el, c.id, c.label);
    faderDraws.push(sw.draw, lit, dl);
    return sw.el;
  }
  if (c.ui === 'menu' || c.ui === 'target') {
    const el = document.createElement('div'); el.className = 'vsel';
    const sid = 'sel-' + c.id;
    el.innerHTML = `<label for="${sid}">${c.label}</label>`;
    const s = document.createElement('select'); s.id = sid;
    if (c.ui === 'menu') c.names.forEach((n, i) => s.append(new Option(n, i)));
    else { s.append(new Option('none', '')); for (const id of TARGETS) s.append(new Option(targetLabel(id), id)); }
    s.addEventListener('change', () => {
      const v = c.ui === 'menu' ? Number(s.value) : s.value || null;
      if (editValue(c.id, v)) say(`${keyName(place())} ${c.label} <em>${showValue(c, v)}</em>`);
    });
    el.append(s);
    el.dataset.learn = JSON.stringify({ t: 'par', id: c.id });
    const dl = padlock(el, c.id, c.label);
    faderDraws.push(() => { const v = valueNow(c.id); s.value = v == null ? '' : String(v); el.classList.toggle('keyed', c.id in curKey().edits); }, dl);
    return el;
  }
  const k = knob({
    label: c.label, max: c.max, centre: c.ui === 'pm' ? c.centre : undefined,
    get: () => valueNow(c.id),
    was: () => curKey().edits[c.id],
    show: (v) => showValue(c, v, curKey().sound.params),
    put: (x) => {
      x = clamp(x, 0, c.max); x = catchStop(c, Math.round(x));
      if (x === valueNow(c.id)) return;
      if (editValue(c.id, x)) { k.draw(); say(`${keyName(place())} ${c.label} <em>${showValue(c, x, curKey().sound.params)}</em>`); }
    },
    reset: () => { if (keyLocked(place())) { lockedMsg(); return; } const was = curKey().edits[c.id]; if (was !== undefined) { editValue(c.id, was); drawFaders(); say(`${keyName(place())} ${c.label} back to <em>${showValue(c, was, curKey().sound.params)}</em>`); } },
  });
  k.el.dataset.learn = JSON.stringify({ t: 'par', id: c.id });
  const dl = padlock(k.el, c.id, c.label);
  faderDraws.push(k.draw, () => k.el.classList.toggle('keyed', c.id in curKey().edits), dl);
  return k.el;
}
function outCell(o) {
  const k = knob({
    label: o.label, max: o.max, centre: o.centre, lr: o.id === 'pan',
    get: () => curKey().out[o.id], show: (v) => (o.show ? o.show(v) : String(Math.round(v))),
    put: (x) => { x = clamp(Math.round(x), 0, o.max); if (editValue(o.id, x)) { k.draw(); say(`${keyName(place())} ${o.label} <em>${o.show ? o.show(x) : x}</em>`); } },
    reset: () => { if (editValue(o.id, o.def)) { drawFaders(); say(`${keyName(place())} ${o.label} back to <em>${o.show ? o.show(o.def) : o.def}</em>`); } },
  });
  k.el.dataset.learn = JSON.stringify({ t: 'par', id: o.id });
  faderDraws.push(k.draw, padlock(k.el, o.id, o.label));
  return k.el;
}
function buildFaders() {
  const box = $('faders'); box.innerHTML = ''; faderDraws = [];
  const cell = (el, r0, r1, c0, c1) => { el.style.gridArea = `${r0} / ${c0} / ${r1} / ${c1}`; return el; };
  GRID_ROWS.forEach((secs, r) => {
    let col = 1;
    const sect = (n, cls) => { const el = document.createElement('div'); el.className = 'sect' + (cls || '') + (r ? ' rt' : '') + (col > 1 ? ' sep' : ''); el.style.setProperty('--n', n); cell(el, r + 1, r + 2, col, col + n); col += n; box.append(el); return el; };
    for (const sec of secs) {
      const list = PARAMS.filter((p) => p.section === sec);
      const el = sect(list.reduce((a, p) => a + cells(p), 0));
      el.innerHTML = `<h3>${sec}</h3><div class="row"></div>`;
      const row = el.querySelector('.row');
      for (const p of list) row.append(paramCell(p));
      if (PART_LEVEL[sec]) faderDraws.push(() => el.classList.toggle('off', !valueNow(PART_LEVEL[sec])));
    }
    if (col <= GRID_COLS) sect(GRID_COLS + 1 - col, ' fill');
  });
  const outs = cell(document.createElement('div'), 1, 2, GRID_COLS + 1, GRID_COLS + 3); outs.className = 'sect sends sep'; outs.style.setProperty('--n', 2);
  outs.innerHTML = '<h3>output</h3><div class="row"></div>';
  for (const o of OUT_PARAMS.filter((o) => o.id !== 'level')) outs.querySelector('.row').append(outCell(o));
  box.append(outs);
  const big = cell(outCell(OUT_PARAMS.find((o) => o.id === 'level')), 2, 5, GRID_COLS + 1, GRID_COLS + 3); big.classList.add('big', 'rt', 'sep');
  box.append(big);
  makePanel($('make'));
  drawFaders();
}

// ---------------------------------------------------------------------------------------------------------------
// the key panel: the key's header, the strip of all 25 keys, and its buttons
// ---------------------------------------------------------------------------------------------------------------
function keyInfo(k) {
  const s = k.sound, n = editCount(k);
  const from = s.from === 'starter' ? 'starter set' : s.from === 'made' ? 'made here' : `from ${s.from.kit}`;
  return `${s.name} · ${s.type} · ${s.kind} finish · ${from}${n ? ` · ${n} edit${n === 1 ? '' : 's'}` : ''}`;
}
function drawHead() {
  const p = place(), k = S.keys[p];
  $('kh-note').textContent = noteName(noteOf(p)); $('kh-num').textContent = '#' + noteOf(p);
  $('kh-engine').textContent = engName(S.sel); $('kh-info').textContent = k.lock ? `locked · ${k.sound.name}` : keyInfo(k);
  $('clear-key').disabled = k.lock;
  $('lock-key').setAttribute('aria-pressed', k.lock); $('lock-key').querySelector('span').textContent = k.lock ? 'LOCKED' : 'LOCK KEY';
  diceBtn.disabled = k.lock; $('alter-key').disabled = k.lock; $('paste-key').disabled = k.lock || !clip;
  $('screen').classList.toggle('keylocked', k.lock);
}
const stripKeys = [];
function buildStrip() {
  const box = $('keystrip'); box.innerHTML = ''; stripKeys.length = 0;
  Z().forEach((z, e) => {
    const g = document.createElement('div'); g.className = 'kgroup';
    g.innerHTML = `<span class="kz">${engName(e)}</span><div class="keys"></div>`;
    for (let p = z.lo; p <= z.hi; p++) {
      const k = document.createElement('button'); k.type = 'button'; k.className = 'k' + ([1, 3, 6, 8, 10].includes(noteOf(p) % 12) ? ' blk' : '');
      k.innerHTML = LOCK_SVG;
      let down = false;
      k.addEventListener('pointerdown', (ev) => { try { k.setPointerCapture(ev.pointerId); } catch (err) { /* gone */ } down = true; startAudio().then(() => keyDown(p, 100)); });
      const up = () => { if (down) { down = false; keyUp(p); } };
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) k.addEventListener(ev, up);
      g.querySelector('.keys').append(k); stripKeys.push({ k, p });
    }
    box.append(g);
  });
}
function drawStrip() {
  drawPhone();
  for (const { k, p } of stripKeys) {
    const key = S.keys[p];
    k.classList.toggle('sel', engineOfKey(p) === S.sel && p === place());
    k.classList.toggle('locked', key.lock);
    k.classList.toggle('own', editCount(key) > 0 && !key.lock); // a dot: changed by hand
    k.title = `${keyName(p)} #${noteOf(p)} · ${key.sound.name} (${key.sound.type})${key.lock ? ' · locked' : ''}${editCount(key) ? ' · edited' : ''}`;
  }
}
function drawAll() { drawHead(); drawStrip(); drawFaders(); drawSide(); }

// ---- COPY, PASTE, CLEAR, LOCK KEY ----
let clip = null;
function copyKey() {
  const k = curKey();
  clip = copySound(k.sound);
  $('paste-key').disabled = k.lock; $('paste-key').title = `Paste ${clip.name} onto this key (Cmd+V / Ctrl+V)`;
  say(`copied <em>${clip.name}</em> from ${keyName(place())} · pick a key and paste (Cmd+V / Ctrl+V)`);
}
function pasteKey() {
  if (!clip) { say('nothing copied yet: COPY (Cmd+C / Ctrl+C) a key first'); return; }
  const p = place(); if (keyLocked(p)) { lockedMsg(); return; }
  change(() => { const k = S.keys[p]; k.sound = copySound(clip); k.edits = {}; k.home = null; },
    `pasted <em>${clip.name}</em> onto ${keyName(p)} · UNDO takes it back`).then(() => play(p, 100));
}
$('copy-key').addEventListener('click', copyKey);
$('paste-key').addEventListener('click', pasteKey);
$('clear-key').addEventListener('click', () => {
  const p = place(); if (keyLocked(p)) { lockedMsg(); return; }
  const b = baseSound(engineOfKey(p));
  change(() => { const k = S.keys[p]; k.sound = copySound(b); k.edits = {}; k.home = null; k.out.trim = 0; },
    `${keyName(p)}: back to the engine's base sound, <em>${b.name}</em> (${b.type}) · UNDO takes it back`).then(() => play(p, 100));
});
function lockKey() {
  const p = place(), k = S.keys[p];
  k.lock = !k.lock;
  save(); drawAll();
  say(`${keyName(p)}: ${k.lock ? 'locked, nothing changes it now' : 'unlocked'}`);
}
$('lock-key').addEventListener('click', lockKey);

// ---------------------------------------------------------------------------------------------------------------
// the randomisers. New sounds come from the library (the starter set until kits are imported); every one keeps locked
// keys, closed padlocks and the key's send, and places the pan by the sound's type. ALTER always starts from the
// sound's home (what it was before the first alter since the last hand edit), so repeated presses vary one sound
// ---------------------------------------------------------------------------------------------------------------
const SOURCES = { kit: { name: 'KIT', cap: 'A LIBRARY SOUND AS IT IS' } };
function panFor(type) {
  if (type === 'kick' || type === 'tom') return 64;
  if (type === 'snare' || type === 'clap') return Math.round(64 + (rnd() * 2 - 1) * 0.2 * 63);
  return Math.floor(rnd() * 128);
}
/** put a sound on a key as a randomiser does: padlocks keep what the key had, the send stays, the pan by type */
function deal(p, sound) {
  const k = S.keys[p], e = engineOfKey(p), L = S.locks[e], s = copySound(sound);
  for (const id of L) if (PARAM[id]) s.params[id] = k.sound.params[id];
  k.sound = s; k.edits = {}; k.home = null; k.out.trim = 0;
  if (s.level != null && !L.includes('level')) k.out.level = s.level;
  if (!L.includes('pan')) k.out.pan = panFor(s.type);
}
const newSound = (not) => { const lib = library(); let s; do s = pick(lib); while (lib.length > 1 && s.name === not); return s; };
// what ALTER leaves alone (SPEC 8.5): the routing, the targets, LFO SYNC and KIND; dials move at most ±15
const ALTERS = PARAMS.filter((p) => !['switch', 'target', 'hidden'].includes(p.ui) && p.id !== 'lfoSync');
function vary(c, h, depth, wild) {
  if (c.ui === 'dial') return clamp(Math.round(h + (rnd() * 2 - 1) * 15 * Math.min(1, depth * 4)), 0, c.max);
  if (c.ui === 'menu' || c.ui === 'steps') return rnd() < depth ? Math.floor(rnd() * (c.max + 1)) : h;
  const lo = 0, hi = c.max; // (the usual ranges learned from the library come with step 10; WILD will then open them)
  void wild;
  return clamp(Math.round(h + (rnd() * 2 - 1) * depth * (hi - lo)), lo, hi);
}
function alterOne(p, depth) {
  const k = S.keys[p];
  if (k.lock) return;
  const L = S.locks[engineOfKey(p)], home = k.home || { ...k.sound.params };
  for (const c of ALTERS) if (!L.includes(c.id)) k.sound.params[c.id] = vary(c, home[c.id], depth, S.rand.wild);
  k.home = home;
}
const alterDepth = () => clamp(S.rand.alter, 1, 100) / 100;
const wildly = () => (S.rand.wild ? ' wild' : '');
const zoneKeys = (e) => { const z = Z()[e], o = []; for (let p = z.lo; p <= z.hi; p++) o.push(p); return o; };
const allKeys = () => Array.from({ length: KEYS }, (_, p) => p);
function keptNote(es) {
  const names = [...new Set(es.flatMap((e) => S.locks[e]).map((id) => ctrl(id)?.label).filter(Boolean))];
  return !names.length ? '' : names.join(', ').length <= 16 ? ` · locked <em>${names.join(', ')}</em> kept` : ` · <em>${names.length} locked knobs</em> kept`;
}
const lockedKeysIn = (ps) => ps.filter((p) => S.keys[p].lock).length;
const keysKept = (ps) => { const n = lockedKeysIn(ps); return n ? ` · ${n} locked key${n === 1 ? '' : 's'} kept` : ''; };
function scatter(ps) { for (const p of ps) if (!S.keys[p].lock) deal(p, newSound(S.keys[p].sound.name)); }
const roll = makeDice([]); // (set up with the buttons below)
let rollDice = roll;
function randKey(type) {
  const p = place(); if (keyLocked(p)) { lockedMsg(); return; }
  let s, what;
  if (type) {
    // MAKE THIS KEY: a sound of the type, from the library (the starter set's for now), altered by 15%
    const of = library().filter((x) => x.type === type), base = of.length ? pick(of) : starterOf(type);
    s = copySound(base); s.name = jumble(rnd, 5, 9).toUpperCase(); s.from = 'made'; s.type = type;
    what = `a new <em>${type}</em>, ${s.name}`;
  } else { s = newSound(S.keys[p].sound.name); what = `<em>${s.name}</em> (${s.type})`; }
  rollDice();
  change(() => { deal(p, s); if (type) { S.keys[p].home = null; alterOne(p, 0.15); S.keys[p].home = null; } },
    `${keyName(p)}: ${what}${keptNote([engineOfKey(p)])} (UNDO takes it back)`).then(() => play(p, 100));
}
function alterKey() {
  const p = place(); if (keyLocked(p)) { lockedMsg(); return; }
  change(() => alterOne(p, alterDepth()), `${keyName(p)} altered <em>${S.rand.alter}%${wildly()}</em>${keptNote([engineOfKey(p)])} (UNDO takes it back)`).then(() => play(p, 100));
}
$('alter-key').addEventListener('click', alterKey);
const onEngines = () => Z().map((_, e) => e);
$('scatter').addEventListener('click', () => change(() => scatter(zoneKeys(S.sel)), `${engName(S.sel)}: a new sound on every key${keysKept(zoneKeys(S.sel))}${keptNote([S.sel])}`));
$('kit-scatter').addEventListener('click', () => change(() => scatter(allKeys()), `all engines: a new sound on every key${keysKept(allKeys())}${keptNote(onEngines())}`));
$('alter').addEventListener('click', () => change(() => zoneKeys(S.sel).forEach((p) => alterOne(p, alterDepth())), `${engName(S.sel)}: every key altered <em>${S.rand.alter}%${wildly()}</em>${keysKept(zoneKeys(S.sel))}${keptNote([S.sel])}`));
$('kit-alter').addEventListener('click', () => change(() => allKeys().forEach((p) => alterOne(p, alterDepth())), `all engines: every key altered <em>${S.rand.alter}%${wildly()}</em>${keysKept(allKeys())}${keptNote(onEngines())}`));

// ---- MAKE THIS KEY: two rows of six, one type each, and ANY ----
const MAKE = [['kick', 'KICK'], ['tom', 'TOM'], ['perc', 'PERC'], ['zap', 'ZAP'], ['snare', 'SNARE'], ['clap', 'CLAP'],
  ['rim', 'RIM'], ['bell', 'BELL'], ['closed hat', 'C HAT'], ['open hat', 'O HAT'], ['cymbal', 'CYMBAL'], ['', 'ANY']];
function makePanel(el) {
  el.innerHTML = '<span class="dim mkl">MAKE<br>THIS<br>KEY</span><div class="mk"></div>';
  const box = el.querySelector('.mk');
  for (const [type, text] of MAKE) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm'; b.textContent = text;
    b.title = type ? `Make this key a ${type}: a new one each press (UNDO takes it back)` : 'Make this key a sound of any type: a new one each press (UNDO takes it back)';
    b.addEventListener('click', () => { if (!learn) randKey(type || pick(TYPES.filter((t) => t !== 'other'))); });
    box.append(b);
  }
  faderDraws.push(() => { const l = keyLocked(place()); for (const b of box.children) b.disabled = l; });
}

// ---- INIT PATCH: every key a fresh sound, 30% of the keys a reverb send, BPM and the effects reset. With locked
// keys it asks first (press again within four seconds) ----
const INIT_REVERB = 30, INIT_SEND = [45, 95];
function initPatch() {
  for (const k of S.keys) k.lock = false;
  scatter(allKeys());
  const order = allKeys(); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const some = new Set(order.slice(0, Math.round(INIT_REVERB / 100 * KEYS)));
  for (const p of allKeys()) { const e = engineOfKey(p); if (!S.locks[e].includes('send')) S.keys[p].out.send = some.has(p) ? INIT_SEND[0] + Math.floor(rnd() * (INIT_SEND[1] - INIT_SEND[0] + 1)) : 0; }
  const d = fxDefaults(); S.fx = { ...d, out: { ...d.out, eng: S.fx.out.eng } }; // (the engine levels stay)
  S.bpm = 120; sendFx(); sendTempo(); drawBpm(); buildFx();
  S.preset = { id: null, name: newName() };
  return S.keys.filter((k) => k.out.send > 0).length;
}
let initArmed = 0;
function drawInit() {
  const nl = lockedKeysIn(allKeys());
  $('init-patch').setAttribute('aria-pressed', !!initArmed);
  $('init-info').innerHTML = initArmed ? `REPLACES ${nl} LOCKED KEY${nl === 1 ? '' : 'S'}<br>PRESS AGAIN TO GO` : `A FRESH SOUND ON EVERY KEY<br>${INIT_REVERB}% REVERB<br>BPM, FX + MASTER RESET`;
}
function disarmInit() { clearTimeout(initArmed); initArmed = 0; drawInit(); }
$('init-patch').addEventListener('click', () => {
  const nl = lockedKeysIn(allKeys());
  if (nl && !initArmed) { initArmed = setTimeout(disarmInit, 4000); drawInit(); say(`INIT PATCH replaces every key, the <em>${nl} locked</em> too: press it again to go ahead`); return; }
  disarmInit();
  let n;
  change(() => { n = initPatch(); }, 'INIT PATCH', true).then(() => { drawPreset(); say(`new patch <em>${S.preset.name}</em>: reverb on ${n} keys · BPM, FX and master reset${keptNote(onEngines())}`); });
});

// ---- the RANDOM menu's settings ----
const randDraws = [hbar($('rand-bars'), 'ALTER', { min: 1, max: 100, get: () => S.rand.alter, set: (v) => { S.rand.alter = v; save(); }, show: (v) => v + '%', dflt: 10 })];
$('wild').checked = !!S.rand.wild;
$('wild').addEventListener('change', () => { S.rand.wild = $('wild').checked; save(); });
const lockCount = () => S.locks.slice(0, S.engines).reduce((a, l) => a + l.length, 0);
function drawLocks() { const n = lockCount(); $('lock-count').textContent = n ? `${n} LOCKED` : 'NONE LOCKED'; $('lock-none').disabled = !n; }
$('lock-none').addEventListener('click', () => {
  const n = lockCount(); S.locks.forEach((l) => { l.length = 0; }); save(); drawFaders(); drawLocks();
  say(`<em>${n}</em> knob${n === 1 ? '' : 's'} unlocked: everything is open to the randomisers again`);
});
function drawSide() { $('rand-name').textContent = engName(S.sel); randDraws.forEach((d) => d()); drawLocks(); drawInit(); }

// ---- the menus: RANDOM, SETTINGS and PRESET open one at a time and close on a press outside or Esc ----
function openMenu(open) { $('menu-panel').hidden = !open; $('menu-btn').setAttribute('aria-expanded', open); if (initArmed) disarmInit(); if (open) { openPresets(false); openSettings(false); kits.close(); drawSide(); } }
function openSettings(open) { $('settings-panel').hidden = !open; $('settings-btn').setAttribute('aria-expanded', open); if (open) { openMenu(false); openPresets(false); kits.close(); } }
$('menu-btn').addEventListener('click', () => openMenu($('menu-panel').hidden));
$('settings-btn').addEventListener('click', () => openSettings($('settings-panel').hidden));
document.addEventListener('pointerdown', (e) => {
  if (!$('menu-panel').hidden && !e.target.closest('#menu')) openMenu(false);
  if (!$('preset-panel').hidden && !e.target.closest('#pmenu')) openPresets(false);
  if (!$('settings-panel').hidden && !e.target.closest('#smenu')) openSettings(false);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { openMenu(false); openPresets(false); openSettings(false); } });
// a menu (CLICK, the targets) never changes under the scroll wheel (some browsers step a focused one)
document.addEventListener('wheel', (e) => { if (e.target.closest && e.target.closest('select')) e.preventDefault(); }, { passive: false, capture: true });
setupColours(say);

// ---- SETTINGS: tempo, return, engines, low key, playing ----
function drawBpm() { $('bpm').textContent = S.bpm; }
function setBpm(v) { S.bpm = clamp(Math.round(v), 40, 240); drawBpm(); sendTempo(); save(); drawFaders(); }
$('bpm-down').addEventListener('click', (e) => setBpm(S.bpm - (e.shiftKey ? 10 : 1)));
$('bpm-up').addEventListener('click', (e) => setBpm(S.bpm + (e.shiftKey ? 10 : 1)));
$('bpm').addEventListener('dblclick', () => setBpm(120));
const drawRet = () => { $('ret').textContent = RETURNS[S.ret]; };
$('ret').addEventListener('click', (e) => {
  S.ret = (S.ret + (e.shiftKey ? RETURNS.length - 1 : 1)) % RETURNS.length; drawRet(); sendTempo(); save();
  say(`RETURN <em>${RETURNS[S.ret]}</em>: let go of the newest key in a zone and the earlier held key comes back ${S.ret ? 'on the next ' + RETURNS[S.ret] : 'at once'}`);
});
for (const [id, k, on, off] of [['fresh-noise', 'freshNoise', 'every live hit gets noise of its own', 'every hit plays the same noise'],
  ['soft-retrig', 'softRetrig', 'a new note fades the old one out over 1 ms', 'a new note restarts the engine hard, as the hardware did']]) {
  $(id).checked = !!S.settings[k];
  $(id).addEventListener('change', () => { S.settings[k] = $(id).checked; save(); send({ type: 'settings', settings: S.settings }); say(`${$(id).parentElement.childNodes[2].textContent.trim()} <em>${S.settings[k] ? 'on' : 'off'}</em>: ${S.settings[k] ? on : off}`); });
}
function drawZones() {
  $('zones').textContent = `MIDI CH 1 · ${noteName(S.low)}-${noteName(S.low + KEYS - 1)}`;
  engBtns.forEach((b, e) => {
    const z = Z()[e]; b.hidden = !z;
    if (z) { b.querySelector('.ch').textContent = `${noteName(noteOf(z.lo))}-${noteName(noteOf(z.hi))}`; b.title = `${engName(e)}: keys ${noteName(noteOf(z.lo))} to ${noteName(noteOf(z.hi))} (${e + 1})`; }
  });
  $('engines').textContent = S.engines; $('eng-down').disabled = S.engines <= 1; $('eng-up').disabled = S.engines >= MAX_ENGINES;
  $('low-key').textContent = `${noteName(S.low)} #${S.low}`;
  $('low-down').disabled = S.low - 12 < 0; $('low-up').disabled = S.low + 12 + KEYS - 1 > 127;
}
function moveLow(by) {
  const to = S.low + by; if (to < 0 || to + KEYS - 1 > 127) return;
  allOff(); S.low = to; save(); buildStrip(); drawZones(); drawAll(); alignEngines();
  say(`lowest key <em>${noteName(to)} #${to}</em>: every key keeps its sound`);
}
$('low-down').addEventListener('click', () => moveLow(-12));
$('low-up').addEventListener('click', () => moveLow(12));
// ENGINES: the keys keep their sounds by place; only the zones move
function showEngines(n) {
  if (n === S.engines) return;
  allOff(); S.engines = n; send({ type: 'engines', n });
  resetEditKeys(); engKey.length = 0;
  if (S.sel >= n) S.sel = n - 1;
  buildStrip(); buildPads(); drawZones(); select(S.sel); fitScreen();
}
function setEngineCount(n) {
  n = clamp(n, 1, MAX_ENGINES); if (n === S.engines) return;
  snapshot(`ENGINES ${S.engines} → ${n}`);
  showEngines(n); save();
  say(`ENGINES <em>${n}</em>: ${Z().map((z, e) => `${e + 1}: ${noteName(noteOf(z.lo))}-${noteName(noteOf(z.hi))}`).join(' · ')} · every key keeps its sound`);
}
$('eng-down').addEventListener('click', () => setEngineCount(S.engines - 1));
$('eng-up').addEventListener('click', () => setEngineCount(S.engines + 1));

// ---------------------------------------------------------------------------------------------------------------
// FX + MASTER: the master distortion (sound/dirt.js) with its sidechain, the output level and the engine levels. The
// reverb and the compressor come with step 9
// ---------------------------------------------------------------------------------------------------------------
const hz = (f) => (f < 1000 ? Math.round(f) + 'Hz' : (f / 1000).toFixed(f < 9950 ? 1 : 0) + 'k');
const sdb = (d) => (d > 0 ? '+' : '') + Math.round(d) + 'dB';
let fxDraws = [];
function gknob(label, o) {
  const k = knob({ label, max: o.max, centre: o.centre, get: o.get, show: o.show, put: (x) => { x = clamp(Math.round(x), 0, o.max); if (x !== o.get()) { o.set(x); k.draw(); } }, reset: () => { o.set(o.dflt); k.draw(); } });
  fxDraws.push(k.draw);
  return k.el;
}
function fxSect(n, title, rows, cls = '') {
  const el = document.createElement('div'); el.className = 'sect ' + cls; el.style.setProperty('--n', n);
  el.innerHTML = '<h3></h3>'; el.querySelector('h3').append(...[].concat(title));
  for (const items of rows) { const r = document.createElement('div'); r.className = 'row'; r.append(...items); el.append(r); }
  return el;
}
const span = (cls, text) => Object.assign(document.createElement('span'), { className: cls, textContent: text });
function buildDirt() {
  const D = S.fx.dirt, sayD = (what) => say(`MASTER DISTORTION ${what}`);
  const kn = (k, label, max, show, centre) => gknob(label, { max, show, centre, get: () => D[k], dflt: DIRT_DEFAULTS[k], set: (v) => { D[k] = v; sendFx(); sayD(`${label.toUpperCase()} <em>${show ? show(v) : v}</em>`); } });
  const cycle = (b, k, names, label, lit = true) => {
    const draw = () => { b.textContent = names[D[k]] ?? names[0]; if (lit) b.setAttribute('aria-pressed', D[k] > 0); };
    b.addEventListener('click', () => { D[k] = (D[k] + 1) % names.length; sendFx(); draw(); drawDirt(); sayD(`${label ? label + ' ' : ''}<em>${names[D[k]]}</em>`); });
    fxDraws.push(draw); return b;
  };
  const sw = (k, label, names, title) => {
    const el = document.createElement('div'); el.className = 'vf vsw';
    el.innerHTML = '<output></output><button class="swb" type="button"></button><span class="lab"></span>';
    el.querySelector('.lab').textContent = label; el.querySelector('.swb').title = title;
    cycle(el.querySelector('.swb'), k, names, label.toUpperCase()); return el;
  };
  const hbtn = (k, names, label, title) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm hdb'; b.title = title; return cycle(b, k, names, label, names[0] === 'OFF'); };
  const dist = fxSect(6, [span('t', 'DISTORTION'), hbtn('on', ['OFF', 'ON'], '', 'Switch the master distortion in or out')], [
    [kn('pregain', 'pregain', 48, (v) => sdb(pregainDb(v)), 24), kn('cutoff', 'cutoff', 127, (v) => hz(dirtHz(v))),
      sw('swap', 'filter', ['HP', 'LP'], 'The filter before the distortion: high-pass (the lows stay out of it) or low-pass'),
      sw('xover', 'xover', ['OFF', 'ON'], 'Crossover: the half the filter takes away goes to the clean path'),
      kn('gain', 'gain', 127), sw('clip', 'clip', ['DIODE', 'LED'], 'Clipping: diodes clip early and hard; LEDs later, louder and more open')],
    [kn('bass', 'bass', 24, (v) => sdb(bassDb(v)), 12), kn('tone', 'tone', 127, (v) => (v === 64 ? 'scoop' : (v > 64 ? '+' : '') + (v - 64)), 64),
      kn('dirty', 'dirty', 127, (v) => (v ? sdb(volDb(v)) : 'off')), kn('clean', 'clean', 127, (v) => (v ? sdb(volDb(v)) : 'off'))],
  ], 'dirt');
  const env = document.createElement('div'); env.className = 'envm';
  env.innerHTML = `<output></output><div class="segs">${'<i></i>'.repeat(12)}</div><span class="lab">env</span>`;
  const side = fxSect(6, [span('t', 'SIDECHAIN'), hbtn('sc', ['OFF', 'ON'], 'SIDECHAIN', 'Let the sidechain turn a knob of the distortion'), span('dim', 'TURNS'),
    hbtn('target', ['PREGAIN', 'CUTOFF', 'TONE'], 'SIDECHAIN TURNS', 'The knob the sidechain turns'),
    hbtn('dir', ['UP', 'DOWN'], 'SIDECHAIN DIRECTION', 'Which way it turns it: up to the top of its range, or down to the bottom')], [[
    sw('src', 'source', ['MIX', 'ENG 1', 'ENG 2', 'ENG 3', 'ENG 4', 'ENG 5', 'ENG 6'], 'What the sidechain listens to: the whole mix, or one engine on its own'),
    sw('scfilt', 'filter', ['LP', 'BP', 'HP'], "The sidechain's filter: low-pass, band-pass or high-pass at FREQ"),
    kn('freq', 'freq', 127, (v) => hz(scHz(v))), kn('sens', 'sens', 127),
    kn('decay', 'decay', 127, (v) => { const ms = decayMs(v); return ms < 1000 ? Math.round(ms) + 'ms' : (ms / 1000).toFixed(1) + 's'; }), env]], 'dirt');
  const drawDirt = () => { dist.classList.toggle('off', !D.on); side.classList.toggle('off', !D.sc); };
  fxDraws.push(drawDirt);
  return [dist, side];
}
function buildFx() {
  const top = $('fxglobal'); top.innerHTML = ''; fxDraws = [];
  const cols = [0, 1].map(() => { const c = document.createElement('div'); c.className = 'fxcol'; top.append(c); return c; });
  const h = (box, text, dim) => { const el = document.createElement('h2'); el.innerHTML = `${text} <span class="dim">${dim}</span>`; box.append(el); };
  h(cols[0], 'MASTER', 'EVERYTHING GOES THROUGH');
  cols[0].append(...buildDirt());
  h(cols[1], 'OUTPUT', 'THE ENGINES AND THE LEVEL');
  const O = S.fx.out;
  cols[1].append(fxSect(S.engines, 'ENGINE LEVELS', [Z().map((_, e) => gknob(`eng ${e + 1}`, { max: 127, get: () => O.eng[e], dflt: 127, show: (v) => Math.round(v / 127 * 100) + '%', set: (v) => { O.eng[e] = v; sendFx(); say(`${engName(e)} level <em>${Math.round(v / 127 * 100)}%</em>`); } }))]));
  cols[1].append(fxSect(1, 'OUTPUT', [[gknob('level', { max: 100, get: () => O.level, dflt: 80, show: (v) => v + '%', set: (v) => { O.level = v; sendFx(); say(`OUTPUT LEVEL <em>${v}%</em>`); } })]]));
  const note = document.createElement('p'); note.className = 'dim note'; note.textContent = 'THE REVERB AND THE COMPRESSOR COME IN A LATER STEP';
  cols[1].append(note);
  fxDraws.forEach((d) => d());
}
faderDraws.push(() => fxDraws.forEach((d) => d()));

// ---------------------------------------------------------------------------------------------------------------
// the computer's keys: [ and ] (or the arrows) step to the key before or after and play it, Space plays it again,
// K new sound, A alter, L lock, Z undo, F the FX + MASTER tab, 1-6 an engine, Cmd/Ctrl+C and V copy and paste
// ---------------------------------------------------------------------------------------------------------------
function stepKey(by) { const p = (place() + by + KEYS) % KEYS; startAudio().then(() => play(p, 100)); }
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === 'c' || e.key === 'v')) {
    if (e.target.closest('input, select, textarea, [contenteditable]') || String(getSelection())) return;
    e.preventDefault(); if (e.key === 'c') copyKey(); else pasteKey(); return;
  }
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key === 'z') { if (e.target.closest('input, textarea, [contenteditable]')) return; e.preventDefault(); undo(); return; }
  if (e.target.closest('select, input[type="text"]') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key >= '1' && e.key <= String(S.engines)) { S.view = 'synth'; select(Number(e.key) - 1); }
  else if (e.key === 'z' || e.key === 'Z') undo();
  else if (e.key === '[' || e.key === ']') stepKey(e.key === ']' ? 1 : -1);
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); stepKey(e.key === 'ArrowRight' ? 1 : -1); }
  else if (e.key === ' ' && !e.target.closest('input, textarea') && (!e.target.closest('button') || e.target.closest('.k'))) { e.preventDefault(); startAudio().then(() => play(place(), 100)); }
  else if (e.key === 'k' || e.key === 'K') randKey();
  else if (e.key === 'a' || e.key === 'A') alterKey();
  else if (e.key === 'l' || e.key === 'L') lockKey();
  else if (e.key === 'f' || e.key === 'F') $('fx-tab').click();
});

// ---------------------------------------------------------------------------------------------------------------
// PRESETS: the whole patch kept under a name in this browser. Keys are kept by their place in the layout, so a preset
// loads the same at any LOW KEY. Not in a preset: knob padlocks, the knob map, LOW KEY, the RANDOM menu's settings,
// the screen's colours
// ---------------------------------------------------------------------------------------------------------------
const newId = () => Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36).padStart(4, '0');
const baseKey = (p) => newKey(baseSound(engineOf(p, DEFAULT_ENGINES)));
function tidyPreset(x) {
  const data = x && tidyPatch(x.data, baseKey);
  if (!data) return null;
  return { id: /^[a-z0-9]{6,24}$/.test(x.id) ? x.id : newId(), name: data.name, t: Number(x.t) || 0, data };
}
let presets = [];
try { const a = JSON.parse(localStorage.getItem(PRESET_STORE)); if (Array.isArray(a)) presets = a.map(tidyPreset).filter(Boolean); } catch (e) { /* none */ }
function storePresets() { try { localStorage.setItem(PRESET_STORE, JSON.stringify(presets)); return true; } catch (e) { return false; } }
const storeOr = (said) => { if (!storePresets()) said += ' · <em>the browser would not keep it</em> (storage full or blocked): EXPORT writes a file'; say(said); };
const patchData = () => ({ v: 1, name: S.preset.name, engines: S.engines, keys: structuredClone(S.keys), fx: structuredClone(S.fx), bpm: S.bpm });
const presetSaved = () => presets.find((p) => p.id === S.preset.id);
const sameData = (a, b) => canon({ ...a, name: '' }) === canon({ ...b, name: '' });
const presetDirty = () => { const p = presetSaved(); return !p || !sameData(p.data, patchData()); };
const newName = () => presetName(Math.random, new Set([...presets.map((p) => p.name), S.preset.name]));
function loadPreset(id, what) {
  const p = presets.find((x) => x.id === id); if (!p) return;
  change(() => {
    const d = structuredClone(p.data);
    S.keys = d.keys; S.fx = d.fx; S.bpm = d.bpm; S.preset = { id: p.id, name: p.name };
    showEngines(d.engines); sendFx(); sendTempo(); drawBpm(); buildFx();
  }, `${what || 'loaded'} <em>${p.name}</em> (UNDO takes it back)`, true).then(() => { drawPreset(); sendKey(place()); });
}
function savePreset(asNew) {
  let p = asNew ? null : presetSaved();
  if (asNew) S.preset = { id: null, name: newName() };
  if (p) { p.data = patchData(); p.name = S.preset.name; p.t = Date.now(); }
  else { p = { id: newId(), name: S.preset.name, t: Date.now(), data: patchData() }; presets.push(p); S.preset.id = p.id; }
  save(); drawPreset();
  storeOr(`saved <em>${p.name}</em>${asNew ? ' as a new preset' : ''} · ${presets.length} preset${presets.length === 1 ? '' : 's'} kept in this browser`);
}
function renamePreset(name) {
  name = cleanName(name);
  if (!name || name === S.preset.name) { drawPreset(); return; }
  S.preset.name = name;
  const p = presetSaved(); if (p) { p.name = name; p.data.name = name; }
  save(); drawPreset();
  if (p) storeOr(`preset renamed <em>${name}</em>`); else say(`this patch is <em>${name}</em>: SAVE keeps it`);
}
let delArmed = null, delT = 0;
function deletePreset(id) {
  const p = presets.find((x) => x.id === id); if (!p) return;
  clearTimeout(delT);
  if (delArmed !== id) { delArmed = id; delT = setTimeout(() => { delArmed = null; drawPreset(); }, 4000); drawPreset(); say(`delete <em>${p.name}</em>? Press SURE? (it can't be undone)`); return; }
  delArmed = null;
  presets = presets.filter((x) => x.id !== id);
  if (S.preset.id === id) S.preset.id = null;
  save(); drawPreset(); storeOr(`deleted <em>${p.name}</em>`);
}
function exportPresets() {
  if (!presets.length) { say('nothing saved yet: SAVE keeps this patch, then EXPORT writes the list to a file'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'vandoru', kind: 'presets', version: 1, items: presets }, null, 1)], { type: 'application/json' }));
  a.download = `vandoru-presets-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  say(`exported <em>${presets.length}</em> preset${presets.length === 1 ? '' : 's'} to ${a.download}`);
}
function importPresets(text) {
  let list;
  try { const j = JSON.parse(text); list = Array.isArray(j) ? j : j && j.kind === 'presets' && j.items; } catch (e) { list = null; }
  if (!Array.isArray(list)) { say('that file has no presets in it'); return 0; }
  let added = 0, had = 0;
  for (const raw of list) {
    const p = tidyPreset(raw); if (!p) continue;
    const old = presets.find((x) => x.id === p.id);
    if (old && sameData(old.data, p.data)) { had++; continue; }
    if (old) p.id = newId();
    if (!p.t) p.t = Date.now();
    presets.push(p); added++;
  }
  drawPreset();
  storeOr(added ? `imported <em>${added}</em> preset${added === 1 ? '' : 's'}${had ? ` (${had} already here)` : ''}` : had ? `nothing new: all ${had} are already here` : 'that file has no presets in it');
  return added;
}
function drawPreset() {
  const p = presetSaved(), dirty = presetDirty();
  $('preset-name').textContent = S.preset.name; $('preset-mark').textContent = dirty ? '*' : '';
  $('preset-btn').title = `${S.preset.name}: ${!p ? 'not saved yet' : dirty ? 'changed since it was saved' : 'saved'}. Save, load, rename and delete presets, and write them to a file`;
  if ($('pv-name')) $('pv-name').textContent = S.preset.name;
  if ($('preset-panel').hidden) return;
  $('preset-state').textContent = !p ? 'NOT SAVED YET' : dirty ? 'CHANGED SINCE SAVED' : 'SAVED';
  if (document.activeElement !== $('preset-input')) $('preset-input').value = S.preset.name;
  $('preset-save').disabled = !!p && !dirty; $('preset-save-new').disabled = !p; $('preset-revert').disabled = !p || !dirty;
  $('preset-count').textContent = presets.length ? String(presets.length) : '';
  const list = $('preset-list'); list.innerHTML = '';
  if (!presets.length) { list.innerHTML = '<p class="dim">NOTHING SAVED YET<br>SAVE KEEPS THIS PATCH IN THIS BROWSER</p>'; return; }
  for (const x of [...presets].sort((a, b) => b.t - a.t)) {
    const row = document.createElement('div'); row.className = 'prow'; if (x.id === S.preset.id) row.setAttribute('aria-current', 'true');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pload'; b.textContent = x.name; b.title = `Load ${x.name} (UNDO goes back to this patch)`;
    b.addEventListener('click', () => loadPreset(x.id));
    const del = document.createElement('button'); del.type = 'button'; del.className = 'pdel'; del.textContent = delArmed === x.id ? 'SURE?' : 'X';
    del.title = `Delete ${x.name}: press twice`; del.setAttribute('aria-label', `Delete ${x.name}`); del.setAttribute('aria-pressed', delArmed === x.id);
    del.addEventListener('click', () => deletePreset(x.id));
    row.append(b, del); list.append(row);
  }
}
function openPresets(open) {
  $('preset-panel').hidden = !open; $('preset-btn').setAttribute('aria-expanded', open);
  if (open) { openMenu(false); openSettings(false); kits.close(); drawPreset(); } else if (delArmed) { clearTimeout(delT); delArmed = null; }
}
$('preset-btn').addEventListener('click', () => openPresets($('preset-panel').hidden));

// ---- KITS (SPEC 8.2): the imported kit files, kept in this browser; their sounds join the library ----
kits = setupKits({
  say, starterNames: STARTER.map((s) => s.name),
  closeOthers: () => { openMenu(false); openPresets(false); openSettings(false); },
  onChange: () => drawSide(),
  // hear a kit sound on the selected engine, at the selected key's output, without changing the key
  hear: async (s) => {
    await startAudio();
    const k = curKey(); engKey[S.sel] = -1;
    send({ type: 'play', engine: S.sel, vel: 100, back: false, sound: s.params, out: { ...k.out, trim: 0 } });
  },
  putOnKey: (s) => {
    const p = place(); if (keyLocked(p)) { lockedMsg(); return; }
    change(() => deal(p, s), `${keyName(p)}: <em>${s.name}</em> (${s.type}), ${s.from.kit} ${s.from.slot}${keptNote([engineOfKey(p)])} (UNDO takes it back)`).then(() => play(p, 100));
  },
  // the kit's sounds on the selected engine's keys from the bottom up, then again, altered, for the keys beyond them
  dealKit: (sounds, name) => {
    const ps = zoneKeys(S.sel);
    change(() => ps.forEach((p, i) => {
      if (S.keys[p].lock) return;
      deal(p, sounds[i % sounds.length]);
      if (i >= sounds.length) { alterOne(p, alterDepth()); S.keys[p].home = null; }
    }), `${engName(S.sel)}: the kit <em>${name}</em> on its ${ps.length} keys${ps.length > sounds.length ? `, altered ${S.rand.alter}% past the first ${sounds.length}` : ''}${keysKept(ps)}${keptNote([S.sel])} (UNDO takes it back)`);
  },
});
$('preset-input').addEventListener('change', () => renamePreset($('preset-input').value));
$('preset-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('preset-input').blur(); });
$('preset-roll').addEventListener('click', () => renamePreset(newName()));
$('preset-save').addEventListener('click', () => savePreset(false));
$('preset-save-new').addEventListener('click', () => savePreset(true));
$('preset-revert').addEventListener('click', () => loadPreset(S.preset.id, 'back to the saved'));
$('preset-export').addEventListener('click', exportPresets);
$('preset-import').addEventListener('click', () => $('preset-file').click());
$('preset-file').addEventListener('change', async () => { const f = $('preset-file').files[0]; if (f) importPresets(await f.text()); $('preset-file').value = ''; });
S.preset.name = S.preset.name || newName();
if (S.preset.id && !presetSaved()) S.preset.id = null;

// ---------------------------------------------------------------------------------------------------------------
// the dice (NEW SOUND) in the key's row of buttons, and on the phone
// ---------------------------------------------------------------------------------------------------------------
const diceBtn = document.createElement('button');
diceBtn.type = 'button'; diceBtn.className = 'dicebtn'; diceBtn.id = 'rand-key';
diceBtn.title = 'NEW SOUND (K): a different sound on this key only. UNDO takes it back; LEARN can put it on a button';
diceBtn.setAttribute('aria-label', 'New sound on this key');
diceBtn.innerHTML = `<span class="die">${DICE_SVG}</span>`;
diceBtn.dataset.learn = JSON.stringify({ t: 'randkey' });
$('pv-die').innerHTML = DICE_SVG;
$('keyacts').prepend(diceBtn);
rollDice = makeDice([diceBtn, $('pv-dice')]);
diceBtn.addEventListener('click', () => { if (!learn) randKey(); });

// ---------------------------------------------------------------------------------------------------------------
// PHONE: on a phone held upright (or ?phone) a pad for each of the 25 keys, NEW SOUND, ALTER and LOCK for the pad
// pressed last, its REVERB send, INIT PATCH, RANDOM ALL and UNDO. Its buttons press the big screen's own
// ---------------------------------------------------------------------------------------------------------------
const asked = new URLSearchParams(location.search);
const wantPhone = () => (asked.has('desktop') ? false : asked.has('phone') || ((Math.min(screen.width, screen.height) <= 700 || innerWidth <= 700) && innerHeight > innerWidth));
let phoneOn = false;
const pads = [];
function buildPads() {
  $('pv-pads').innerHTML = ''; pads.length = 0;
  for (let p = 0; p < KEYS; p++) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pad e' + engineOfKey(p);
    b.innerHTML = `<b></b><span>${engName(engineOfKey(p)).replace('ENGINE', 'ENG')}</span>${LOCK_SVG}`;
    let down = false;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
      down = true; b.classList.add('down');
      startAudio().then(() => { if (down) keyDown(p, 100); });
    });
    const up = () => { if (!down) return; down = false; keyUp(p); b.classList.remove('down'); };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    $('pv-pads').append(b); pads.push({ b, p });
  }
}
const sendBar = (() => {
  const el = $('pv-reverb'), track = el.querySelector('.track'), fill = track.querySelector('i'), out = el.querySelector('output');
  const at = (e) => { const r = track.getBoundingClientRect(); return clamp(Math.round((e.clientX - r.left - 4) / (r.width - 8) * 127), 0, 127); };
  const draw = () => { const v = curKey().out.send; fill.style.width = `${v / 127 * 100}%`; out.textContent = Math.round(v); track.setAttribute('aria-valuenow', v); };
  const put = (x) => { if (editValue('send', x)) { draw(); say(`${keyName(place())} REVERB send <em>${x}</em>`); } };
  let on = false;
  const end = () => { on = false; };
  track.addEventListener('pointerdown', (e) => { e.preventDefault(); try { track.setPointerCapture(e.pointerId); } catch (err) { /* gone */ } on = true; put(at(e)); });
  track.addEventListener('pointermove', (e) => { if (!on) return; if (!e.buttons && e.pointerType === 'mouse') { end(); return; } put(at(e)); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) track.addEventListener(ev, end);
  addEventListener('blur', end);
  return draw;
})();
for (const [id, to] of [['pv-alter', 'alter-key'], ['pv-lock', 'lock-key'], ['pv-init', 'init-patch'], ['pv-random', 'kit-scatter'], ['pv-undo', 'undo']]) $(id).addEventListener('click', () => $(to).click());
$('pv-dice').addEventListener('click', () => diceBtn.click());
function phoneMenu(open) {
  $('pv-menu').hidden = !open; $('pv-menu-btn').setAttribute('aria-expanded', open); $('pv-menu-btn').textContent = open ? 'CLOSE' : 'MENU';
  if (open) drawPhone();
}
$('pv-menu-btn').addEventListener('click', () => phoneMenu($('pv-menu').hidden));
for (const [id, fn] of [['pv-rand-eng', () => $('scatter').click()], ['pv-alter-eng', () => $('alter').click()], ['pv-alter-all', () => $('kit-alter').click()]])
  $(id).addEventListener('click', () => { phoneMenu(false); fn(); });
const mirror = (el, opts, fn) => { new MutationObserver(fn).observe(el, opts); fn(); };
mirror($('undo'), { attributes: true, attributeFilter: ['disabled'] }, () => { $('pv-undo').disabled = $('undo').disabled; });
mirror($('init-patch'), { attributes: true, attributeFilter: ['aria-pressed'] }, () => { const a = $('init-patch').getAttribute('aria-pressed') === 'true'; $('pv-init').setAttribute('aria-pressed', a); $('pv-init').textContent = a ? 'PRESS AGAIN' : 'INIT PATCH'; });
new MutationObserver(() => { $('pv-msg').innerHTML = $('detail').innerHTML; }).observe($('detail'), { childList: true, characterData: true, subtree: true });
function drawPhone() {
  if (!phoneOn) return;
  for (const { b, p } of pads) {
    b.firstChild.textContent = noteName(noteOf(p)); b.setAttribute('aria-label', keyName(p));
    b.classList.toggle('sel', engineOfKey(p) === S.sel && p === place()); b.classList.toggle('locked', S.keys[p].lock);
  }
  const z = Z()[S.sel], n = z.hi - z.lo + 1;
  $('pv-rand-eng').textContent = `RANDOM: ${engName(S.sel)}`; $('pv-rand-eng-cap').textContent = `A NEW SOUND ON EACH OF ITS ${n} KEYS`;
  $('pv-alter-eng').textContent = `ALTER: ${engName(S.sel)}`; $('pv-alter-eng-cap').textContent = `NUDGE THE SOUNDS OF ITS ${n} KEYS`;
  const k = curKey();
  $('pv-key').textContent = noteName(noteOf(place()));
  $('pv-what').textContent = `${engName(S.sel)} · ${k.lock ? 'locked · ' : ''}${k.sound.name} (${k.sound.type})`;
  $('pv-lock').setAttribute('aria-pressed', k.lock); $('pv-lock').textContent = k.lock ? 'LOCKED' : 'LOCK';
  $('pv-dice').disabled = k.lock; $('pv-alter').disabled = k.lock;
  $('pv-name').textContent = S.preset.name;
  sendBar();
}
function setPhone() {
  const on = wantPhone(); if (on === phoneOn) return;
  phoneOn = on; document.documentElement.classList.toggle('phone', on);
  drawPhone();
}

// ---------------------------------------------------------------------------------------------------------------
// fit the screen to small windows: below 1264 x 850 the whole screen is laid out at that size and scaled down, so
// every knob stays visible and nothing scrolls. The engine tabs sit right under their groups of keys
// ---------------------------------------------------------------------------------------------------------------
const FIT_W = 1264, FIT_H = 850;
function alignEngines() {
  const row = $('sounds'), sc = $('screen'), k = sc.getBoundingClientRect().width / sc.offsetWidth || 1;
  const base = row.getBoundingClientRect().left;
  const placeBtn = (b, el) => { const r = el.getBoundingClientRect(); Object.assign(b.style, { left: `${(r.left - base) / k}px`, width: `${r.width / k}px` }); b.classList.toggle('narrow', r.width / k < 150); };
  document.querySelectorAll('#keystrip .kgroup').forEach((g, i) => placeBtn(engBtns[i], g));
  const tag = row.querySelector('.tag'); tag.style.left = `${parseFloat(engBtns[0].style.left) - tag.offsetWidth - 12}px`;
}
function fitScreen() {
  const sc = $('screen'), vw = innerWidth - 16, vh = innerHeight - 16, s = Math.min(1, vw / FIT_W, vh / FIT_H);
  setPhone();
  if (phoneOn) { sc.removeAttribute('style'); return; }
  if (s < 1) Object.assign(sc.style, { width: `${vw / s}px`, height: `${vh / s}px`, maxWidth: 'none', margin: '0', transform: `scale(${s})`, transformOrigin: '0 0' });
  else sc.removeAttribute('style');
  alignEngines();
}

// ---------------------------------------------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------------------------------------------
$('start-btn').addEventListener('click', async () => {
  $('start').hidden = true;
  await startAudio();
  // on a phone the pads are the keys: it isn't asked for MIDI there (a keyboard still plays if MIDI was allowed before)
  if (!phoneOn) startMidi();
  else if (navigator.permissions) navigator.permissions.query({ name: 'midi' }).then((s) => { if (s.state === 'granted') startMidi(); }).catch(() => {});
});
buildStrip(); buildPads(); buildFaders(); buildFx(); drawZones(); drawRet(); drawBpm(); drawUndo(); drawPreset();
select(clamp(S.sel, 0, S.engines - 1));
$('start-text').textContent = `MIDI channel 1, keys ${noteName(S.low)} to ${noteName(S.low + KEYS - 1)} on ${S.engines === 1 ? 'one engine' : S.engines + ' engines'}. Every key has its own sound: play one and the screen shows it, ready to edit.`;
if (asked.has('nostart')) $('start').hidden = true; // (screenshots)
addEventListener('resize', fitScreen);
fitScreen();
document.fonts?.ready.then(alignEngines);

// for testing without a controller, from the console or Playwright
window.app = {
  noteOn: (ch, note, vel = 100) => noteOn(ch, note, vel), noteOff, cc: onCC, state: () => S, keys: () => S.keys, place,
  presets: { list: () => presets, now: () => S.preset, dirty: presetDirty, import: importPresets, name: newName },
  undoDepth: () => undoStack.length, library, engineOf: engineOfKey,
  kits: { list: () => kits.kits(), ready: () => kits.ready },
};
window.appReady = true; // index.html's load check

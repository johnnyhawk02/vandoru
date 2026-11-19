// The patch's data: the 25 keys and how the engines split them, sounds, and the tidying every stored or imported
// patch goes through (names, labels, ranges and sizes: messages are shown as HTML). SPEC section 10. No UI here.
import { tidyParams, PARAM_IDS, PARAM, OUT_DEFAULTS } from '../sound/params.js?v=mwmt154h';
import { fxDefaults, MAX_ENGINES } from '../sound/instrument.js?v=mwmt154h';

export const KEYS = 25;
export const DEFAULT_ENGINES = 3;
export const DEFAULT_LOW = 48; // a Bass Station 2 at its default octave
/** the sound types (SPEC 8.1), matching the MAKE THIS KEY buttons */
export const TYPES = ['kick', 'tom', 'perc', 'zap', 'snare', 'clap', 'rim', 'bell', 'closed hat', 'open hat', 'cymbal', 'other'];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** the keys of each engine: n even zones side by side, the extra keys on the top one (3 = 8 + 8 + 9) */
export function zoneSizes(n) { const b = Math.floor(KEYS / n); return Array.from({ length: n }, (_, i) => (i < n - 1 ? b : KEYS - b * (n - 1))); }
export function zones(n) { let lo = 0; return zoneSizes(n).map((s) => { const z = { lo, hi: lo + s - 1 }; lo += s; return z; }); }
export const engineOf = (place, n) => zones(n).findIndex((z) => place >= z.lo && place <= z.hi);

export const cleanName = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9 .+#-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);
export const cleanLabel = (s) => String(s ?? '').replace(/[<>&"'\u0000-\u001f]/g, '').slice(0, 48);
const num = (x, lo, hi, d) => { const v = Number(x); return Number.isFinite(v) ? clamp(v, lo, hi) : d; };

/** a sound: { v, name, type, kind, from, params, level? } */
export function tidySound(s) {
  if (!s || typeof s !== 'object') return null;
  const params = tidyParams(s.params);
  const from = s.from === 'starter' || s.from === 'made' ? s.from
    : s.from && typeof s.from === 'object' ? { kit: cleanLabel(s.from.kit).slice(0, 12), slot: cleanLabel(s.from.slot).slice(0, 12) } : 'made';
  const o = { v: 1, name: cleanName(s.name) || 'UNNAMED', type: TYPES.includes(s.type) ? s.type : 'other', kind: params.kind, from, params };
  // a kit sound's own LEVEL: the key takes it when the sound goes on (in metal and snare it sets how hard the drive is hit)
  if (s.level != null && Number.isFinite(Number(s.level))) o.level = clamp(Number(s.level), 0, 127);
  return o;
}
export const copySound = (s) => structuredClone(s);

/** a key: its sound, its hand edits (what each edited control was), its home (ALTER's centre), lock and output */
export function newKey(sound) { return { sound: copySound(sound), edits: {}, home: null, lock: false, out: { ...OUT_DEFAULTS } }; }
export function tidyKey(k) {
  const sound = tidySound(k && k.sound);
  if (!sound) return null;
  const key = newKey(sound);
  if (k.edits && typeof k.edits === 'object') for (const id in k.edits) if (PARAM[id]) key.edits[id] = tidyParams({ [id]: k.edits[id] })[id];
  if (k.home && typeof k.home === 'object') key.home = tidyParams(k.home);
  key.lock = !!k.lock;
  const o = k.out || {};
  key.out = { level: num(o.level, 0, 127, 100), pan: num(o.pan, 0, 127, 64), send: num(o.send, 0, 127, 0), trim: num(o.trim, -16, 12, 0) };
  return key;
}

/** the effects and the master, checked against their defaults' shape */
export function tidyFx(fx) {
  const d = fxDefaults();
  if (!fx || typeof fx !== 'object') return d;
  for (const sec of ['reverb', 'dirt', 'comp']) if (fx[sec]) for (const k in d[sec]) d[sec][k] = num(fx[sec][k], 0, 1000, d[sec][k]);
  if (fx.out) {
    d.out.level = num(fx.out.level, 0, 100, d.out.level);
    if (Array.isArray(fx.out.eng)) d.out.eng = d.out.eng.map((v, i) => num(fx.out.eng[i], 0, 127, v));
  }
  return d;
}

/** a patch: { v, name, engines, keys: [25, by place], fx, bpm }; base: what an unreadable key becomes */
export function tidyPatch(p, base) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.keys)) return null;
  const keys = Array.from({ length: KEYS }, (_, i) => tidyKey(p.keys[i]) || base(i));
  return { v: 1, name: cleanName(p.name) || 'UNNAMED', engines: clamp(Math.round(Number(p.engines)) || DEFAULT_ENGINES, 1, MAX_ENGINES), keys, fx: tidyFx(p.fx), bpm: clamp(Math.round(Number(p.bpm)) || 120, 40, 240) };
}

/** the same data, whatever order its parts were written in (the preset's changed mark) */
export const canon = (x) => (Array.isArray(x) ? '[' + x.map(canon).join() + ']' : x && typeof x === 'object' ? '{' + Object.keys(x).sort().map((k) => k + ':' + canon(x[k])).join() + '}' : JSON.stringify(x));

export { PARAM_IDS };

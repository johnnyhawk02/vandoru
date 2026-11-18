// The sound's parameters (SPEC 5.19): ids, labels, sections, ranges, defaults and how each shows its value. Every
// engine has every one of them. Values are the kit's units, 0..127 (a dial or a morph may hold a fraction); switches
// are true/false, the two modulation targets a parameter id or null, KIND 'drum', 'snare' or 'metal'.
import { noteHz, fineFactor, attackS, decayS, pDecayS, cutoffHz, noiseHz, crushHz, clickRate, lfoHz, pAmountDepth,
  SYNC_NAMES } from '../engine/curves.js?v=mwmdihvu';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** a note number as a name (C3 = 60) */
export const noteName = (n) => { n = Math.round(n); return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 2); };

const time = (s) => (!Number.isFinite(s) ? 'never' : s < 1 ? Math.round(s * 1000) + 'ms' : s < 10 ? s.toFixed(2) + 's' : s.toFixed(1) + 's');
const hz = (f) => (f < 10 ? f.toFixed(2) + 'Hz' : f < 1000 ? Math.round(f) + 'Hz' : (f / 1000).toFixed(f < 9950 ? 1 : 0) + 'k');

/** the dials (SPEC 6): a setting's name at its position; between two, both names and how far along */
export const WAVES = [['sine', 0], ['tri', 25], ['saw', 50], ['square', 75], ['pwm', 100], ['noise', 125]];
export const TYPES = [['LP', 0], ['BP', 18], ['UBP', 36], ['HP', 54], ['NOTCH', 72], ['PEAK', 90], ['LP2', 108], ['OFF', 126]];
export const MODES = [['FM', 0], ['MIX', 127]];
export function dialAt(stops, v) {
  if (v >= stops[stops.length - 1][1]) return { a: stops.length - 1, b: stops.length - 1, t: 0 };
  for (let i = 0; i < stops.length - 1; i++) {
    const p0 = stops[i][1], p1 = stops[i + 1][1];
    if (v < p1) return { a: i, b: i + 1, t: Math.max(0, (v - p0) / (p1 - p0)) };
  }
  return { a: 0, b: 0, t: 0 };
}
export const dialText = (stops, v) => {
  const { a, b, t } = dialAt(stops, v);
  return t < 1e-9 ? stops[a][0] : `${stops[a][0]}>${stops[b][0]} ${Math.round(t * 100)}`;
};

export const CLICKS = ['SNAP', 'PHASE', 'PULSE', 'SPIKE', 'WOOD', 'THUD', 'KNOCK', 'PING', 'HISS', 'RATTLE', 'SUB', 'CRACK', 'GRIT', 'TICK'];
export const LFO_WAVES = ['SINE', 'TRI', 'UP', 'DOWN', 'SQUARE', 'RANDOM', 'EXP UP', 'EXP DN'];
export const KINDS = ['drum', 'snare', 'metal'];

// ui: knob (0..max), pm (plus-minus, centre), dial (stops), steps (a knob of whole steps with names), menu (a list,
// two cells), switch (on/off, one cell), target (a parameter id or none, two cells), hidden
const P = (id, label, section, def, ui = 'knob', extra = {}) => ({ id, label, section, def, ui, max: 127, ...extra });
export const PARAMS = [
  P('tune', 'TUNE', 'osc', 60, 'knob', { show: (v) => noteName(v), step: 1 }),
  P('fine', 'FINE', 'osc', 64, 'pm', { centre: 64, show: (v) => { const c = 1200 * Math.log2(fineFactor(v)); return (c >= 0.5 ? '+' : '') + Math.round(c) + 'c'; } }),
  P('wave', 'WAVE', 'osc', 0, 'dial', { stops: WAVES }),
  P('pwm', 'PWM', 'osc', 0),
  P('aFreq', 'A FREQ', 'mod a', 60, 'knob', { show: (v) => noteName(v), step: 1 }),
  P('aAmount', 'A AMOUNT', 'mod a', 0),
  P('aWave', 'A WAVE', 'mod a', 0, 'dial', { stops: WAVES }),
  P('aMode', 'A MODE', 'mod a', 0, 'dial', { stops: MODES }),
  P('fmEnv', 'FM ENV', 'mod a', 127),
  P('bFreq', 'B FREQ', 'mod b', 60, 'knob', { show: (v) => noteName(v), step: 1 }),
  P('bAmount', 'B AMOUNT', 'mod b', 0),
  P('bWave', 'B WAVE', 'mod b', 0, 'dial', { stops: WAVES }),
  P('noiseRate', 'NOISE RATE', 'noise', 127, 'knob', { show: (v) => hz(noiseHz(v)) }),
  P('noise', 'NOISE', 'noise', 0),
  P('attack', 'ATTACK', 'amp', 0, 'knob', { show: (v) => time(attackS(v)), step: 1 }),
  P('decay', 'DECAY', 'amp', 40, 'knob', { show: (v) => time(decayS(v)), step: 1 }),
  P('repeat', 'REPEAT', 'amp', 0, 'knob', { max: 15, step: 1 }),
  P('ampCurve', 'CURVE', 'amp', 64, 'pm', { centre: 64, step: 1 }),
  P('pDecay', 'P DECAY', 'pitch', 20, 'knob', { show: (v) => time(pDecayS(v)), step: 1 }),
  P('pCurve', 'P CURVE', 'pitch', 0, 'knob', { step: 1 }),
  P('pAmount', 'P AMOUNT', 'pitch', 0, 'knob', { show: (v) => '+' + (12 * Math.log2(1 + pAmountDepth(v))).toFixed(v ? 1 : 0) + 'st', step: 1 }),
  P('click', 'CLICK', 'click', 0, 'menu', { names: CLICKS, max: 13 }),
  P('clickVol', 'CLICK VOL', 'click', 0),
  P('clickRate', 'CLICK RATE', 'click', 25, 'knob', { show: (v) => clickRate(v).toFixed(2) + 'x', step: 1 }),
  P('toneIn', 'TONE IN', 'filter in', true, 'switch'),
  P('noiseIn', 'NOISE IN', 'filter in', true, 'switch'),
  P('clickIn', 'CLICK IN', 'filter in', true, 'switch'),
  P('cutoff', 'CUTOFF', 'filter', 127, 'knob', { show: (v) => hz(cutoffHz(v)) }),
  P('reso', 'RESO', 'filter', 0),
  P('type', 'TYPE', 'filter', 0, 'dial', { stops: TYPES }),
  P('fltDrive', 'FLT DRIVE', 'filter', 0),
  P('velDest', 'VEL DEST', 'velocity', null, 'target'),
  P('velAmount', 'VEL AMT', 'velocity', 0),
  P('velVol', 'VEL VOL', 'velocity', true, 'switch'),
  P('lfoRate', 'LFO RATE', 'lfo', 64, 'knob', { show: (v, s) => (s && s.lfoSync ? SYNC_NAMES[Math.round(s.lfoSync)] : hz(lfoHz(v))) }),
  P('lfoSync', 'LFO SYNC', 'lfo', 0, 'steps', { max: 11, names: SYNC_NAMES }),
  P('lfoAmount', 'LFO AMT', 'lfo', 0),
  P('lfoWave', 'LFO WAVE', 'lfo', 0, 'steps', { max: 7, names: LFO_WAVES }),
  P('retrig', 'RETRIG', 'lfo', false, 'switch'),
  P('phase', 'PHASE', 'lfo', 0),
  P('lfoDest', 'LFO DEST', 'lfo', null, 'target'),
  P('crush', 'CRUSH', 'mix', 127, 'knob', { show: (v) => (v >= 127 ? 'OFF' : hz(crushHz(v))) }),
  P('drive', 'DRIVE', 'mix', 0),
  P('kind', 'KIND', 'hidden', 'drum', 'hidden'),
];
export const PARAM = Object.fromEntries(PARAMS.map((p) => [p.id, p]));
export const PARAM_IDS = PARAMS.map((p) => p.id);

/** the key's output: not part of the sound for the randomisers (SPEC 5.19). Trim is in dB */
export const OUT_PARAMS = [
  { id: 'send', label: 'REVERB', def: 0, max: 127, ui: 'knob' },
  { id: 'pan', label: 'PAN', def: 64, max: 127, ui: 'pm', centre: 64, show: (v) => (Math.abs(v - 64) < 0.5 ? 'C' : (v < 64 ? 'L' : 'R') + Math.round(Math.abs(v - 64) / (v < 64 ? 64 : 63) * 100)) },
  { id: 'level', label: 'LEVEL', def: 100, max: 127, ui: 'knob' },
];
export const OUT_DEFAULTS = { level: 100, pan: 64, send: 0, trim: 0 };

/** the screen's grid (SPEC 5.19): four rows of sections on 14 columns; REVERB, PAN and the big LEVEL to the right */
export const GRID_ROWS = [['osc', 'mod a', 'mod b', 'noise'], ['amp', 'pitch', 'click', 'filter in'], ['filter', 'velocity', 'mix'], ['lfo']];
export const GRID_COLS = 14;
export const cells = (p) => (p.ui === 'menu' || p.ui === 'target' ? 2 : 1);

/** what a modulation route may aim at: the sound's own parameters, less the routing, the targets themselves and
 *  RETRIG (SPEC 5.15), plus the key's LEVEL and PAN */
export const TARGETS = [...PARAMS.filter((p) => !['target', 'switch', 'hidden'].includes(p.ui)).map((p) => p.id), 'velVol', 'level', 'pan'];
export const targetLabel = (id) => (id == null ? 'none' : PARAM[id] ? PARAM[id].label : id === 'level' ? 'LEVEL' : id === 'pan' ? 'PAN' : 'none');

/** a parameter's value as the screen shows it (s: the whole sound, for values that depend on another) */
export function showValue(p, v, s) {
  if (p.ui === 'switch') return v ? 'ON' : 'OFF';
  if (p.ui === 'target') return targetLabel(v);
  if (p.ui === 'dial') return dialText(p.stops, v);
  if (p.ui === 'menu' || p.ui === 'steps') return p.names[Math.round(v)] ?? String(v);
  if (p.show) return p.show(v, s);
  return String(Math.round(v));
}

/** every parameter at its default (SPEC 4.6) */
export const defaultParams = () => Object.fromEntries(PARAMS.map((p) => [p.id, p.def]));

/** a sound's parameters, checked and tidied: unknown ids dropped, missing ones at their default, every value in range */
export function tidyParams(src) {
  const o = defaultParams();
  if (!src || typeof src !== 'object') return o;
  for (const p of PARAMS) {
    if (!(p.id in src)) continue;
    const v = src[p.id];
    if (p.ui === 'switch') o[p.id] = !!v;
    else if (p.ui === 'target') o[p.id] = TARGETS.includes(v) ? v : null;
    else if (p.ui === 'hidden') o[p.id] = KINDS.includes(v) ? v : p.def;
    else { const x = Number(v); if (Number.isFinite(x)) o[p.id] = Math.min(p.max, Math.max(0, x)); }
  }
  return o;
}

/** the sound's starting pitch in Hz, for the screen */
export const toneHz = (s) => noteHz(Math.round(s.tune)) * fineFactor(s.fine);

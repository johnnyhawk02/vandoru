// Modulation (SPEC 5.15 and 6.4): the LFO and the velocity route, each aimed at one of the sound's own parameters (or
// the key's LEVEL or PAN). Each control tick a target's effective value is worked out from its knob and the modulator;
// the parameter then behaves as if its knob were there. The knob itself never moves.
import { lfoHz, syncHz, TICK_S } from './curves.js?v=mwmhdy23';

// parameters that move in whole knob values (5.15); everything else moves continuously
const STEPPED = new Set(['tune', 'aFreq', 'bFreq', 'fine', 'attack', 'decay', 'pDecay', 'pAmount', 'ampCurve', 'pCurve', 'repeat',
  'clickRate', 'pan', 'lfoSync', 'velVol']);
// the choices: dial position -> kit number, kit number -> dial position, and how many there are
const WAVE_KIT = { 0: 0, 25: 1, 50: 2, 75: 3, 125: 4, 100: 5 }, WAVE_POS = [0, 25, 50, 75, 125, 100];
const TYPE_KIT = { 0: 0, 54: 1, 18: 2, 36: 3, 72: 4, 90: 5, 108: 6, 126: 7 }, TYPE_POS = [0, 54, 18, 36, 72, 90, 108, 126];
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** a value moved by a modulator: v the knob (0..127), amount 0..1, m the modulator's output 0..1 */
export function moved(id, v, amount, m) {
  const d = amount * (2 * m - 1);
  if (id === 'wave' || id === 'aWave' || id === 'bWave') {
    const pos = v >= 125 ? 125 : v;
    if (!(pos in WAVE_KIT)) return 127 * clamp01(v / 127 + d); // between two settings: along the dial (6.4)
    const c = Math.min(5, Math.floor(6 * clamp01(WAVE_KIT[pos] / 127 + d)));
    return WAVE_POS[c];
  }
  if (id === 'type') {
    const pos = v >= 126 ? 126 : v;
    if (!(pos in TYPE_KIT)) return 127 * clamp01(v / 127 + d);
    const c = Math.min(6, Math.floor(7 * clamp01(TYPE_KIT[pos] / 127 + d) + 1) - 1);
    return TYPE_POS[Math.max(0, c)];
  }
  if (id === 'click' || id === 'lfoWave') {
    const n = id === 'click' ? 14 : 8;
    return Math.min(n - 1, Math.floor(n * clamp01(Math.round(v) / 127 + d)));
  }
  if (id === 'velVol') return Math.floor(127 * clamp01((v ? 1 : 0) / 127 + d)) >= 1;
  const x = clamp01(v / 127 + d);
  return STEPPED.has(id) ? Math.floor(127 * x) : 127 * x;
}

/** the LFO's output (0..1) at phase p for each wave (5.15); held: the random wave's value this cycle */
export function lfoWave(w, p, held) {
  switch (w) {
    case 0: return (1 - Math.cos(2 * Math.PI * p)) / 2;
    case 1: return 1 - Math.abs(2 * p - 1);
    case 2: return p;
    case 3: return 1 - p;
    case 4: return p < 0.5 ? 0 : 1;
    case 5: return held;
    case 6: return p * p * p;
    default: return (1 - p) * (1 - p) * (1 - p);
  }
}

/** the LFO's phase step per control tick */
export function lfoStep(rate, sync, bpm) {
  const s = Math.round(sync);
  return (s > 0 ? syncHz(Math.min(11, s), bpm) : lfoHz(rate)) * TICK_S;
}

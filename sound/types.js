// A kit sound's type (SPEC 8.3) from its slot and its numbers. A pure function: no DOM, no storage.
import { noteHz, fineFactor, pAmountDepth, riseStep, decayS, pCurveShape, shape, TICK_S } from '../engine/curves.js?v=mwmdihvu';

/** a first guess at a kit sound's type from its slot and its numbers (SPEC 8.3). The measured version (a render at
 *  velocity 100: the pitch at 30 ms, the length, the noisiness) comes with auto level in step 10 */
export function guessType(slot, s) {
  const f0 = noteHz(Math.round(s.tune)) * fineFactor(s.fine), len = decayS(s.decay) + s.repeat * 0.02;
  if (slot === 'snare') return s.repeat > 0 ? 'clap' : len < 0.08 ? 'rim' : 'snare';
  if (slot === 'metal' || slot.startsWith('hat')) {
    if (s.noise < 20 && s.bAmount < 40 && s.aAmount < 60 && len > 0.3) return 'bell';
    return len < 0.15 ? 'closed hat' : len > 0.8 ? 'cymbal' : 'open hat';
  }
  if (s.pAmount > 64 && s.pDecay < 20) return 'zap';
  // the pitch at 30 ms: the pitch envelope's level then
  const step = riseStep(s.pDecay), u = Math.max(0, 1 - step * Math.floor(0.03 / TICK_S)), at30 = f0 * (1 + pAmountDepth(s.pAmount) * shape(u, pCurveShape(s.pCurve)));
  if (at30 < 90 && len > 0.15) return 'kick';
  if (at30 >= 90 && at30 <= 400 && s.wave <= 25 && s.aAmount < 70) return 'tom';
  if (len < 0.06 && s.cutoff > 90) return 'rim';
  return 'perc';
}


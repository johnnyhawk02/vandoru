// Offline renders (SPEC 5): one sound, alone, from its note's start, as a mono Float32Array. Used by the compare test,
// and (in a Worker) by auto level, the dud filter and previews. Always the same output for the same input.
import { Voice } from './voice.js?v=mwmeshlj';

/** sound: the parameters (SPEC 5.19); level: LEVEL 0..127; vel 1..127; seconds: how long */
export function renderSound(sound, { vel = 100, level = 127, fs = 44140, seconds = 2, note = 60 } = {}) {
  const v = new Voice(fs), n = Math.round(seconds * fs), out = new Float32Array(n);
  v.trigger(sound, vel, level, note);
  for (let i = 0; i < n; i += 128) {
    const m = Math.min(128, n - i), sub = out.subarray(i, i + m);
    if (!v.active) break;
    v.render(sub, m);
  }
  return out;
}

// The twelve generated clicks (SPEC 5.7, CLICK 2 to 13): one-shot sounds of about 50 ms at rate 1, made by maths at
// start-up from the descriptions in the spec, never from recorded audio. Each is a sum of parts (a short pulse, tones
// that may slide, band-limited noise), each part shaped by an envelope of [ms, dB] points, then the whole scaled so
// its peak sits at 0.9 of full scale. Tuned by ear and against the reference pack's measurements of the originals.
import { Rand } from './rand.js?v=mwmt154h';

export const CLICK_FS = 44140;
export const CLICK_MS = 50;
const N = Math.round(CLICK_FS * CLICK_MS / 1000);

// pulse: a one-sided exponential of time constant tau (ms); tone: a sine sliding from f0 to f1 (Hz), its level
// moved by a wobble (rate Hz, depth 0..1); noise: white noise through a band-pass (centre Hz, q) or a high-pass (hp Hz).
// Each also has a short onset pulse and a quiet broad noise floor, as the originals do. The numbers were set by hand
// from the spec's descriptions, then nudged by a search that compared each click's 2 ms envelope and 1/3-octave bands
// with the measurements in the reference pack (SPEC 5.7)
export const RECIPES = {
  2: [ // PULSE: one short pulse, a thump of air, a faint low hum after
    { pulse: 0.58, env: [[0, -3], [50, -3]] },
    { tone: 174.06, env: [[0, -2], [2, -14], [4, -49], [50, -70]] },
    { tone: 40, env: [[0, -47], [3, -51], [48, -47], [50, -81]] },
    { pulse: 0.17, env: [[0, -11], [50, -11]] },
    { noise: 2664.56, q: 0.22, env: [[0, -37], [20, -36], [50, -39]] }],
  3: [ // SPIKE: a single sharp spike, then a quiet, uneven, very low tail
    { pulse: 0.18, env: [[0, -8], [50, -5]] },
    { tone: 20.43, f1: 31.86, wobble: [55, 0.6], env: [[0, -29], [4, -23], [20, -25], [40, -29], [44, -33], [50, -34]] },
    { pulse: 0.21, env: [[0, -14], [50, -13]] },
    { noise: 1722.29, q: 0.29, env: [[0, -46], [20, -51], [50, -50]] }],
  4: [ // WOOD: a short tonal knock near 440 Hz
    { tone: 492.8, f1: 455.23, env: [[0, -22], [2, -5], [4, -9], [10, -12], [20, -22], [50, -25]] },
    { noise: 268.92, q: 1.31, env: [[0, -12], [3, -8], [10, -11], [50, -30]] },
    { pulse: 0.14, env: [[0, -14], [50, -12]] },
    { noise: 2232.14, q: 0.26, env: [[0, -40], [20, -47], [50, -62]] }],
  5: [ // THUD: a low tone sliding from about 80 to 40 Hz that holds, unevenly, then drops
    { tone: 89.6, f1: 36.16, wobble: [90, 0.35], env: [[0, -9], [34, -10], [40, -29], [50, -33]] },
    { pulse: 0.17, env: [[0, -13], [50, -11]] },
    { noise: 2280.08, q: 0.28, env: [[0, -24], [20, -28], [50, -39]] }],
  6: [ // KNOCK: a knock with body, broad, a resonance near 220 Hz
    { tone: 237.72, env: [[0, -5], [4, 0], [8, -3], [16, -10], [32, -32], [45, -44], [50, -75]] },
    { noise: 636.93, q: 0.63, env: [[0, 3], [4, -4], [8, -7], [16, -18], [32, -39], [45, -65], [50, -84]] },
    { pulse: 0.14, env: [[0, -15], [50, -15]] },
    { noise: 2232.14, q: 0.25, env: [[0, -31], [20, -43], [50, -52]] }],
  7: [ // PING: a clear mid ping rising slightly
    { tone: 419.64, f1: 538.91, env: [[0, -4], [8, -8], [16, -12], [24, -15], [32, -22], [48, -23], [50, -48]] },
    { pulse: 0.13, env: [[0, -12], [50, -12]] },
    { noise: 2232.14, q: 0.27, env: [[0, -31], [20, -31], [50, -47]] }],
  8: [ // HISS: a burst of bright noise that swells to its peak at 8 ms
    { hp: 7553.82, env: [[0, -13], [8, -6], [24, -12], [40, -20], [48, -35], [50, -47]] },
    { pulse: 0.17, env: [[0, -6], [50, -10]] },
    { noise: 1833.83, q: 0.23, env: [[0, -17], [20, -17], [50, -30]] }],
  9: [ // RATTLE: band noise round 2 to 3 kHz that swells and fades twice
    { noise: 2010.52, q: 0.96, wobble: [65, 0.5], env: [[0, -6], [8, -11], [18, -11], [30, -6], [40, -3], [48, -10], [50, -44]] },
    { pulse: 0.12, env: [[0, -12], [50, -15]] },
    { noise: 2094.29, q: 0.28, env: [[0, -25], [20, -24], [50, -40]] }],
  10: [ // SUB: a very low double thump
    { tone: 40.32, f1: 33.6, env: [[0, 7], [8, -19], [16, -1], [24, -14], [32, -9], [42, -14], [48, -36], [50, -52]] },
    { pulse: 0.2, env: [[0, -6], [50, -8]] },
    { noise: 2571.84, q: 0.25, env: [[0, -36], [20, -38], [50, -46]] }],
  11: [ // CRACK: a body tone near 200 Hz with noise on it up to 8 kHz
    { tone: 243.87, env: [[0, -8], [24, -10], [32, -19], [48, -19], [50, -43]] },
    { noise: 1230.15, q: 0.37, env: [[0, -2], [24, -8], [32, -11], [48, -17], [50, -38]] },
    { pulse: 0.14, env: [[0, -18], [50, -15]] },
    { noise: 2345.6, q: 0.25, env: [[0, -28], [20, -34], [50, -46]] }],
  12: [ // GRIT: a low knock with grit, held
    { tone: 82, wobble: [40, 0.4], env: [[0, -7], [40, -4], [43, -15], [50, -9]] },
    { noise: 707.7, q: 0.46, wobble: [70, 0.5], env: [[0, -1], [40, -3], [43, -4], [50, -8]] },
    { pulse: 0.13, env: [[0, -16], [50, -16]] },
    { noise: 2500, q: 0.25, env: [[0, -34], [20, -38], [50, -50]] }],
  13: [ // TICK: a sharp tick and a thin buzz after it
    { noise: 3658.08, q: 1.34, env: [[0, 3], [2, -7], [4, -15], [50, -29]] },
    { tone: 2040.75, wobble: [120, 0.6], env: [[0, -21], [2, -27], [4, -25], [50, -32]] },
    { pulse: 0.16, env: [[0, -11], [50, -13]] },
    { noise: 2500, q: 0.28, env: [[0, -28], [20, -37], [50, -54]] }],
};

const dbAt = (env, ms) => {
  if (ms <= env[0][0]) return env[0][1];
  for (let i = 1; i < env.length; i++) if (ms <= env[i][0]) { const [t0, d0] = env[i - 1], [t1, d1] = env[i]; return d0 + (d1 - d0) * (ms - t0) / (t1 - t0); }
  return env[env.length - 1][1];
};
// an RBJ biquad, band-pass (constant peak) or high-pass
function biquad(kind, f, q) {
  const w = 2 * Math.PI * f / CLICK_FS, c = Math.cos(w), a = Math.sin(w) / (2 * q);
  const b = kind === 'bp' ? [a, 0, -a] : [(1 + c) / 2, -(1 + c), (1 + c) / 2], a0 = 1 + a;
  return { b0: b[0] / a0, b1: b[1] / a0, b2: b[2] / a0, a1: -2 * c / a0, a2: (1 - a) / a0 };
}

/** one click as samples at CLICK_FS, peak 0.9 */
export function makeClick(n) {
  const out = new Float32Array(N), r = new Rand(0x51ed270b + n * 7919);
  for (const p of RECIPES[n]) {
    let ph = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const f = p.noise ? biquad('bp', p.noise, p.q || 1) : p.hp ? biquad('hp', p.hp, 0.7) : null;
    let norm = 1;
    if (f) { // the band's level: scale the filtered noise to about unit RMS
      let s = 0, a1 = 0, a2 = 0, b1 = 0, b2 = 0; const t = new Rand(1);
      for (let i = 0; i < 4096; i++) { const x = t.next(); const y = f.b0 * x + f.b1 * a1 + f.b2 * a2 - f.a1 * b1 - f.a2 * b2; a2 = a1; a1 = x; b2 = b1; b1 = y; s += y * y; }
      norm = 1 / Math.sqrt(s / 4096);
    }
    for (let i = 0; i < N; i++) {
      const ms = i * 1000 / CLICK_FS, u = i / N;
      let g = Math.pow(10, dbAt(p.env, ms) / 20);
      if (p.wobble) g *= 1 - p.wobble[1] * (0.5 - 0.5 * Math.cos(2 * Math.PI * p.wobble[0] * ms / 1000));
      let x;
      if (p.pulse) x = Math.exp(-ms / p.pulse);
      else if (p.tone) { const fr = p.tone + ((p.f1 ?? p.tone) - p.tone) * u; x = Math.sin(2 * Math.PI * ph); ph += fr / CLICK_FS; }
      else { const w = r.next(); x = (f.b0 * w + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2); x2 = x1; x1 = w; y2 = y1; y1 = x; x *= norm / 3; }
      out[i] += x * g;
    }
  }
  let pk = 0;
  for (const v of out) pk = Math.max(pk, Math.abs(v));
  for (let i = 0; i < N; i++) out[i] *= 0.9 / pk;
  return out;
}

/** every click, made once */
export const CLICKS = Object.fromEntries(Object.keys(RECIPES).map((n) => [n, makeClick(+n)]));

// node test/dirt.test.mjs: the master distortion (sound/dirt.js) offline. Sane levels at every corner of its knobs,
// a clean bypass, the crossover splitting the band, the sidechain's envelope following its key, and the whole
// instrument rendering a kit through it.
import { Dirt, DIRT_DEFAULTS } from '../sound/dirt.js';
import { Instrument } from '../sound/instrument.js';
import { readFileSync } from 'node:fs';
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const fs = 44100, N = fs; // a second
const sine = (hz, a = 0.5, n = N) => Float32Array.from({ length: n }, (_, i) => a * Math.sin(2 * Math.PI * hz * i / fs));
const noise = (a = 0.5, n = N) => { let s = 1; return Float32Array.from({ length: n }, () => ((s = (s * 16807) % 2147483647) / 2147483647 * 2 - 1) * a); };
const rms = (x, from = 0) => { let t = 0; for (let i = from; i < x.length; i++) t += x[i] * x[i]; return Math.sqrt(t / (x.length - from)); };
const peak = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const run = (set, L, R = L.slice(), key = null, block = 64) => {
  const d = new Dirt(fs); d.set(set); d.wet = set.on ? 1 : 0;
  for (const n in d.cur) d.cur[n] = d.p[n];
  for (let i = 0; i < L.length; i += block) d.process(L.subarray(i, i + block), R.subarray(i, i + block), key && key.subarray(i, i + block));
  return { L, R, d };
};
// off: the master passes through untouched
{ const x = noise(), { L } = run({ on: 0 }, x.slice()); ok(L.every((v, i) => v === x[i]), 'bypass changes the signal'); }
// every corner of the knobs: finite, bounded, no DC
for (const bass of [0, 24]) for (const clip of [0, 1]) for (const gain of [0, 127]) for (const pregain of [0, 48]) for (const cutoff of [0, 127]) for (const swap of [0, 1])
  for (const tone of [0, 64, 127]) for (const xover of [0, 1]) {
    const set = { ...DIRT_DEFAULTS, on: 1, clip, gain, pregain, cutoff, swap, tone, xover, bass, dirty: 106, clean: 106 };
    const { L } = run(set, noise(0.9, fs / 4));
    const fin = L.every(Number.isFinite), pk = peak(L);
    ok(fin && pk < 8, `bass ${bass} clip ${clip} gain ${gain} pregain ${pregain} cutoff ${cutoff} swap ${swap} tone ${tone} xover ${xover}: peak ${pk}`);
  }
{ const { L } = run({ ...DIRT_DEFAULTS, on: 1, gain: 127 }, sine(80, 0.8)); const m = L.slice(fs / 2).reduce((a, v) => a + v, 0) / (fs / 2); ok(Math.abs(m) < 0.01, 'DC left after clipping: ' + m); }
// diode clips harder than LED: more of the signal is squashed at the same drive (crest factor lower)
{ const a = run({ ...DIRT_DEFAULTS, on: 1, clip: 0, gain: 90, tone: 64 }, sine(110, 0.5)).L, b = run({ ...DIRT_DEFAULTS, on: 1, clip: 1, gain: 90, tone: 64 }, sine(110, 0.5)).L;
  ok(peak(a.slice(fs / 2)) / rms(a, fs / 2) < peak(b.slice(fs / 2)) / rms(b, fs / 2) + 0.2, 'diode not harder than LED'); }
// drive aliasing stays low: a 5 kHz sine driven hard, nothing loud below 4 kHz other than real harmonics' folds
{ const { L } = run({ ...DIRT_DEFAULTS, on: 1, gain: 127, tone: 127, cutoff: 0 }, sine(4999, 0.5));
  // energy between 500 and 3000 Hz (no harmonic of 4999 lands there unless folded from above Nyquist)
  const x = L.slice(fs / 2), n = x.length; let band = 0, all = 0;
  for (let f = 100; f < 20000; f += 50) { let re = 0, im = 0; for (let i = 0; i < n; i += 2) { const a = 2 * Math.PI * f * i / fs; re += x[i] * Math.cos(a); im += x[i] * Math.sin(a); } const e = re * re + im * im; all += e; if (f >= 500 && f <= 3000) band += e; }
  ok(band / all < 0.02, 'aliasing: ' + (band / all).toFixed(4) + ' of the energy folded into 500-3000 Hz'); }
// XOVER, swap off: highs distorted, lows clean. A 60 Hz tone with the cutoff at 1 kHz goes almost all to CLEAN
{ const set = { ...DIRT_DEFAULTS, on: 1, xover: 1, cutoff: 64, dirty: 0, clean: 106 };
  const lo = run(set, sine(60, 0.3)).L, hi = run(set, sine(6000, 0.3)).L;
  ok(rms(lo, fs / 2) > 0.18 && rms(hi, fs / 2) < 0.08, `xover clean path: lows ${rms(lo, fs / 2).toFixed(3)} highs ${rms(hi, fs / 2).toFixed(3)}`);
  const sw = run({ ...set, swap: 1 }, sine(60, 0.3)).L; ok(rms(sw, fs / 2) < 0.08, 'xover swapped: lows should leave the clean path'); }
// the sidechain: a key burst opens the envelope, it falls away over DECAY, and it turns the cutoff
{ const key = new Float32Array(N); for (let i = 0; i < fs / 10; i++) key[i] = 0.5 * Math.sin(2 * Math.PI * 60 * i / fs);
  const d = new Dirt(fs); d.set({ ...DIRT_DEFAULTS, on: 1, sc: 1, src: 1, scfilt: 0, freq: 60, sens: 80, decay: 40, target: 1 }); d.wet = 1;
  const L = sine(200, 0.2), R = L.slice(); const env = [];
  for (let i = 0; i < N; i += 64) { d.process(L.subarray(i, i + 64), R.subarray(i, i + 64), key.subarray(i, i + 64)); env.push(d.env); }
  const at = (t) => env[Math.floor(t * fs / 64)];
  ok(at(0.05) > 0.8, 'sidechain envelope did not open: ' + at(0.05));
  ok(at(0.9) < at(0.2) * 0.2, `sidechain envelope did not fall: ${at(0.2)} -> ${at(0.9)}`);
  ok(d.readEnv() > 0.8 && d.readEnv() === 0, 'readEnv'); }
// the instrument: a hit through the distortion, the sidechain listening to engine 1, then switched off (fades, then
// bypassed)
{ const inst = new Instrument(48000), L = new Float32Array(128), R = new Float32Array(128);
  const kick = JSON.parse(readFileSync(new URL('../sounds/starter.json', import.meta.url))).find((s) => s.type === 'kick');
  inst.setFx({ dirt: { ...DIRT_DEFAULTS, on: 1, gain: 100, sc: 1, src: 1 } });
  inst.play(0, kick.params, 120, { level: 127, pan: 64, send: 0, trim: 0 });
  let pk = 0, fin = true, sc = 0;
  for (let k = 0; k < 40; k++) { inst.render(L, R); fin &&= L.every(Number.isFinite); pk = Math.max(pk, peak(L)); sc = Math.max(sc, inst.readSc()); }
  ok(fin && pk > 0.05 && pk <= 1, 'instrument through the distortion: peak ' + pk);
  ok(sc > 0, 'the drum did not drive the sidechain');
  inst.setFx({ dirt: { on: 0 } }); for (let k = 0; k < 400; k++) inst.render(L, R);
  ok(!inst.dirt.active, 'the distortion did not fade out to bypass'); }
console.log(fails ? `${fails} of ${checks} checks failed` : `ok: ${checks} checks`); process.exit(fails ? 1 : 0);

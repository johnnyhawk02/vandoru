// node test/curves.test.mjs: the value curves (engine/curves.js) at the points SPEC Appendix A lists, within 1%,
// and the patch's zones (SPEC 2.3).
import * as C from '../engine/curves.js';
import { zoneSizes } from '../app/patch.js';
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const near = (got, want, what) => ok(want === Infinity ? got === Infinity : Math.abs(got - want) <= Math.max(Math.abs(want) * 0.01, 1e-4), `${what}: ${got} (want ${want})`);
// value: [attack s, decay s, p decay s, cutoff Hz, crush Hz, lfo Hz, noise Hz, click rate]
const A = {
  0: [0.00145, 0.00145, 0.00145, 0, 0, 0.0001, 0, 0.25], 1: [0.0029, 0.013, 0.0029, 4.2, 62, 0.0008, 173, 0.28],
  4: [0.0058, 0.049, 0.0058, 17, 252, 0.012, 693, 0.37], 8: [0.0116, 0.099, 0.0116, 35, 518, 0.07, 1386, 0.49],
  16: [0.0217, 0.210, 0.0217, 75, 1095, 0.47, 2772, 0.72], 24: [0.0348, 0.339, 0.0348, 120, 1744, 1.49, 4157, 0.96],
  32: [0.0507, 0.490, 0.0507, 173, 2477, 3.43, 5543, 1.19], 48: [0.088, 0.882, 0.088, 308, 4276, 11.2, 8315, 1.67],
  64: [0.148, 1.47, 0.148, 505, 6712, 26.2, 11087, 2.14], 80: [0.247, 2.47, 0.247, 817, 10198, 50.7, 13858, 2.61],
  96: [0.448, 4.49, 0.448, 1393, 15601, 87.0, 16630, 3.08], 112: [1.08, 10.8, 1.08, 2804, 25098, 137.6, 19402, 3.55],
  120: [2.48, 24.8, 2.48, 4713, 33176, 169.0, 20787, 3.79], 126: [18.2, 183, 18.2, 8631, 42241, 195.4, 21827, 3.97],
  127: [Infinity, Infinity, Infinity, 9932, 44140, 200, 22000, 4.0],
};
for (const [v, w] of Object.entries(A)) {
  const x = Number(v);
  near(C.attackS(x), w[0], `ATTACK ${x}`); near(C.decayS(x), w[1], `DECAY ${x}`); near(C.pDecayS(x), w[2], `P DECAY ${x}`);
  if (w[3] >= 1) ok(Math.abs(C.cutoffHz(x) - w[3]) <= Math.max(w[3] * 0.01, 0.06), `CUTOFF ${x}: ${C.cutoffHz(x)}`); else ok(Math.abs(C.cutoffHz(x)) < 1e-9, `CUTOFF ${x}`);
  if (w[4] >= 1) near(C.crushHz(x), w[4], `CRUSH ${x}`);
  if (w[5] >= 0.01) near(C.lfoHz(x), w[5], `LFO RATE ${x}`); else ok(Math.abs(C.lfoHz(x) - w[5]) < 0.0001, `LFO RATE ${x}: ${C.lfoHz(x)}`);
  if (w[6] >= 1) near(C.noiseHz(x), w[6], `NOISE RATE ${x}`);
  near(C.clickRate(x), w[7], `CLICK RATE ${x}`);
}
for (const [v, m] of [[16, 1.51], [32, 3.03], [64, 9.13], [96, 19.3], [127, 33]]) near(1 + C.pAmountDepth(v), m, `P AMOUNT ${v}`);
for (const [v, k] of [[16, 0.27], [32, 0.65], [64, 1.97], [96, 5.94], [112, 13.9], [127, 254]]) near(C.driveK(v), k, `DRIVE ${v}`);
ok(Math.abs(C.driveK(0) + 0.016) < 0.001, 'DRIVE 0');
for (const [v, s] of [[0, -1.0], [32, -0.66], [96, 2.1]]) ok(Math.abs(C.decayShape(v) - s) < 0.02, `CURVE ${v}: ${C.decayShape(v)}`);
ok(Math.abs(C.decayShape(64)) < 0.02 && C.decayShape(127) > 3000, 'CURVE 64 and 127');
for (const [n, f] of [[24, 32.7], [36, 65.4], [48, 130.8], [60, 261.6], [72, 523.3], [96, 2093], [127, 12544]]) near(C.noteHz(n), f, `TUNE ${n}`);
ok(Math.abs(C.fineFactor(64) - 1.00023) < 0.00002, 'FINE 64 is a hair sharp');
// the zones: n engines, even sizes, the extra keys on the top one
const want = { 1: [25], 2: [12, 13], 3: [8, 8, 9], 4: [6, 6, 6, 7], 5: [5, 5, 5, 5, 5], 6: [4, 4, 4, 4, 4, 5] };
for (const n in want) ok(JSON.stringify(zoneSizes(Number(n))) === JSON.stringify(want[n]), `zones of ${n}: ${zoneSizes(Number(n))}`);
console.log(fails ? `${fails} of ${checks} checks failed` : `ok: ${checks} checks`);
process.exit(fails ? 1 : 0);

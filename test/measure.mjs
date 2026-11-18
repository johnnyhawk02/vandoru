// The measures of SPEC Appendix B, exactly as defined there, so a render of ours lines up with the reference pack's
// features: peak, the loudest 100 ms, the length, the 5 ms envelope, 1/3-octave bands every 20 ms, the centroid and
// the dominant pitch. Samples are floats, full scale 1, at 44140 Hz.
export const FS = 44140;

// an in-place radix-2 FFT
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k, q = p + len / 2, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

const N = 2048, HOP = 883, CENTRES = Array.from({ length: 29 }, (_, i) => 1000 * Math.pow(2, (i - 16) / 3));
const HANN = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
const BAND_OF = Int8Array.from({ length: N / 2 }, (_, k) => { const f = k * FS / N; return CENTRES.findIndex((c) => f >= c * Math.pow(2, -1 / 6) && f < c * Math.pow(2, 1 / 6)); });
const r1 = (x) => Math.round(x * 10) / 10;

export function measure(x, { bands = true } = {}) {
  let pk = 0;
  for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]));
  const peakDb = pk > 0 ? r1(20 * Math.log10(pk)) : -100;
  // the loudest 100 ms: mean square over any 4414 samples
  let s = 0, best = 0;
  for (let i = 0; i < x.length; i++) { s += x[i] * x[i]; if (i >= 4414) s -= x[i - 4414] * x[i - 4414]; if (i >= 4413 || i === x.length - 1) best = Math.max(best, s / 4414); }
  const loud100Db = best > 0 ? r1(10 * Math.log10(best)) : -100;
  // 5 ms frames
  const env = [];
  for (let i = 0; i + 221 <= x.length; i += 221) { let m = 0; for (let j = i; j < i + 221; j++) m += x[j] * x[j]; env.push(r1(10 * Math.log10(m / 221 + 1e-12))); }
  const top = Math.max(...env);
  let last = -1;
  for (let i = 0; i < env.length; i++) if (env[i] >= top - 60) last = i;
  const lengthMs = (last + 1) * 5;
  const out = { peakDb, loud100Db, lengthMs, env5ms: env };
  if (!bands) return out;
  out.bands20ms = []; out.centroid20ms = []; out.pitch20ms = [];
  const frames = Math.min(200, Math.floor(lengthMs / 20) + 1);
  for (let f = 0; f < frames; f++) {
    const c = HOP * f, re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) { const t = c - N / 2 + i; re[i] = t >= 0 && t < x.length ? x[t] * HANN[i] : 0; }
    const keep = f < 25 ? Float64Array.from(re) : null;
    fft(re, im);
    const b = new Float64Array(29); let ps = 0, pf = 0;
    for (let k = 1; k < N / 2; k++) {
      const p = (re[k] * re[k] + im[k] * im[k]) * 4 / (N * N);
      if (BAND_OF[k] >= 0) b[BAND_OF[k]] += p;
      ps += p; pf += p * k * FS / N;
    }
    out.bands20ms.push([...b].map((v) => (v <= 1e-10 ? -100 : Math.round(10 * Math.log10(v)))));
    out.centroid20ms.push(ps > 0 ? Math.round(pf / ps) : 0);
    if (keep) {
      const M = 8192, r = new Float64Array(M), j = new Float64Array(M); r.set(keep); fft(r, j);
      let bi = 1, bm = 0, sum = 0;
      const mag = (k) => Math.hypot(r[k], j[k]);
      for (let k = 1; k < M / 2; k++) { const m = mag(k); sum += m; if (m > bm) { bm = m; bi = k; } }
      const mean = sum / (M / 2 - 1);
      if (bm > 40 * mean && bi > 1 && bi < M / 2 - 1) {
        const a = Math.log(mag(bi - 1) + 1e-30), bb = Math.log(bm), cc = Math.log(mag(bi + 1) + 1e-30), d = a - 2 * bb + cc;
        const off = d === 0 ? 0 : 0.5 * (a - cc) / d;
        out.pitch20ms.push(Math.round((bi + off) * FS / M * 10) / 10);
      } else out.pitch20ms.push(null);
    }
  }
  return out;
}

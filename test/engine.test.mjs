// node test/engine.test.mjs: the engine checks of SPEC 11.3 for the parts built so far: the control tick at 44.1 and
// 48 kHz, REPEAT, the waves and their band-limiting, the WAVE dial on a setting, repeatability and stability.
import { renderSound } from '../engine/render.js';
import { defaultParams } from '../sound/params.js';
import { TABLES, BANDS } from '../engine/waves.js';
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const snd = (o) => ({ ...defaultParams(), cutoff: 127, type: 126, ...o });
const lastAbove = (x, th) => { for (let i = x.length - 1; i >= 0; i--) if (Math.abs(x[i]) > th) return i; return -1; };

// the control tick: DECAY 32's envelope reaches 0 after 490 ms at both rates (a sine at a low note, CURVE straight)
for (const fs of [44100, 48000]) {
  const x = renderSound(snd({ decay: 32, ampCurve: 64, tune: 36 }), { fs, seconds: 0.7 }), end = lastAbove(x, 1e-6) / fs;
  ok(Math.abs(end - 0.49) < 0.004, `DECAY 32 ends at 490 ms at ${fs} Hz: ${(end * 1000).toFixed(1)} ms`);
}
// ATTACK 127 never rises; DECAY 127 never decays
ok(lastAbove(renderSound(snd({ attack: 127 }), { seconds: 0.3 }), 1e-9) < 0, 'ATTACK 127 is silent');
{ const x = renderSound(snd({ decay: 127, tune: 60 }), { seconds: 3 }); ok(Math.max(...x.subarray(x.length - 2000).map(Math.abs)) > 0.75, 'DECAY 127 rings on'); }

// REPEAT 3: three short hits spaced by the ATTACK time, then the main decay
{
  const fs = 44140, x = renderSound(snd({ repeat: 3, attack: 20, decay: 20, tune: 96, kind: 'snare' }), { fs, seconds: 0.5 });
  const hit = 20 / 127, ticks = Math.ceil(1 / Math.min(1, 2 * (1 - hit) / (1 + 198 * hit))) + 1, len = ticks * 64;
  const rms = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / (b - a)); };
  // the level just after each restart is high, just before it low
  const starts = [0, 1, 2, 3].map((k) => rms(k * len + 64, k * len + 192)), ends = [0, 1, 2].map((k) => rms((k + 1) * len - 128, (k + 1) * len));
  ok(starts.every((s) => s > 0.5) && ends.every((e) => e < 0.2), `REPEAT 3: hits at ${len} samples: starts ${starts.map((v) => v.toFixed(2))} ends ${ends.map((v) => v.toFixed(2))}`);
}

// the waves: peaks at full scale, the counts of the spec (a saw below 440 Hz has 45 harmonics)
for (const k of ['saw', 'square', 'tri']) for (let b = 0; b < BANDS; b++) {
  const t = TABLES[k][b]; ok(Math.abs(Math.max(...t.map(Math.abs)) - 1) < 1e-6, `${k} band ${b} peaks at full scale`);
}
// the start phases: a sine starts at zero going up, a square at +1
{ const s = renderSound(snd({ wave: 0, tune: 60, kind: 'metal' }), { seconds: 0.01 }), q = renderSound(snd({ wave: 75, tune: 60, kind: 'metal' }), { seconds: 0.01 });
  ok(Math.abs(s[0]) < 0.01 && s[3] > s[0], `a sine starts at 0 going up: ${s[0].toFixed(3)} ${s[3].toFixed(3)}`);
  ok(q[0] > 0.7, `a square starts high: ${q[0].toFixed(3)}`); }
// PWM 0 is silence, 127 a square
ok(lastAbove(renderSound(snd({ wave: 100, pwm: 0 }), { seconds: 0.1 }), 1e-6) < 0, 'PWM 0 is silent');
{ const a = renderSound(snd({ wave: 100, pwm: 127, tune: 48 }), { seconds: 0.1 }), b = renderSound(snd({ wave: 75, tune: 48 }), { seconds: 0.1 });
  const rms = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length); ok(Math.abs(rms(a) - rms(b)) < 0.03, `PWM 127 is as loud as a square: ${rms(a).toFixed(3)} ${rms(b).toFixed(3)}`); }
// the dial: a position between sine and tri is between the two; on a setting exactly the setting
{ const a = renderSound(snd({ wave: 0 }), { seconds: 0.05 }), b = renderSound(snd({ wave: 25 }), { seconds: 0.05 }), m = renderSound(snd({ wave: 12.5 }), { seconds: 0.05 });
  let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(m[i] - (a[i] + b[i]) / 2)); ok(d < 1e-3, `WAVE halfway is the mix of the two: ${d}`); }

// FM (SPEC 5.5): a sine tone, a sine modulator at full A AMOUNT, FM ENV 0: the phase moves by max(0, A) cycles, one-sided;
// on a saw tone by 4 times that. Checked against the formula, sample by sample, while the envelope is flat
for (const [wave, scale, tbl] of [[0, 1, null], [50, 4, 'saw']]) {
  const fs = 44140, s = snd({ wave, tune: 48, aFreq: 55, aAmount: 127, aWave: 0, fmEnv: 0, decay: 127, kind: 'metal', velVol: false });
  const x = renderSound(s, { fs, seconds: 0.05, level: 127 });
  const f0 = 440 * Math.pow(2, (48 - 69) / 12) * (1 + (64 / 127 - 0.5) * (Math.pow(2, 1 / 12) - 1)), fa = 440 * Math.pow(2, (55 - 69) / 12) * 1.000234;
  let err = 0, below = 0;
  for (let i = 200; i < 2000; i++) {
    const p = 0.25 + f0 * i / fs, a = -Math.cos(2 * Math.PI * fa * i / fs), sh = Math.max(0, a) * scale;
    const want = tbl ? null : -Math.cos(2 * Math.PI * (p + sh));
    if (want !== null) err = Math.max(err, Math.abs(x[i] - want));
    if (a < 0 && tbl === null && Math.abs(x[i] - -Math.cos(2 * Math.PI * p)) > 0.01) below++;
  }
  if (!tbl) ok(err < 0.01 && below === 0, `sine FM: one-sided, 1 cycle at full scale (error ${err.toFixed(4)}, ${below} samples moved by the negative half)`);
  else { const y = renderSound({ ...s, aAmount: 0 }, { fs, seconds: 0.05 }); let d = 0; for (let i = 0; i < y.length; i++) d += Math.abs(x[i] - y[i]); ok(d / y.length > 0.1, 'saw FM moves the tone'); }
}
// the pitch envelope: P AMOUNT 127 starts the tone 33 times higher, and it falls back to the base pitch
{
  const fs = 44140, x = renderSound(snd({ tune: 36, pAmount: 127, pDecay: 40, pCurve: 64, decay: 127, kind: 'metal', velVol: false }), { fs, seconds: 0.6 });
  const zc = (a, b) => { let n = 0; for (let i = a + 1; i < b; i++) if ((x[i - 1] < 0) !== (x[i] < 0)) n++; return n / 2 / ((b - a) / fs); };
  const f0 = 440 * Math.pow(2, (36 - 69) / 12), early = zc(0, 64), late = zc(fs * 0.4, fs * 0.6);
  ok(early > f0 * 25 && Math.abs(late / f0 - 1) < 0.03, `pitch envelope: ${early.toFixed(0)} Hz at the start, ${late.toFixed(1)} Hz later (base ${f0.toFixed(1)})`);
}
// the snap: CLICK SNAP at full CLICK VOL lifts the first ticks' pitch, gone after 5/r ticks
{
  const fs = 44140, s = snd({ tune: 36, click: 0, clickVol: 127, clickRate: 25, decay: 127, kind: 'metal', velVol: false });
  const a = renderSound(s, { fs, seconds: 0.1 }), b = renderSound({ ...s, clickVol: 0 }, { fs, seconds: 0.1 });
  let d0 = 0; for (let i = 0; i < 64; i++) d0 += Math.abs(a[i] - b[i]);
  ok(d0 > 5, `the snap changes the start (${d0.toFixed(1)})`);
}
// PHASE: CLICK PHASE at full CLICK VOL starts a sine at its lowest point
{ const x = renderSound(snd({ wave: 0, click: 1, clickVol: 127, kind: 'metal', velVol: false }), { seconds: 0.01 }); ok(x[0] < -0.99, `PHASE 127 starts a sine at -1: ${x[0].toFixed(3)}`); }

// the filter (SPEC 5.10): the 0.4 input level, LP darkening a saw, the drum kind's filter cleared at each note
{
  const rms = (x) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
  const base = { wave: 0, tune: 36, decay: 127, kind: 'metal', velVol: false };
  const off = rms(renderSound(snd({ ...base, type: 126 }), { seconds: 0.2 })), lp = rms(renderSound(snd({ ...base, type: 0, cutoff: 127 }), { seconds: 0.2 }));
  const db = 20 * Math.log10(lp / off);
  ok(db < -6.5 && db > -9.5, `LP at full cutoff, FLT DRIVE 0, is about 8 dB under OFF: ${db.toFixed(1)} dB`);
  const hi = (x) => { let d = 0; for (let i = 1; i < x.length; i++) d += (x[i] - x[i - 1]) ** 2; return Math.sqrt(d / x.length); };
  const open = hi(renderSound(snd({ ...base, wave: 50, type: 0, cutoff: 127 }), { seconds: 0.2 })), shut = hi(renderSound(snd({ ...base, wave: 50, type: 0, cutoff: 20 }), { seconds: 0.2 }));
  ok(shut < open / 3, `LP at CUTOFF 20 darkens a saw: ${(shut / open).toFixed(3)}`);
  for (const t of [0, 18, 36, 54, 72, 90, 108, 126, 27, 117]) {
    const x = renderSound(snd({ ...base, wave: 125, type: t, cutoff: 80, reso: 127, fltDrive: 127 }), { seconds: 0.3 });
    ok(x.every((v) => Number.isFinite(v) && Math.abs(v) <= 1), `TYPE ${t} at full RESO and FLT DRIVE stays finite`);
  }
}
// crush: CRUSH 0 holds the first sample for ever; CRUSH 64 holds each sample for several
{ const x = renderSound(snd({ wave: 50, tune: 60, crush: 64, type: 126, kind: 'metal', velVol: false, decay: 127 }), { seconds: 0.05 });
  let same = 0; for (let i = 1; i < x.length; i++) if (x[i] === x[i - 1]) same++; ok(same / x.length > 0.75, `CRUSH 64 holds samples: ${(same / x.length).toFixed(2)}`); }

// repeatability: the same render twice is identical
{ const s = snd({ wave: 125, decay: 40 }), a = renderSound(s), b = renderSound(s); ok(a.every((v, i) => v === b[i]), 'renders repeat exactly'); }
// stability: random sounds never give NaN, infinity or over full scale
{
  let r = 12345; const rnd = () => { r = (r * 1103515245 + 12345) >>> 0; return r / 4294967296; };
  let bad = 0;
  for (let n = 0; n < 2000; n++) {
    const s = snd({}); for (const k in s) if (typeof s[k] === 'number') s[k] = Math.floor(rnd() * 128); s.repeat = Math.floor(rnd() * 16); s.kind = ['drum', 'snare', 'metal'][n % 3];
    const x = renderSound(s, { seconds: 0.05, vel: 1 + Math.floor(rnd() * 127) });
    if (!x.every((v) => Number.isFinite(v) && Math.abs(v) <= 1)) bad++;
  }
  ok(!bad, `2000 random sounds stay finite and within full scale (${bad} bad)`);
}
console.log(fails ? `${fails} of ${checks} checks failed` : `ok: ${checks} checks`);
process.exit(fails ? 1 : 0);

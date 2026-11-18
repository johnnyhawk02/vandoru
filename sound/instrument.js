// The instrument: 1 to 6 mono engines, each playing one key's sound at a time, their mix, and the master (the
// distortion, then the output level and a safety limiter). Pure JS, no DOM and no Web Audio: the worklet hosts it
// for the speakers, and node runs it in the tests. The reverb send and the compressor come with step 9 (SPEC 7).
import { Voice } from '../engine/voice.js?v=mwmh7ohg';
import { Dirt, DIRT_DEFAULTS } from './dirt.js?v=mwmh7ohg';

export const MAX_ENGINES = 6;
/** RETURN: an earlier held key comes back now, or on the next step of the BPM grid */
export const RETURNS = ['NOW', '1/32', '1/16', '1/8', '1/4'];
const RETURN_BEATS = [0, 1 / 8, 1 / 4, 1 / 2, 1];

export const FX_DEFAULTS = {
  reverb: { size: 64, decay: 64, tone: 64, early: 64, predelay: 10, width: 127 },
  dirt: { ...DIRT_DEFAULTS },
  comp: { thresh: 12, ratio: 30, attack: 5, release: 120, knee: 6, makeup: 0 },
  out: { level: 80, eng: [127, 127, 127, 127, 127, 127] },
};
export const fxDefaults = () => structuredClone(FX_DEFAULTS);

const MIX_GAIN = 0.8;

class Engine {
  constructor(fs) {
    this.voice = new Voice(fs);
    this.out = { level: 100, pan: 64, send: 0, trim: 0 };
    this.gL = 0; this.gR = 0; this.trim = 1; this.trimTo = 1;
    this.pending = null; this.buf = new Float32Array(128); this.peak = 0;
  }
}

export class Instrument {
  constructor(fs) {
    this.fs = fs; this.t = 0; this.n = 3; this.bpm = 120; this.ret = 2;
    this.engines = Array.from({ length: MAX_ENGINES }, () => new Engine(fs));
    this.fx = fxDefaults();
    this.dirt = new Dirt(fs);
    this.outGain = this.fx.out.level / 100;
    this.engGain = this.fx.out.eng.map((v) => v / 127);
    this.trimGlide = 1 - Math.exp(-1 / (0.004 * fs));
    this.key = new Float32Array(128);
  }
  /** SETTINGS: FRESH NOISE (each live hit's noise new) */
  setSettings(st) { if (st) for (const en of this.engines) en.voice.freshNoise = !!st.freshNoise; }
  setEngines(n) { this.n = Math.max(1, Math.min(MAX_ENGINES, n | 0)); }
  setTempo(bpm, ret) { if (bpm) { this.bpm = bpm; for (const en of this.engines) en.voice.bpm = bpm; } if (ret !== undefined) this.ret = ret; }
  /** a note on engine e: the sound's parameters, the velocity and the key's output (level, pan, send, trim).
   *  back: the zone returning to an earlier held key, on the next step of the RETURN grid */
  play(e, sound, vel, out, back = false) {
    const en = this.engines[e];
    if (!en) return;
    let at = this.t;
    if (back && this.ret) { const step = Math.round(RETURN_BEATS[this.ret] * 60 / this.bpm * this.fs); at = Math.ceil(this.t / step) * step; }
    en.pending = { sound, vel, out, at };
    if (at <= this.t) this.start(en);
  }
  start(en) {
    const { sound, vel, out } = en.pending; en.pending = null;
    en.out = { ...out };
    en.trimTo = Math.pow(10, (out.trim || 0) / 20); if (!en.voice.active) en.trim = en.trimTo;
    en.voice.trigger(sound, vel, out.level);
    // pan is latched at the note's start, where an LFO or velocity aimed at PAN puts it (SPEC 5.14)
    const p = Math.min(127, Math.max(0, en.voice.panFor(out.pan)));
    en.gL = Math.sqrt((127 - p) / 127); en.gR = Math.sqrt(p / 127);
  }
  /** the ringing sound edited: heard on what's still sounding */
  update(e, sound, out) {
    const en = this.engines[e];
    if (!en || !en.voice.sound) return;
    if (out) { en.out = { ...out }; en.trimTo = Math.pow(10, (out.trim || 0) / 20); }
    en.voice.set(sound, en.out.level);
  }
  /** a key let go: a return waiting for the grid is dropped (the sound itself rings on: no release, SPEC 5.9) */
  release(e) { const en = this.engines[e]; if (en) en.pending = null; }
  allOff() { for (const en of this.engines) en.pending = null; }
  setFx(fx) {
    if (fx.dirt) { Object.assign(this.fx.dirt, fx.dirt); this.dirt.set(this.fx.dirt); }
    if (fx.reverb) Object.assign(this.fx.reverb, fx.reverb);
    if (fx.comp) Object.assign(this.fx.comp, fx.comp);
    if (fx.out) {
      if (fx.out.level !== undefined) this.fx.out.level = fx.out.level;
      if (Array.isArray(fx.out.eng)) this.fx.out.eng = fx.out.eng.slice(0, MAX_ENGINES);
      this.outGain = this.fx.out.level / 100; this.engGain = this.fx.out.eng.map((v) => v / 127);
    }
  }
  /** the engines' peaks since the last call */
  readPeaks() { return this.engines.map((en) => { const p = en.peak; en.peak = 0; return p; }); }
  /** the distortion's sidechain envelope */
  readSc() { return this.dirt.readEnv(); }
  /** render L.length samples (at most 128 at a time) into L and R */
  render(L, R) {
    const n = L.length;
    L.fill(0); R.fill(0);
    const src = this.fx.dirt.src | 0, key = src ? this.key.subarray(0, n) : null;
    if (key) key.fill(0);
    for (let e = 0; e < this.n; e++) {
      const en = this.engines[e];
      if (en.pending && en.pending.at < this.t + n) this.start(en); // (a return lands on the block holding its grid step)
      if (!en.voice.active) continue;
      const b = en.buf.subarray(0, n);
      en.voice.render(b, n);
      const g = MIX_GAIN * this.engGain[e];
      let tr = en.trim, pk = en.peak;
      for (let i = 0; i < n; i++) {
        tr += (en.trimTo - tr) * this.trimGlide;
        const x = b[i] * tr * g, a = x < 0 ? -x : x;
        if (a > pk) pk = a;
        L[i] += x * en.gL; R[i] += x * en.gR;
        if (key && src === e + 1) key[i] += x;
      }
      en.trim = tr; en.peak = pk;
    }
    if (this.dirt.active) this.dirt.process(L, R, key);
    const og = this.outGain;
    for (let i = 0; i < n; i++) { L[i] = limit(L[i] * og); R[i] = limit(R[i] * og); }
    this.t += n;
  }
}

// the output's safety limiter: straight up to 0.9 of full scale, then a soft knee that never passes 1.0
function limit(x) {
  const a = x < 0 ? -x : x;
  if (a <= 0.9) return x;
  const y = 0.9 + 0.1 * Math.tanh((a - 0.9) / 0.1);
  return x < 0 ? -y : y;
}

// The voice (SPEC section 5): one engine's sound, one note at a time. Pure JS, rate-agnostic: the envelopes count
// control ticks of 64/44140 s on a clock of their own, whatever the audio rate.
//
// Built so far (build order steps 3 and 4): the tone with its six waves (band-limited) and the WAVE dial, its pitch
// (TUNE, FINE), the pitch envelope, the snap and PHASE, mod A and mod B with one-sided FM, FM ENV and A MODE, the amp
// envelope (ATTACK, DECAY, CURVE, REPEAT, glided in the drum kind, stepped in the others), LEVEL and velocity, and the
// end of a sound. Noise, the generated clicks, filter, drive, crush and the modulation routes come in the next steps;
// the voice runs as if they were at rest.
import { TICK_S, noteHz, fineFactor, MOD_FINE, riseStep, decayStep, decayShape, attackShape, pCurveShape, pAmountDepth, clickRate, shape } from './curves.js?v=mwmdy8tl';
import { TABLES, SINE, read, bandFor } from './waves.js?v=mwmdy8tl';

// the WAVE dial (SPEC 6.1), by position: sine 0, tri 25, saw 50, square 75, pwm 100, noise 125
const STOPS = [0, 25, 50, 75, 100, 125];
const SINE_W = 0, TRI = 1, SAW = 2, SQUARE = 3, PWM = 4, NOISE = 5;
function dial(v) {
  if (v >= 125) return [NOISE, NOISE, 0];
  for (let i = 0; i < 5; i++) if (v < STOPS[i + 1]) { const t = Math.max(0, (v - STOPS[i]) / 25); return t < 1e-9 ? [i, i, 0] : [i, i + 1, t]; }
  return [NOISE, NOISE, 0];
}
const clip = (x) => (x > 1 ? 1 : x < -1 ? -1 : x);

/** a small, fast, seedable noise source: uniform in [-1, 1) */
export class Rand {
  constructor(seed = 0x2545f491) { this.s = seed >>> 0 || 1; }
  next() { let s = this.s; s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; this.s = s; return s / 2147483648 - 1; }
}

/** an oscillator: one phase counter, the dial's one or two waves read at it */
class Osc {
  constructor() { this.ph = 0; this.held = 0; this.bands = [0, 0, 0]; }
  /** the band-limiting tables for this tick's frequency */
  tables(f, fs) { this.tri = TABLES.tri[bandFor('tri', f, fs)]; this.saw = TABLES.saw[bandFor('saw', f, fs)]; this.sq = TABLES.square[bandFor('square', f, fs)]; }
  /** the dial's value at phase p: one wave, or two crossfaded (SPEC 6.1) */
  dial(a, b, t, p, pw) { const x = this.wave(a, p, pw); return t > 0 ? x + (this.wave(b, p, pw) - x) * t : x; }
  wave(w, p, pw) {
    switch (w) {
      case SINE_W: return read(SINE, p);
      case TRI: return read(this.tri, p);
      case SAW: return read(this.saw, p);
      case SQUARE: return read(this.sq, p);
      case PWM: { let q = p + pw; if (q >= 1) q -= 1; return clip(read(this.saw, p) - read(this.saw, q)); }
      default: return this.held;
    }
  }
}

const START = [0.25, 0.25, 0.25, 0.25, 0, 0]; // the tone's start phase by wave (SPEC 5.4)
const FM_SCALE = [1, 4, 4, 4, 4, 0]; // cycles of phase shift for a full-scale modulator, by the tone's wave (SPEC 5.5)
const wrap = (p) => p - Math.floor(p);

export class Voice {
  constructor(fs) {
    this.fs = fs;
    this.spt = fs * TICK_S; // samples per control tick (64 at 44140 Hz)
    this.tone = new Osc(); this.modA = new Osc(); this.modB = new Osc();
    this.rand = new Rand(); this.randA = new Rand(0x68e31da4); this.randB = new Rand(0xb5297a4d);
    this.sound = null; this.active = false;
    this.freshNoise = false;
    this.lvlGlide = 1 - Math.exp(-1 / (0.0023 * fs)); // LEVEL's smoothing, about 2.3 ms
  }
  /** a new note: the sound's parameters, the velocity (1..127) and LEVEL (0..127) */
  trigger(sound, vel, level, note = 60) {
    this.sound = sound; this.vel = vel; this.note = note;
    this.set(sound, level);
    // start phases (SPEC 5.4): the nearer wave's; PHASE moves the tone's back towards the cycle's start
    const near = (v) => { const [a, b, t] = dial(v); return t < 0.5 ? a : b; };
    const o = Math.round(sound.click) === 1 ? 1 - sound.clickVol / 127 : 1;
    this.tone.ph = START[near(sound.wave)] * o; this.tone.held = this.rand.next();
    this.modA.ph = this.kind === 0 ? START[near(sound.aWave)] : 0; this.modA.held = this.randA.next();
    this.modB.ph = 0; this.modB.held = this.randB.next();
    this.u = 1; this.k = 1; // the pitch envelope and the snap
    // the amp envelope (SPEC 5.9): REPEAT skips the attack
    this.reps = Math.round(sound.repeat);
    this.stage = this.reps > 0 ? 'rep' : 'att';
    this.env = this.reps > 0 ? 1 : 0; this.fresh = this.reps > 0;
    this.gain = 0; this.gStep = 0;
    this.tickAt = 0; // samples until the next tick: the first one at once
    this.quiet = 0; this.active = true;
    this.levelNow = this.levelTo;
  }
  /** the sound's parameters changed (a knob turned while it rings) */
  set(sound, level) {
    this.sound = sound;
    this.levelTo = Math.max(0, Math.min(127, level)) / 127;
    this.kind = sound.kind === 'snare' ? 1 : sound.kind === 'metal' ? 2 : 0;
    this.velG = sound.velVol ? this.vel / 127 : 1;
    this.base = noteHz(Math.round(sound.tune) + (this.note - 60)) * fineFactor(sound.fine);
    [this.wa, this.wb, this.wt] = dial(sound.wave);
    this.pw = sound.pwm / 127 * 0.5;
    this.attStep = riseStep(sound.attack); this.decStep = decayStep(sound.decay);
    this.aShape = attackShape(sound.ampCurve); this.dShape = decayShape(sound.ampCurve);
    // the pitch envelope (5.8) and the snap (5.7)
    this.P = pAmountDepth(sound.pAmount); this.pStep = riseStep(sound.pDecay); this.pShape = pCurveShape(sound.pCurve);
    this.snap = Math.round(sound.click) === 0 ? sound.clickVol / 127 : 0; this.snapStep = 0.2 * clickRate(sound.clickRate);
    // mod A and mod B (5.5)
    this.aAmt = sound.aAmount / 127; this.bAmt = sound.bAmount / 127;
    this.aOn = this.aAmt > 0; this.bOn = this.bAmt > 0;
    this.fA = noteHz(Math.round(sound.aFreq) + (this.note - 60)) * MOD_FINE; this.fB = noteHz(Math.round(sound.bFreq) + (this.note - 60)) * MOD_FINE;
    [this.aa, this.ab, this.at] = dial(sound.aWave); [this.ba, this.bb, this.bt] = dial(sound.bWave);
    this.mix = sound.aMode / 127; this.fmEnv = sound.fmEnv / 127;
    this.modA.tables(this.fA, this.fs); this.modB.tables(this.fB, this.fs);
    this.incA = this.fA / this.fs; this.incB = this.fB / this.fs;
    this.scA = FM_SCALE[this.wa]; this.scB = FM_SCALE[this.wb];
    // the tone's level: A MODE crossfades it towards the mixed-in A, NOISE towards the noise
    this.toneLevel = (1 - this.mix * this.aAmt) * (1 - sound.noise / 127);
  }
  /** one control tick: the envelopes move, the oscillators pick their tables */
  tick() {
    const wasAttack = this.stage === 'att' || this.stage === 'rep';
    let out = 0;
    switch (this.stage) {
      case 'att':
        this.env += this.attStep;
        if (this.env >= 1) { this.env = 1; this.stage = 'dec'; this.fresh = false; }
        out = shape(this.env, this.aShape); break;
      case 'rep': // a short hit: from 1 down at the attack rate; it may dip below 0 before it starts again
        if (this.fresh) this.fresh = false; else this.env -= this.attStep;
        out = shape(this.env, this.dShape);
        if (this.env <= 0) { this.env = 1; this.fresh = true; if (--this.reps <= 0) this.stage = 'dec'; }
        break;
      case 'dec':
        if (this.fresh) this.fresh = false; else this.env -= this.decStep;
        if (this.env <= 0) { this.env = 0; this.stage = 'done'; }
        out = shape(this.env, this.dShape); break;
    }
    // drum: glide to the new gain across the tick (but jump during a one-tick attack and its repeats); others: step
    if (this.kind !== 0 || (wasAttack && this.sound.attack === 0)) { this.gain = out; this.gStep = 0; } else this.gStep = (out - this.gain) / this.spt;
    // the pitch: m = 1 + P E + K, with E the pitch envelope's output and K the snap's (5.3)
    const E = shape(this.u, this.pShape);
    this.u = Math.max(0, this.u - this.pStep);
    const K = 24 * this.k * this.k * this.snap;
    this.k = Math.max(0, this.k - this.snapStep);
    const f = this.base * (1 + this.P * E + K);
    this.inc = f / this.fs;
    // the FM depth, by FM ENV (5.5)
    this.D = (1 - this.fmEnv) + this.fmEnv * this.aAmt * E;
    this.tone.tables(f, this.fs);
  }
  /** writes n samples of the voice into out (mono) */
  render(out, n) {
    if (!this.active) { out.fill(0, 0, n); return; }
    const tone = this.tone, fs = this.fs;
    for (let i = 0; i < n; i++) {
      if (this.tickAt <= 0) { this.tick(); this.tickAt += this.spt; }
      this.tickAt -= 1;
      // the modulators: A's FM part and B summed, clipped; A's MIX part added after the tone
      let A = 0, M = 0;
      if (this.aOn) {
        const ma = this.modA; A = ma.dial(this.aa, this.ab, this.at, ma.ph, this.pw) * this.aAmt;
        ma.ph += this.incA; if (ma.ph >= 1) { ma.ph -= Math.floor(ma.ph); ma.held = this.randA.next(); }
        M = A * (1 - this.mix);
      }
      if (this.bOn) {
        const mb = this.modB; M += mb.dial(this.ba, this.bb, this.bt, mb.ph, this.pw) * this.bAmt;
        mb.ph += this.incB; if (mb.ph >= 1) { mb.ph -= Math.floor(mb.ph); mb.held = this.randB.next(); }
        M = clip(M);
      }
      // the tone, phase-modulated by the positive half of M, each wave of the dial with its own depth
      const p = tone.ph, sh = M > 0 ? this.D * M : 0;
      let T;
      if (sh === 0) T = tone.dial(this.wa, this.wb, this.wt, p, this.pw);
      else {
        T = tone.wave(this.wa, wrap(p + sh * this.scA), this.pw);
        if (this.wt > 0) T += (tone.wave(this.wb, wrap(p + sh * this.scB), this.pw) - T) * this.wt;
      }
      T = clip(T * this.toneLevel + A * this.mix);
      tone.ph += this.inc;
      if (tone.ph >= 1) { tone.ph -= Math.floor(tone.ph); tone.held = this.rand.next(); }
      // routing and the finishing stage by kind (SPEC 5.11), with the parts built so far
      let y = clip(T), g = this.gain;
      this.gain += this.gStep;
      this.levelNow += (this.levelTo - this.levelNow) * this.lvlGlide;
      if (this.kind === 0) y = clip(y * g * this.velG) * this.levelNow;
      else y = clip(y * this.levelTo * this.velG * g);
      out[i] = clip(y);
      // the end of the sound: the envelope done and 50 ms under -90 dB
      if (this.stage === 'done') { if (y > 3e-5 || y < -3e-5) this.quiet = 0; else if (++this.quiet > 0.05 * fs) { this.active = false; out.fill(0, i + 1, n); return; } }
    }
  }
}

// The voice (SPEC section 5): one engine's sound, one note at a time. Pure JS, rate-agnostic: the envelopes count
// control ticks of 64/44140 s on a clock of their own, whatever the audio rate.
//
// Built so far (build order step 3): the tone with its six waves (band-limited) and the WAVE dial, its pitch (TUNE,
// FINE), the amp envelope (ATTACK, DECAY, CURVE, REPEAT, glided in the drum kind, stepped in the others), LEVEL and
// velocity, and the end of a sound. The pitch envelope, the modulators, noise, click, filter, drive, crush and the
// modulation routes come in the next steps; the voice runs as if they were at rest.
import { TICK_S, noteHz, fineFactor, riseStep, decayStep, decayShape, attackShape, shape } from './curves.js?v=mwmdta0r';
import { TABLES, SINE, read, bandFor } from './waves.js?v=mwmdta0r';

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

export class Voice {
  constructor(fs) {
    this.fs = fs;
    this.spt = fs * TICK_S; // samples per control tick (64 at 44140 Hz)
    this.tone = new Osc();
    this.rand = new Rand();
    this.sound = null; this.active = false;
    this.freshNoise = false;
    this.lvlGlide = 1 - Math.exp(-1 / (0.0023 * fs)); // LEVEL's smoothing, about 2.3 ms
  }
  /** a new note: the sound's parameters, the velocity (1..127) and LEVEL (0..127) */
  trigger(sound, vel, level, note = 60) {
    this.sound = sound; this.vel = vel; this.note = note;
    this.set(sound, level);
    const [a, b, t] = dial(sound.wave);
    this.tone.ph = START[t < 0.5 ? a : b]; this.tone.held = this.rand.next();
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
    this.toneLevel = 1 - sound.noise / 127;
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
    const f = this.base; // (x the pitch envelope and the snap from step 4)
    this.inc = f / this.fs;
    this.tone.tables(f, this.fs);
  }
  /** writes n samples of the voice into out (mono) */
  render(out, n) {
    if (!this.active) { out.fill(0, 0, n); return; }
    const tone = this.tone, fs = this.fs;
    for (let i = 0; i < n; i++) {
      if (this.tickAt <= 0) { this.tick(); this.tickAt += this.spt; }
      this.tickAt -= 1;
      // the tone
      const p = tone.ph;
      let T = tone.wave(this.wa, p, this.pw);
      if (this.wt > 0) T += (tone.wave(this.wb, p, this.pw) - T) * this.wt;
      T *= this.toneLevel;
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

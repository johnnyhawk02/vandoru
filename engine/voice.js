// The voice (SPEC section 5): one engine's sound, one note at a time. Pure JS, rate-agnostic: the envelopes count
// control ticks of 64/44140 s on a clock of their own, whatever the audio rate.
//
// Built in build order steps 3 to 7: the tone with its six waves (band-limited) and the WAVE dial, its pitch
// (TUNE, FINE), the pitch envelope, the snap and PHASE, mod A and mod B with one-sided FM, FM ENV and A MODE, noise,
// the filter, the routing and finishing stage of each kind, drive and crush, the amp envelope (ATTACK, DECAY, CURVE,
// REPEAT, glided in the drum kind, stepped in the others), LEVEL and velocity, the twelve generated clicks, and the end
// of a sound, and the modulation routes: velocity and the LFO, each aimed at one of the sound's own parameters.
import { TICK_S, noteHz, fineFactor, MOD_FINE, riseStep, decayStep, decayShape, attackShape, pCurveShape, pAmountDepth, clickRate, noiseHz, driveK, crushHz, shape } from './curves.js?v=mwmt154h';
import { Rand } from './rand.js?v=mwmt154h';
import { moved, lfoWave, lfoStep } from './mod.js?v=mwmt154h';
import { CLICKS, CLICK_FS } from './clicks.js?v=mwmt154h';
import { Filter } from './filter.js?v=mwmt154h';
import { TABLES, SINE, read, bandFor } from './waves.js?v=mwmt154h';

// the WAVE dial (SPEC 6.1), by position: sine 0, tri 25, saw 50, square 75, pwm 100, noise 125
const STOPS = [0, 25, 50, 75, 100, 125];
const SINE_W = 0, TRI = 1, SAW = 2, SQUARE = 3, PWM = 4, NOISE = 5;
function dial(v) {
  if (v >= 125) return [NOISE, NOISE, 0];
  for (let i = 0; i < 5; i++) if (v < STOPS[i + 1]) { const t = Math.max(0, (v - STOPS[i]) / 25); return t < 1e-9 ? [i, i, 0] : [i, i + 1, t]; }
  return [NOISE, NOISE, 0];
}
const clip = (x) => (x > 1 ? 1 : x < -1 ? -1 : x);

export { Rand };

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
    this.rand = new Rand(); this.randA = new Rand(); this.randB = new Rand(); this.randN = new Rand(); this.seed = new Rand(0x9e3779b9);
    this.filter = new Filter(fs);
    this.nph = 0; this.nheld = 0; // the noise part's sample-and-hold, running across notes (5.6)
    this.crushC = 1; this.crushHeld = 0;
    this.levelNow = 0; this.driveNow = -1 / 128; // the drum kind's smoothed LEVEL and DRIVE start from rest and carry across notes
    this.sound = null; this.active = false;
    this.freshNoise = false; this.bpm = 120;
    // the LFO (5.15): its phase runs on across notes unless RETRIG is on or the engine gets another sound
    this.randL = new Rand(); this.lph = 0; this.lheld = 0; this.lastSig = null; this.lfoM = 0.5;
    this.lvlGlide = 1 - Math.exp(-1 / (0.0023 * fs)); // LEVEL's and DRIVE's smoothing in the drum kind, about 2.3 ms
  }
  /** a new note: the sound's parameters, the velocity (1..127) and LEVEL (0..127) */
  trigger(knobs, vel, level, note = 60) {
    this.vel = vel; this.note = note;
    // the note's noise: from a fixed seed (offline renders repeat exactly), or new on every live hit (FRESH NOISE)
    const seed = this.freshNoise ? this.seed.next() * 2147483647 + 2147483648 : 0x2545f491;
    this.rand.s = seed >>> 0 || 1; this.randA.s = (seed ^ 0x68e31da4) >>> 0 || 1; this.randB.s = (seed ^ 0xb5297a4d) >>> 0 || 1; this.randN.s = (seed ^ 0x1b873593) >>> 0 || 1;
    // the LFO: back to PHASE when RETRIG is on or the sound is another one (5.15, 5.17)
    const sig = JSON.stringify(knobs);
    if (knobs.retrig || sig !== this.lastSig) { this.lph = knobs.phase / 127; this.randL.s = (seed ^ 0x85ebca6b) >>> 0 || 1; this.lheld = (this.randL.next() + 1) / 2; }
    this.lastSig = sig;
    this.set(knobs, level);
    const sound = this.sound; // the parameters as modulated at the note's start
    // start phases (SPEC 5.4): the nearer wave's; PHASE moves the tone's back towards the cycle's start
    const near = (v) => { const [a, b, t] = dial(v); return t < 0.5 ? a : b; };
    const o = Math.round(sound.click) === 1 ? 1 - sound.clickVol / 127 : 1;
    this.tone.ph = START[near(sound.wave)] * o; this.tone.held = this.rand.next();
    this.modA.ph = this.kind === 0 ? START[near(sound.aWave)] : 0; this.modA.held = this.randA.next();
    this.modB.ph = 0; this.modB.held = this.randB.next();
    this.u = 1; this.k = 1; // the pitch envelope and the snap
    this.cpos = 0; // the generated click plays from its start
    // the amp envelope (SPEC 5.9): REPEAT skips the attack
    this.reps = Math.round(sound.repeat);
    this.stage = this.reps > 0 ? 'rep' : 'att';
    this.env = this.reps > 0 ? 1 : 0; this.fresh = this.reps > 0;
    this.gain = 0; this.gStep = 0;
    this.tickAt = 0; // samples until the next tick: the first one at once
    this.quiet = 0; this.active = true;
    if (this.kind === 0) this.filter.reset(); // the drum kind clears its filter (5.10)
  }
  /** the sound's knobs changed (a knob turned while it rings), or a new note's */
  set(knobs, level) {
    this.knobs = knobs; this.knobLevel = level;
    this.velOn = !!knobs.velDest && knobs.velAmount > 0;
    this.lfoOn = !!knobs.lfoDest && knobs.lfoAmount > 0;
    this.modOn = this.velOn || this.lfoOn;
    if (this.lfoOn) { this.lw = Math.round(knobs.lfoWave); this.lfoM = lfoWave(this.lw, this.lph, this.lheld); }
    if (this.modOn) this.derive(...this.effective()); else this.derive(knobs, level);
  }
  /** the knobs as the modulators move them this tick, and the key's LEVEL: [sound, level] */
  effective() {
    const s = this.knobs, e = { ...s };
    let lvl = this.knobLevel;
    const apply = (id, amt, m) => {
      if (id === 'level') lvl = moved('level', lvl, amt, m);
      else if (id !== 'pan' && id in s) e[id] = moved(id, s[id], amt, m);
    };
    // both on one target: the LFO wins
    if (this.velOn && !(this.lfoOn && s.lfoDest === s.velDest)) apply(s.velDest, s.velAmount / 127, this.vel / 127);
    if (this.lfoOn) apply(s.lfoDest, s.lfoAmount / 127, this.lfoM);
    return [e, lvl];
  }
  /** the key's PAN as the modulators place this note (pan is latched at the note's start, 5.14) */
  panFor(p) {
    const s = this.knobs;
    if (this.lfoOn && s.lfoDest === 'pan') return moved('pan', p, s.lfoAmount / 127, this.lfoM);
    if (this.velOn && s.velDest === 'pan') return moved('pan', p, s.velAmount / 127, this.vel / 127);
    return p;
  }
  /** everything the voice works out from the parameters (as modulated) */
  derive(sound, level) {
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
    // a generated click (CLICK 2..13): played at CLICK RATE, at CLICK VOL
    const cn = Math.round(sound.click);
    this.clickBuf = cn >= 2 && sound.clickVol > 0 ? CLICKS[cn] : null;
    this.clickVol = sound.clickVol / 127; this.cInc = clickRate(sound.clickRate) * CLICK_FS / this.fs;
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
    // noise (5.6), the routing (5.11), drive (5.12) and crush (5.13)
    this.nInc = noiseHz(sound.noiseRate) / this.fs; this.nMix = sound.noise / 127;
    this.snarePath = this.kind === 1 && !sound.toneIn && sound.noiseIn && !sound.clickIn;
    this.tIn = !!sound.toneIn; this.nIn = !!sound.noiseIn; this.cIn = !!sound.clickIn;
    this.anyIn = this.tIn || this.nIn || this.cIn;
    this.driveTo = sound.drive / 127 - 1 / 128;
    this.crushOn = sound.crush < 127; this.crushInc = crushHz(sound.crush) / this.fs;
    this.filter.set(sound.cutoff, sound.reso, sound.fltDrive, sound.type);
  }
  /** one control tick: the envelopes move, the oscillators pick their tables */
  tick() {
    // the modulators: the LFO's output this tick, the targets moved, then the LFO steps on (once per tick)
    if (this.modOn) {
      if (this.lfoOn) this.lfoM = lfoWave(this.lw, this.lph, this.lheld);
      const [e, l] = this.effective();
      this.derive(e, l);
      if (this.lfoOn) {
        this.lw = Math.round(e.lfoWave);
        this.lph += lfoStep(e.lfoRate, e.lfoSync, this.bpm);
        if (this.lph >= 1) { this.lph -= Math.floor(this.lph); this.lheld = (this.randL.next() + 1) / 2; }
      }
    }
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
      // the noise: sample-and-hold at NOISE RATE, at 0.9
      this.nph += this.nInc;
      if (this.nph >= 1) { this.nph -= Math.floor(this.nph); this.nheld = this.randN.next(); }
      const N0 = 0.9 * this.nheld;
      let C = 0;
      if (this.clickBuf) {
        const b = this.clickBuf, j = this.cpos | 0;
        if (j < b.length - 1) { const f = this.cpos - j; C = (b[j] + (b[j + 1] - b[j]) * f) * this.clickVol; this.cpos += this.cInc; }
      }
      // routing and the finishing stage by kind (SPEC 5.11)
      const g = this.gain;
      this.gain += this.gStep;
      let y;
      if (this.snarePath) {
        y = T + this.filter.run(N0) * this.nMix + C;
        y = clip(y * this.levelTo * this.velG * g);
      } else {
        const N = N0 * this.nMix;
        let Y = 0;
        if (this.anyIn) Y = this.filter.run(clip((this.tIn ? T : 0) + (this.cIn ? C : 0) + (this.nIn ? N : 0)));
        Y = clip(Y + (this.tIn ? 0 : T) + (this.cIn ? 0 : C) + (this.nIn ? 0 : N));
        if (this.kind === 0) y = clip(Y * g * this.velG);
        else y = clip(Y * this.levelTo * this.velG * g);
      }
      // the drive: S(x, k), k = 2s/(1 - s); in the drum kind its amount glides, then LEVEL (glided)
      let s0 = this.driveTo;
      if (this.kind === 0) { this.driveNow += (this.driveTo - this.driveNow) * this.lvlGlide; s0 = this.driveNow; }
      const kk = 2 * s0 / (1 - s0);
      y = shape(y, kk);
      if (this.kind === 0) { this.levelNow += (this.levelTo - this.levelNow) * this.lvlGlide; y *= this.levelNow; }
      // the crush: sample-and-hold at its rate, no filtering
      if (this.crushOn) { this.crushC += this.crushInc; if (this.crushC >= 1) { this.crushC -= Math.floor(this.crushC); this.crushHeld = y; } y = this.crushHeld; }
      out[i] = y = clip(y);
      // the end of the sound: the envelope done and 50 ms under -90 dB
      if (this.stage === 'done') { if (y > 3e-5 || y < -3e-5) this.quiet = 0; else if (++this.quiet > 0.05 * fs) { this.active = false; out.fill(0, i + 1, n); return; } }
    }
  }
}

// A stand-in voice for the first steps: a plain sine at the sound's pitch that dies away over its DECAY, at its
// LEVEL and velocity. It only keeps the page playable until the real voice (SPEC 5) takes its place; the instrument
// around it doesn't change when it does.
import { noteHz, fineFactor, decayS } from './curves.js?v=mwmd7iyd';

export class StubVoice {
  constructor(fs) { this.fs = fs; this.phase = 0; this.env = 0; this.mul = 0; this.inc = 0; this.gain = 0; this.sound = null; }
  /** a new note: the sound's parameters, the velocity (1..127) and its LEVEL (0..127) */
  trigger(sound, vel, level) {
    this.sound = sound; this.vel = vel; this.level = level;
    this.phase = 0.25; this.env = 1;
    this.set(sound, level);
  }
  /** the ringing sound's parameters changed (a knob turned while it plays) */
  set(sound, level) {
    this.sound = sound; this.level = level;
    const d = decayS(sound.decay);
    this.mul = Number.isFinite(d) ? Math.exp(Math.log(1e-3) / (d * this.fs)) : 1;
    this.inc = noteHz(Math.round(sound.tune)) * fineFactor(sound.fine) / this.fs;
    this.gain = (level / 127) * (sound.velVol ? this.vel / 127 : 1);
  }
  get active() { return this.env > 1e-5; }
  /** adds nothing: writes n samples of the voice into out (mono) */
  render(out, n) {
    let ph = this.phase, env = this.env;
    const inc = this.inc, mul = this.mul, g = this.gain;
    for (let i = 0; i < n; i++) {
      out[i] = -Math.cos(2 * Math.PI * ph) * env * g;
      ph += inc; if (ph >= 1) ph -= 1;
      env *= mul;
    }
    this.phase = ph; this.env = env < 1e-6 ? 0 : env;
  }
}

// The value curves of the sound engine (SPEC section 5 and Appendix A): what a knob value from 0 to 127 means in
// real units. Pure functions, shared by the engine and the screen. A knob value may be fractional.

/** the control tick: envelopes, LFOs and modulation step on it, whatever the audio rate */
export const TICK_S = 64 / 44140;
export const TICK_HZ = 44140 / 64;

/** the shaping function S(x, s) = (1 + s)x / (1 + s|x|). At s = -1 (P CURVE 0) it is 0 inside and 1 at |x| = 1, its
 *  limit there (S(1, s) is 1 for every s) */
export const shape = (x, s) => { const d = 1 + s * Math.abs(x); return d === 0 ? Math.sign(x) : (1 + s) * x / d; };

/** equal temperament, note 69 = 440 Hz, whole notes 0..127 */
export const noteHz = (n) => 440 * Math.pow(2, (Math.min(127, Math.max(0, n)) - 69) / 12);
/** FINE as a linear factor, about ±2.97% (64 is a hair sharp, on purpose) */
export const fineFactor = (fine) => 1 + (fine / 127 - 0.5) * (Math.pow(2, 1 / 12) - 1);
/** the modulators' fixed fine */
export const MOD_FINE = 1.000234;

/** per-tick step of the attack and the pitch envelope (x = value/127): 1 at 0, never at 127 */
export const riseStep = (v) => { const x = v / 127; return Math.min(1, 2 * (1 - x) / (1 + 198 * x)); };
/** per-tick step of the amp decay */
export const decayStep = (v) => { const x = v / 127; return Math.min(1, 2 * (1 - x) / (1 + 1998 * x)); };
/** how long a ramp of that step takes, in seconds (Infinity when it never moves) */
export const rampSeconds = (step) => (step <= 0 ? Infinity : Math.ceil(1 / step - 1e-9) * TICK_S);
export const attackS = (v) => rampSeconds(riseStep(v));
export const decayS = (v) => rampSeconds(decayStep(v));
export const pDecayS = attackS;

/** the shape amount of the amp envelope's decay and attack (CURVE), and the pitch envelope's (P CURVE) */
export const ampCurveA = (v) => (v / 127 - 0.5) * 1.999;
export const decayShape = (v) => { const a = ampCurveA(v); return 2 * a / (1 - a); };
export const attackShape = (v) => { const a = ampCurveA(v); return -2 * a / (1 + a); };
export const pCurveShape = (v) => { const a = Math.min(0.9995, (v / 127 - 0.5) * 2); return 2 * a / (1 - a); };

/** P AMOUNT: the pitch envelope's depth P (the multiplier starts at 1 + P) */
export const pAmountDepth = (v) => 32 * Math.pow(v / 127, 2);

/** CUTOFF in Hz */
export const cutoffHz = (v) => { const x = v / 127; return 9931.5 * 0.05268 * x / (1 - 0.94732 * x); };
/** RESO as the filter's damping R */
export const damping = (v) => { const r = 1 - v / 127; return r < 0.1 ? 0.02 : r; };
/** FLT DRIVE as the filter's input gain */
export const filterGain = (v) => 0.4 + 6 * Math.pow(v / 127, 2);

/** DRIVE as the waveshaper's k */
export const driveK = (v) => { const s = v / 127 - 1 / 128; return 2 * s / (1 - s); };
/** CRUSH as a sample rate in Hz */
export const crushHz = (v) => { const x = v / 127; return 44140 * 0.17652 * x / (1 - 0.82348 * x); };

/** NOISE RATE in Hz */
export const noiseHz = (v) => v / 127 * 22000;
/** CLICK RATE as a playback rate */
export const clickRate = (v) => 0.25 + v / 33.9;

/** LFO RATE in Hz (free running) */
export const lfoHz = (v) => { const y = 1 / 128 + (v / 127) * (127 / 128); return 200 * y * y * y; };
/** LFO SYNC 1..11: cycles per bar's worth (BPM/240 x q) */
export const SYNC_Q = [0, 0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 16, 32];
export const SYNC_NAMES = ['OFF', '4/1', '2/1', '1/1', '1/2', '1/3', '1/4', '1/6', '1/8', '1/12', '1/16', '1/32'];
export const syncHz = (sync, bpm) => bpm / 240 * SYNC_Q[sync];

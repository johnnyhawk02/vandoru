// The voice's filter (SPEC 5.10): a two-pole state-variable filter in the zero-delay-feedback (trapezoidal) form, its
// first integrator's state soft-saturated, giving LP, BP, UNITY BP, HP, NOTCH and PEAK from one state; LP2, a
// separate pair of one-poles with feedback; and OFF. The TYPE dial crossfades two types' outputs (SPEC 6.2).
import { cutoffHz, damping, filterGain } from './curves.js?v=mwme9jly';

// the TYPE dial's settings by position: LP 0, BP 18, UNITY BP 36, HP 54, NOTCH 72, PEAK 90, LP2 108, OFF 126
export const LP = 0, BP = 1, UBP = 2, HP = 3, NOTCH = 4, PEAK = 5, LP2 = 6, OFF = 7;
export function typeDial(v) {
  if (v >= 126) return [OFF, OFF, 0];
  const i = Math.floor(v / 18), t = v / 18 - i;
  return t < 1e-9 ? [i, i, 0] : [i, i + 1, t];
}
const sat = (x) => 2 * Math.tanh(x / 2);
// The filters sit an octave above the CUTOFF curve's frequency: tuned against the compare test, where every
// cutoff multiplier from 1 to 2.5 was tried and 2 matched the reference best, for the SVF and LP2 alike (SPEC 11.2)
export const TUNE = 2;
const clip = (x) => (x > 1 ? 1 : x < -1 ? -1 : x);

export class Filter {
  constructor(fs) { this.fs = fs; this.reset(); this.set(127, 0, 0, 126); }
  reset() { this.s1 = 0; this.s2 = 0; this.a = 0; this.b = 0; }
  /** the knobs (CUTOFF, RESO, FLT DRIVE, TYPE), as they are this control tick */
  set(cutoff, reso, drive, type) {
    const fs = this.fs, fc = cutoffHz(cutoff) * TUNE;
    let R = damping(reso);
    if (fc >= 0.4499 * fs) R = 1;
    this.R = R; this.k = 2 * R;
    this.g = Math.tan(Math.PI * Math.min(fc, 0.4499 * fs) / fs);
    this.h = 1 / (1 + this.k * this.g + this.g * this.g);
    const c = Math.min(1, 2.21 * fc / fs);
    this.c = c; this.fb = (1 - R) * (1.4 + 1 / Math.max(1e-6, 1 - c));
    this.gin = filterGain(drive);
    [this.ta, this.tb, this.tt] = typeDial(type);
    this.needLp2 = this.ta === LP2 || this.tb === LP2;
    this.needSvf = this.ta < LP2 || this.tb < LP2;
  }
  /** one sample through: x in, the filtered sample out (clipped) */
  run(x0) {
    const x = sat(x0 * this.gin);
    let L = 0, B = 0, H = 0, L2 = 0;
    if (this.needSvf) {
      const g = this.g, k = this.k;
      H = (x - (k + g) * this.s1 - this.s2) * this.h;
      B = g * H + this.s1;
      this.s1 = sat(B + g * H);
      L = g * B + this.s2;
      this.s2 = L + g * B;
    }
    if (this.needLp2) {
      this.a = clip(this.a + this.c * ((x - this.a) + this.fb * (this.a - this.b)));
      this.b = clip(this.b + this.c * (this.a - this.b));
      L2 = this.b;
    }
    const out = (t) => {
      switch (t) {
        case LP: return Math.tanh(L);
        case BP: return B;
        case UBP: return this.k * B;
        case HP: return x - this.k * B - L;
        case NOTCH: return x - this.k * B;
        case PEAK: return L - (x - this.k * B - L);
        case LP2: return L2;
        default: return x0;
      }
    };
    let y = out(this.ta);
    if (this.tt > 0) y += (out(this.tb) - y) * this.tt;
    return clip(y);
  }
}

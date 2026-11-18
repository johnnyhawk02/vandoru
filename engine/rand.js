// A small, fast, seedable noise source (xorshift32): uniform in [-1, 1). The same seed gives the same noise.
export class Rand {
  constructor(seed = 0x2545f491) { this.s = seed >>> 0 || 1; }
  next() { let s = this.s; s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; this.s = s; return s / 2147483648 - 1; }
}

// The oscillators' waves (SPEC 5.4): sine, triangle, saw, square, pwm and noise. Triangle, saw and square are
// band-limited tables built from their harmonic series, one table per octave band of the playing frequency, with the
// harmonic counts of the spec (the triangle below 440 Hz with all its audible harmonics) and a smooth roll-off
// towards the top; each is scaled so its peak is full scale.
// pwm is the difference of two band-limited saws. Pure maths, built once at start-up.

export const TABLE = 2048;
const MASK = TABLE - 1;
/** the octave bands' upper edges in Hz, and each wave's harmonic limit in each band */
const EDGES = [440, 880, 1760, 3520, 7040, 14080, Infinity];
const LIMITS = { saw: [45, 28, 16, 9, 5, 2, 1], square: [49, 31, 17, 12, 8, 5, 3], tri: [49, 9, 7, 5, 3, 3, 3] };
export const BANDS = EDGES.length;

// the roll-off: about 0.9 near a third of the limit, 0.4 at the limit
const rolloff = (n, N) => (N <= 1 ? 1 : 1 - 0.6 * Math.pow(n / N, Math.log(6) / Math.log(3)));

function build(kind, N) {
  const t = new Float32Array(TABLE + 1);
  for (let n = 1; n <= N; n++) {
    let a;
    if (kind === 'saw') a = 2 / Math.PI / n;
    else if (n % 2 === 0) continue;
    else a = kind === 'square' ? 4 / Math.PI / n : 8 / (Math.PI * Math.PI) / (n * n);
    a *= rolloff(n, N);
    for (let i = 0; i < TABLE; i++) {
      const x = 2 * Math.PI * n * i / TABLE;
      t[i] += kind === 'tri' ? -a * Math.cos(x) : a * Math.sin(x);
    }
  }
  let pk = 0;
  for (let i = 0; i < TABLE; i++) pk = Math.max(pk, Math.abs(t[i]));
  for (let i = 0; i < TABLE; i++) t[i] /= pk;
  t[TABLE] = t[0];
  return t;
}
/** TABLES.saw[band] etc. */
export const TABLES = Object.fromEntries(Object.entries(LIMITS).map(([k, l]) => [k, l.map((N) => build(k, N))]));
export const SINE = (() => { const t = new Float32Array(TABLE + 1); for (let i = 0; i <= TABLE; i++) t[i] = -Math.cos(2 * Math.PI * i / TABLE); return t; })();

/** the band for a frequency: by its octave, then up while the band's top harmonic would pass Nyquist */
export function bandFor(kind, f, fs) {
  let b = 0;
  while (b < BANDS - 1 && f >= EDGES[b]) b++;
  const lim = LIMITS[kind];
  while (b < BANDS - 1 && lim[b] * f > fs / 2) b++;
  return b;
}

/** read a table at phase p in [0, 1) */
export function read(t, p) {
  const x = p * TABLE, i = x | 0, f = x - i;
  return t[i & MASK] + (t[(i & MASK) + 1] - t[i & MASK]) * f;
}

/** the WAVE dial's settings in kit order (SPEC 4.4) by dial position: 0 sine, 25 tri, 50 saw, 75 square, 100 pwm, 125 noise */
export const W = { SINE: 0, TRI: 1, SAW: 2, SQUARE: 3, PWM: 4, NOISE: 5 };

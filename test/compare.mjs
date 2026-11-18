// node test/compare.mjs [--only id#slot,...] [--set isolateList] [--wav dir] [--json file]
// The main acceptance test (SPEC 11.2): every sound of every kit in the reference pack, decoded by our reader,
// rendered by our engine at 44140 Hz, measured as Appendix B says, and compared with the pack's features. Prints
// how many pass, each row's pass count, and the 20 worst with what failed. Skips when the pack isn't in local/pack/.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { readKit, SLOTS } from '../sound/kitfile.js';
import { renderSound } from '../engine/render.js';
import { measure, FS } from './measure.mjs';

const pack = new URL('../local/pack/', import.meta.url);
if (!existsSync(new URL('reference/index.json', pack))) { console.log('skip: the reference pack is not in local/pack/'); process.exit(0); }
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const index = JSON.parse(readFileSync(new URL('reference/index.json', pack)));
let only = arg('--only') ? new Set(arg('--only').split(',')) : null;
if (arg('--set')) only = new Set(JSON.parse(readFileSync(new URL('reference/isolate.json', pack)))[arg('--set')]);
const wavDir = arg('--wav');

const ROWS = ['loud v100', 'loud v30', 'length', 'envelope', 'spectrum', 'spectrum 100ms', 'pitch'];
const LIMIT = { 'loud v100': 1.5, 'loud v30': 2, length: 1, envelope: 3, spectrum: 3, 'spectrum 100ms': 4, pitch: 0.5 };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const toP = (db) => Math.pow(10, db / 10), toDb = (p) => 10 * Math.log10(p + 1e-30);
function avgBands(frames, upto = frames.length) {
  const f = frames.slice(0, Math.max(1, upto)), o = new Array(29).fill(0);
  for (const b of f) b.forEach((v, i) => { o[i] += toP(v); });
  return o.map((p) => toDb(p / f.length));
}
function bandDiff(ref, got) {
  const top = Math.max(...ref), use = ref.map((v, i) => i).filter((i) => ref[i] >= top - 40);
  return mean(use.map((i) => Math.abs(Math.max(got[i], -100) - ref[i])));
}

const results = [];
for (const k of index) {
  const kit = readKit(readFileSync(new URL('kits/' + k.file, pack)));
  const feat = JSON.parse(readFileSync(new URL(`reference/features/${k.id}.json`, pack))).sounds;
  for (const slot of SLOTS) {
    const id = `${k.id}#${slot}`;
    if (only && !only.has(id)) continue;
    const s = kit.sounds[slot], ref = feat[slot];
    const secs = Math.min(4, (ref.v100.lengthMs * 1.25 + 150) / 1000);
    const a = renderSound(s, { vel: 100, level: s.level, fs: FS, seconds: secs }), m = measure(a);
    const m30 = measure(renderSound(s, { vel: 30, level: s.level, fs: FS, seconds: secs }), { bands: false });
    const R = ref.v100, d = {};
    d['loud v100'] = m.loud100Db - R.loud100Db;
    d['loud v30'] = m30.loud100Db - ref.v30.loud100Db;
    const dl = m.lengthMs - R.lengthMs; d.length = Math.abs(dl) <= 20 ? 0 : Math.abs(dl) / (0.15 * R.lengthMs); d.lengthMs = dl;
    const etop = Math.max(...R.env5ms), ei = R.env5ms.map((v, i) => i).filter((i) => R.env5ms[i] >= etop - 50);
    d.envelope = mean(ei.map((i) => Math.abs((m.env5ms[i] ?? -120) - R.env5ms[i])));
    d.spectrum = bandDiff(avgBands(R.bands20ms), avgBands(m.bands20ms.slice(0, R.bands20ms.length).concat(Array(Math.max(0, R.bands20ms.length - m.bands20ms.length)).fill(Array(29).fill(-100)))));
    d['spectrum 100ms'] = bandDiff(avgBands(R.bands20ms, 6), avgBands(m.bands20ms, 6));
    const pd = [];
    R.pitch20ms.forEach((p, i) => { const q = m.pitch20ms[i]; if (p && q) pd.push(12 * Math.log2(q / p)); });
    d.pitch = Math.abs(median(pd));
    const spectrumOnly = (s.lfoWave === 5 && s.lfoAmount > 0 && s.lfoDest) || s.wave >= 125 || s.noise >= 96;
    const fails = ROWS.filter((r) => (!spectrumOnly || r.startsWith('spectrum')) && Math.abs(d[r]) > LIMIT[r]);
    const bad = fails.reduce((x, r) => x + Math.abs(d[r]) / LIMIT[r], 0);
    results.push({ id, name: k.name, slot, d, fails, bad, spectrumOnly });
    if (wavDir) { mkdirSync(wavDir, { recursive: true }); writeFileSync(`${wavDir}/${id.replace('#', '--')}--ours.wav`, wav(a)); }
  }
}

function wav(x) {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(FS, 24); b.writeUInt32LE(FS * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  return b;
}

const pass = results.filter((r) => !r.fails.length).length, n = results.length;
console.log(`compare: ${pass} of ${n} sounds pass every row (${(100 * pass / n).toFixed(1)}%)`);
for (const r of ROWS) console.log(`  ${r.padEnd(15)} ${results.filter((x) => !x.fails.includes(r)).length} pass`);
const loud6 = results.filter((r) => Math.abs(r.d['loud v100']) > 6 || Math.abs(r.d['loud v30']) > 6).length;
console.log(`  loudness off by more than 6 dB: ${loud6}`);
const f = (x) => (Math.round(x * 10) / 10).toFixed(1);
console.log('the 20 worst:');
for (const r of [...results].sort((a, b) => b.bad - a.bad).slice(0, 20)) {
  console.log(`  ${r.id.padEnd(40)} ${r.fails.map((x) => x === 'length' ? `length ${r.d.lengthMs > 0 ? '+' : ''}${r.d.lengthMs}ms` : `${x} ${x.startsWith('loud') && r.d[x] > 0 ? '+' : ''}${f(r.d[x])}`).join(', ')}`);
}
if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify(results, null, 1));

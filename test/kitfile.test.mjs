// node test/kitfile.test.mjs: the kit reader (sound/kitfile.js). Every kit of the reference pack decodes exactly as
// local/pack/reference/expected/ says (skipped when the pack isn't there), and hand-made files: short, long, an
// empty name, out-of-range bytes, a target on another voice, user-sample waves and clicks.
import { readFileSync, existsSync } from 'node:fs';
import { readKit, kitName, SLOTS } from '../sound/kitfile.js';
import { PARAM_IDS } from '../sound/params.js';
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };

const pack = new URL('../local/pack/', import.meta.url);
if (!existsSync(new URL('reference/index.json', pack))) console.log('skip: the reference pack is not in local/pack/ (the exact decode test needs it)');
else {
  const index = JSON.parse(readFileSync(new URL('reference/index.json', pack)));
  let kits = 0, fields = 0, wrong = 0;
  for (const k of index) {
    const got = readKit(readFileSync(new URL('kits/' + k.file, pack)));
    const want = JSON.parse(readFileSync(new URL(`reference/expected/${k.id}.json`, pack)));
    kits++;
    if (got.name !== want.name) { wrong++; if (wrong < 30) console.log('FAIL', k.id, 'name', got.name, want.name); }
    for (const slot of SLOTS) for (const f in want.sounds[slot]) {
      fields++;
      if (got.sounds[slot][f] !== want.sounds[slot][f]) { wrong++; if (wrong < 30) console.log('FAIL', k.id, slot, f, 'got', got.sounds[slot][f], 'want', want.sounds[slot][f]); }
    }
    for (const slot of SLOTS) for (const f in got.sounds[slot]) if (!(f in want.sounds[slot])) { wrong++; if (wrong < 30) console.log('FAIL', k.id, slot, 'extra field', f); }
  }
  checks++; if (wrong) fails++;
  console.log(`pack: ${kits} kits, ${fields} fields, ${wrong} wrong`);
}

// hand-made kits
const full = () => { const b = new Uint8Array(255); b.set([...'TESTKIT '].map((c) => c.charCodeAt(0))); return b; };
{ const k = readKit(full());
  ok(k.name === 'TESTKIT' && SLOTS.every((s) => k.sounds[s]), 'a plain kit: ' + k.name);
  ok(SLOTS.every((s) => PARAM_IDS.filter((id) => id !== 'kind').every((id) => id in k.sounds[s])), 'every sound has every parameter');
  ok(k.sounds.snare.toneIn === false && k.sounds.snare.clickIn === false && k.sounds.metal.clickIn === false && k.sounds.drum1.clickIn === true, 'the routing constants');
  ok(k.sounds.metal.fmEnv === 0 && k.sounds.drum2.fmEnv === 127 && k.sounds.snare.aAmount === 0, 'the FM ENV and snare constants'); }
ok(readKit(new Uint8Array(8)) === null && readKit(new Uint8Array(9)) !== null, 'under 9 bytes is not a kit');
{ const b = new Uint8Array(20); b.set([65, 66, 0, 0, 0, 0, 0, 0]); const k = readKit(b);
  ok(k.name === 'AB' && k.sounds.drum1.decay === 40 && k.sounds.drum1.cutoff === 127 && k.sounds.hatOpen.level === 100 && k.sounds.drum1.tune === b[16], 'a short file takes the defaults: ' + JSON.stringify(k.sounds.drum1).slice(0, 80)); }
{ const b = new Uint8Array(400); b.set(full()); ok(JSON.stringify(readKit(b)) === JSON.stringify(readKit(full())), 'a long file: extra bytes ignored'); }
ok(kitName(new Uint8Array([0, 0, 0, 1, 2, 3, 0, 0])) === 'EMPTY' && kitName(new Uint8Array([7, 72, 73, 200, 32, 0, 0, 0])) === 'HI', 'names: printable only, trimmed, empty is EMPTY');
{ const b = full();
  b[8 + 1] = 6; b[8 + 20] = 9; b[8 + 2] = 4; b[8 + 3] = 5; // drum 1 a user sample, its A WAVE too; drum 2 noise; drum 3 pwm
  b[8 + 203] = 17; b[8 + 204] = 1; b[8 + 191] = 12; b[8 + 192] = 6; // clicks: a user sample (17 -> 3), PHASE; types: >7 -> OFF, LP2
  b[8 + 37] = 200; b[8 + 155] = 9; b[8 + 179] = 30; b[8 + 134] = 5; // out of range: cutoff, LFO wave, sync; A MODE anything -> MIX
  b[8 + 167] = 22; b[8 + 168] = 22; b[8 + 149] = 1; // drum 1 LFO -> its own CUTOFF; drum 2's LFO -> drum 1's CUTOFF (none); VEL DEST the kit-wide byte (none)
  b[8 + 172] = 196; b[8 + 154] = 197; b[8 + 170] = 135; b[8 + 171] = 500 % 256; // the hat's closed and open decay; the snare's CUTOFF; past the end
  b[8 + 173] = 1; b[8 + 174] = 1; // RETRIG: drum 1 by itself (on), drum 2 by drum 1 (off)
  const k = readKit(b), s = k.sounds;
  ok(s.drum1.wave === 0 && s.drum1.aWave === 0 && s.drum2.wave === 125 && s.drum3.wave === 100, 'waves: user samples as sine, kit order to dial positions');
  ok(s.drum1.click === 3 && s.drum2.click === 1, 'clicks: a user sample modulo 14');
  ok(s.drum1.type === 126 && s.drum2.type === 108, 'types: past 7 is OFF, LP2 at 108');
  ok(s.drum1.cutoff === 127 && s.drum1.lfoWave === 7 && s.drum1.lfoSync === 11 && s.drum1.aMode === 127, 'out of range to the nearest');
  ok(s.drum1.lfoDest === 'cutoff' && s.drum2.lfoDest === null && s.drum1.velDest === null, 'targets: own, another voice\'s, the kit-wide byte');
  ok(s.hatClosed.lfoDest === 'decay' && s.hatOpen.lfoDest === null && s.hatOpen.velDest === 'decay' && s.hatClosed.velDest === null, 'the hat\'s two decays as targets');
  ok(s.snare.lfoDest === 'cutoff' && s.metal.lfoDest === null, 'snare target; an index past the list is none: ' + s.metal.lfoDest);
  ok(s.drum1.retrig === true && s.drum2.retrig === false, 'RETRIG only by the voice itself'); }

console.log(fails ? `${fails} of ${checks} checks failed` : `ok: ${checks} checks`);
process.exit(fails ? 1 : 0);

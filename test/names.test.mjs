// node test/names.test.mjs: the preset names (app/names.js). New words spliced from pieces of the word lists: sayable
// (consonants and vowels in turn at every join), never a word of the lists, varied, not a name already taken, and
// always a mix of two lists.
import { WORDS, runs, pieces, jumble, spliced, presetName } from '../app/names.js';
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
// a seeded generator, so a failure can be seen again
const seeded = (s) => () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };

// the lists: at least a hundred words each, lower case letters only, none twice
for (const [theme, list] of Object.entries(WORDS)) {
  ok(list.length >= 100, `${theme}: ${list.length} words`);
  ok(list.every((w) => /^[a-z]{3,}$/.test(w)), `${theme}: a word that isn't plain letters: ${list.filter((w) => !/^[a-z]{3,}$/.test(w))}`);
  ok(new Set(list).size === list.length, `${theme}: a word twice: ${list.filter((w, i) => list.indexOf(w) !== i)}`);
}
ok(['space', 'physics', 'tolkien', 'fantasy', 'alien', 'myth'].every((t) => t in WORDS), 'the six lists: ' + Object.keys(WORDS));
{ const all = Object.values(WORDS).flat(), twice = all.filter((w, i) => all.indexOf(w) !== i);
  ok(twice.length === 0, 'a word in two lists: ' + twice); }

// a word as runs, and its pieces
ok(runs('quasar').map((r) => r.text).join('|') === 'qu|a|s|a|r', 'quasar: ' + runs('quasar').map((r) => r.text).join('|'));
ok(runs('yoyo').map((r) => r.text).join('|') === 'y|oyo', 'a leading y is a consonant: ' + runs('yoyo').map((r) => r.text).join('|'));
{ const p = pieces('nebula');
  ok(p.heads.join() === 'ne,nebu' && p.tails.join() === 'bula,la' && p.mids.join() === 'bu', 'nebula: ' + JSON.stringify(p)); }
{ const all = Object.values(WORDS).flat(), vowel = /[aeiouy]/, cons = /[^aeiou]/;
  let bad = 0;
  for (const w of all) { const p = pieces(w);
    for (const h of p.heads) if (!w.startsWith(h) || h === w || !vowel.test(h.slice(-1)) || !cons.test(h)) bad++;
    for (const t of p.tails) if (!w.endsWith(t) || t === w || vowel.test(t[0]) && t[0] !== 'y' || !vowel.test(t)) bad++;
    for (const m of p.mids) if (!w.slice(1, -1).includes(m) || !vowel.test(m.slice(-1)) || vowel.test(m[0])) bad++; }
  ok(bad === 0, `${bad} pieces that aren't a start ending in a vowel, a middle, or an end starting with a consonant`); }

// names: capitals, one word or two, the right lengths, never a list word, plenty of them
{ const rng = seeded(20261117), words = new Set(Object.values(WORDS).flat()), names = [];
  for (let i = 0; i < 3000; i++) names.push(presetName(rng));
  const shape = names.filter((n) => !/^[A-Z]{6,10}$/.test(n) && !/^[A-Z]{4,7} [A-Z]{4,7}$/.test(n));
  ok(shape.length === 0, 'names of the wrong shape: ' + shape.slice(0, 5).join(', '));
  ok(names.every((n) => n.length <= 18), 'a name longer than 18');
  const parts = names.flatMap((n) => n.toLowerCase().split(' '));
  ok(parts.every((w) => !words.has(w)), 'a name that is just a word of the lists: ' + parts.filter((w) => words.has(w)).slice(0, 5));
  ok(parts.every((w) => !/(.)\1\1/.test(w) && /[aeiouy]/.test(w)), 'a part with a letter three times or no vowel');
  ok(parts.every((w) => !/[^aeiouy]{5,}/.test(w)), 'five consonants in a row: ' + parts.filter((w) => /[^aeiouy]{5,}/.test(w)).slice(0, 5));
  const distinct = new Set(names).size, two = names.filter((n) => n.includes(' ')).length / names.length;
  ok(distinct > 2850, `only ${distinct} different names in 3000`);
  ok(two > 0.35 && two < 0.55, `two-word names: ${Math.round(two * 100)}%`);
  console.log('  e.g.', names.slice(0, 14).join(' · ')); }

// every word is a mix: its start and its end come from two different lists, and every list is in the mix about as
// much as it has words
{ const rng = seeded(4242), themes = Object.keys(WORDS), starts = {}, ends = {}; let same = 0, wrong = 0, N = 6000;
  for (let i = 0; i < N; i++) { const s = spliced(rng), a = s.from[0], z = s.from[s.from.length - 1];
    if (a === z) same++; if (!themes.includes(a) || !themes.includes(z) || s.from.length < 2 || s.from.length > 3 || !/^[a-z]{5,10}$/.test(s.word)) wrong++;
    starts[a] = (starts[a] || 0) + 1; ends[z] = (ends[z] || 0) + 1; }
  ok(same === 0, `${same} words with the start and the end from one list`);
  ok(wrong === 0, `${wrong} words of the wrong shape or from no list`);
  for (const t of themes) ok(starts[t] > N / themes.length / 2 && ends[t] > N / themes.length / 2, `${t} starts ${starts[t]} and ends ${ends[t]} of ${N} words`);
  ok(spliced(seeded(5), 5, 10, { one: WORDS.space }).from.every((f) => f === 'one'), 'one list alone still makes words'); }

// a name in use isn't given again; the same seed gives the same names; another theme joins in
{ const first = presetName(seeded(7)), again = presetName(seeded(7)), other = presetName(seeded(7), new Set([first]));
  ok(first === again, 'the same seed, another name');
  ok(other !== first, 'a taken name given again'); }
{ const lists = { ...WORDS, sea: ['kelpforest', 'anemone', 'barnacle', 'cuttlefish'] }, rng = seeded(99); let seen = 0;
  for (let i = 0; i < 4000 && !seen; i++) if (/KELPFO|NEMONE|RNACLE|TTLEFISH|ANEMO|BARNA|CUTTLE/.test(jumble(rng, 5, 10, lists).toUpperCase())) seen++;
  ok(seen > 0, 'a new theme\'s words never show up');
  ok(/^[a-z]{5,10}$/.test(jumble(seeded(3))), 'jumble: one lower-case word'); }

console.log(fails ? `${fails} of ${checks} checks failed` : `ok: ${checks} checks`);
process.exit(fails ? 1 : 0);

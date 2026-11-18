// node test/names-clean.test.mjs: no file or folder name and no file in the repo (outside .git, local/ and
// node_modules/) may contain any of the four names this project must never carry, in any letter case. The words are
// kept reversed here so this file doesn't match itself.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const words = ['rxl', 'xfa', 'rixile', 'acire'].map((w) => [...w].reverse().join(''));
const re = new RegExp(words.join('|'), 'i');
const skip = new Set(['.git', 'local', 'node_modules']);
const hits = [];
let files = 0;
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (dir === root && skip.has(name)) continue;
    if (name === 'node_modules') continue;
    const p = join(dir, name), rel = relative(root, p);
    if (re.test(name)) hits.push(`${rel}: in the name`);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    files++;
    const text = readFileSync(p).toString('latin1');
    text.split('\n').forEach((line, i) => { if (re.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`); });
  }
})(root);
for (const h of hits) console.log('FAIL', h);
console.log(hits.length ? `${hits.length} banned names found in ${files} files` : `ok: ${files} files clean`);
process.exit(hits.length ? 1 : 0);

// node tools/stamp.mjs: a new version stamp (?v=...) on every app module and stylesheet URL, so a browser holding older
// files in its cache (GitHub Pages caches for 10 minutes) loads the whole new set together, never a mix of old and new.
// Run it before each commit that changes the page.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const v = Date.now().toString(36);
const js = (dir) => readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => `${dir}/${f}`);
for (const f of ['index.html', ...js('app'), ...js('sound'), ...js('engine')]) {
  const s = readFileSync(f, 'utf8'), t = s.replace(/\?v=[0-9a-z]+/g, '?v=' + v);
  if (t !== s) writeFileSync(f, t);
}
console.log('stamped', v);

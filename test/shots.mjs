// node test/shots.mjs [url] [outdir]: the page in a real browser (Playwright). Screenshots at the laptop sizes and the
// phone sizes, and checks that every knob sits on the shared columns, nothing scrolls, the longest message fits, and
// the flows work: play, knob drag, double-click back, dice, alter, lock, padlocks, copy and paste, undo, presets
// (save, load, export, import), ENGINES 1 to 6, the phone's pads with two fingers. Fails on any page error.
// Serve the repo first, for example: python3 -m http.server 8123
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] || 'http://127.0.0.1:8123/';
const out = process.argv[3] || 'local/shots';
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
let errors = 0;
const J = JSON.stringify;
const bad = (what, ...x) => { errors++; console.log('FAIL', what, J(x).slice(0, 600)); };

for (const [w, h] of [[1440, 900], [1280, 800], [1440, 760], [1280, 700]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, acceptDownloads: true });
  p.on('pageerror', (e) => bad(`${w}x${h} page error`, e.message));
  p.on('console', (m) => { if (m.type() === 'error') bad(`${w}x${h} console`, m.text()); });
  const turn = async (el, up, dy = 14) => { const r = await el.boundingBox(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    await p.mouse.move(x, y); await p.mouse.down(); for (let i = 1; i <= 4; i++) await p.mouse.move(x, y + (up ? -1 : 1) * dy * i / 4); await p.mouse.up(); };
  await p.goto(url); await p.waitForFunction(() => window.appReady);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.appReady);
  await p.click('#start-btn'); await p.waitForTimeout(300);
  for (const n of [50, 60, 70]) { await p.evaluate((n) => window.app.noteOn(1, n, 110), n); await p.waitForTimeout(60); }
  await p.evaluate(() => window.app.noteOn(1, 49, 100)); await p.waitForTimeout(100);

  // the layout: nothing scrolls, the screen is inside the window, every knob on the columns of the first row
  const lay = await p.evaluate(() => {
    const r = (e) => e.getBoundingClientRect(), cx = (e) => Math.round(r(e).left + r(e).width / 2);
    const rows = [...document.querySelectorAll('#faders .sect')].reduce((m, s) => { const k = s.style.gridArea.split('/')[0].trim(); (m[k] ||= []).push(s); return m; }, {});
    const cols = [...rows['1'].flatMap((s) => [...s.querySelectorAll('.vf .knob, .vf .swb')])].map(cx);
    const all = [...document.querySelectorAll('#faders .vf:not(.big) .knob, #faders .vf .swb')].map(cx);
    const off = all.filter((x) => !cols.some((c) => Math.abs(c - x) <= 1));
    const sc = r(document.getElementById('screen'));
    return { scroll: [document.documentElement.scrollWidth > innerWidth, document.documentElement.scrollHeight > innerHeight], off, cols: cols.length,
      inside: sc.right <= innerWidth + 1 && sc.bottom <= innerHeight + 1, knobs: all.length };
  });
  if (lay.scroll[0] || lay.scroll[1] || lay.off.length || lay.cols !== 16 || !lay.inside) bad(`${w}x${h} layout`, lay);
  // the longest message fits on the status line
  const fits = await p.evaluate(() => {
    const d = document.getElementById('detail'), was = d.innerHTML;
    d.innerHTML = 'ENGINE 6 C#4: a new <em>closed hat</em>, RAMPATORY · locked <em>12 locked knobs</em> kept (UNDO takes it back)';
    const ok = d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().right <= document.getElementById('zones').getBoundingClientRect().left + 1;
    d.innerHTML = was; return ok;
  });
  if (!fits) bad(`${w}x${h} the longest message doesn't fit`);
  await p.screenshot({ path: `${out}/main-${w}x${h}.png` });
  if (w !== 1440 || h !== 900) { await p.close(); continue; }

  // the flows, once, at the main size
  const st = () => p.evaluate(() => { const S = window.app.state(), k = S.keys[window.app.place()]; return { place: window.app.place(), sel: S.sel, name: k.sound.name, decay: k.sound.params.decay, edits: Object.keys(k.edits), lock: k.lock, send: k.out.send, undo: window.app.undoDepth(), msg: document.getElementById('detail').textContent, head: document.getElementById('kh-info').textContent }; });
  const s0 = await st();
  if (s0.place !== 1 || s0.sel !== 0) bad('playing a key picks it', s0);
  // a knob: drag up turns it up, the label lights, the notch shows, double-click puts it back; the wheel never moves it
  const decay = p.locator('#faders .vf', { hasText: 'DECAY' }).filter({ hasNotText: 'P DECAY' }).locator('.knob');
  await turn(decay, true, 40); const s1 = await st();
  if (!(s1.decay > s0.decay) || !s1.edits.includes('decay') || !/DECAY/.test(s1.msg) || !/1 edit/.test(s1.head)) bad('knob drag', s0.decay, s1);
  const box = await decay.boundingBox(); await p.mouse.move(box.x + 20, box.y + 20); await p.mouse.wheel(0, -300); await p.waitForTimeout(50);
  if ((await st()).decay !== s1.decay) bad('the wheel moved a knob');
  await decay.dblclick(); const s2 = await st();
  if (s2.decay !== s0.decay || s2.edits.length) bad('double-click back', s2);
  // a drag that misses its release ends on the next move with the button up
  { const r = await decay.boundingBox(); await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await p.mouse.down();
    await p.mouse.move(r.x + r.width / 2, r.y - 20); await p.evaluate(() => window.dispatchEvent(new Event('blur'))); const a = (await st()).decay;
    await p.mouse.move(r.x + r.width / 2, r.y - 120); const z = (await st()).decay; await p.mouse.up();
    if (a !== z) bad('a drag went on after the window lost focus', a, z); }
  // the dice, alter, undo
  const u0 = (await st()).undo;
  await p.click('#rand-key'); await p.waitForTimeout(150); const s3 = await st();
  await p.click('#alter-key'); await p.waitForTimeout(150); const s4 = await st();
  await p.click('#undo'); await p.waitForTimeout(100); await p.click('#undo'); await p.waitForTimeout(100); const s5 = await st();
  if (s3.name === s2.name || !s3.msg.includes(s3.name) || !/altered/.test(s4.msg) || s5.name !== s2.name || s5.undo !== u0) bad('dice, alter, undo', s2.name, s3.name, s4.msg, s5);
  // LOCK KEY: the dice can't change it, the knobs are veiled
  await p.click('#lock-key'); const l1 = await st(); await p.keyboard.press('k'); await p.waitForTimeout(100); const l2 = await st();
  const veiled = await p.evaluate(() => document.getElementById('screen').classList.contains('keylocked'));
  await p.click('#lock-key');
  if (!l1.lock || l2.name !== l1.name || !veiled || !/locked/.test(l2.msg)) bad('lock key', l1, l2, veiled);
  // a knob padlock keeps its knob through RANDOM on every key of the engine
  await p.locator('#faders .vf', { hasText: 'TUNE' }).locator('.lock').click();
  const tunes = () => p.evaluate(() => { const S = window.app.state(); return S.keys.slice(0, 8).map((k) => k.sound.params.tune); });
  const t0 = await tunes(); await p.click('#menu-btn'); await p.click('#scatter'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  const t1 = await tunes(), names1 = await p.evaluate(() => window.app.state().keys.slice(0, 8).map((k) => k.sound.name));
  if (J(t0) !== J(t1) || !/TUNE/.test((await st()).msg)) bad('padlock through RANDOM', t0, t1, (await st()).msg);
  await p.click('#menu-btn'); await p.click('#lock-none'); await p.keyboard.press('Escape');
  // copy and paste
  await p.keyboard.press('Meta+c'); await p.keyboard.press('ControlOrMeta+c'); const from = (await st()).name;
  await p.keyboard.press(']'); await p.waitForTimeout(80); await p.keyboard.press('ControlOrMeta+v'); await p.waitForTimeout(100); const c1 = await st();
  if (c1.name !== from || c1.place !== 2 || !/pasted/.test(c1.msg)) bad('copy and paste', from, c1);
  // ENGINES 1 to 6: the strip's groups and the engine tabs follow; every key keeps its sound
  const sounds = () => p.evaluate(() => window.app.state().keys.map((k) => k.sound.name).join());
  const before = await sounds();
  for (const n of [1, 2, 4, 5, 6, 3]) {
    await p.click('#settings-btn');
    while (Number(await p.textContent('#engines')) !== n) await p.click(Number(await p.textContent('#engines')) < n ? '#eng-up' : '#eng-down');
    await p.keyboard.press('Escape');
    const g = await p.evaluate(() => [document.querySelectorAll('#keystrip .kgroup').length, [...document.querySelectorAll('#sounds .snd')].filter((b) => !b.hidden).length, document.querySelectorAll('.pad').length]);
    if (g[0] !== n || g[1] !== n || g[2] !== 25) bad('engines', n, g);
    if (n === 6) await p.screenshot({ path: `${out}/engines6-${w}x${h}.png` });
  }
  if (await sounds() !== before) bad('changing ENGINES changed the sounds');
  // presets: save, change, the mark, revert, save as new, export, import, delete
  await p.click('#preset-btn'); await p.click('#preset-save'); await p.waitForTimeout(350);
  const P = () => p.evaluate(() => ({ n: window.app.presets.list().length, dirty: window.app.presets.dirty(), mark: document.getElementById('preset-mark').textContent, name: document.getElementById('preset-name').textContent }));
  const p1 = await P(); await p.keyboard.press('Escape');
  await p.click('#rand-key'); await p.waitForTimeout(400); const p2 = await P();
  await p.click('#preset-btn'); await p.click('#preset-revert'); await p.waitForTimeout(400); const p3 = await P();
  if (p1.n !== 1 || p1.dirty || p2.mark !== '*' || p3.dirty) bad('presets save, mark, revert', p1, p2, p3);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#preset-export')]);
  const file = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  if (file.app !== 'vandoru' || file.kind !== 'presets' || file.items.length !== 1) bad('export', file.app, file.kind);
  const del = p.locator('.prow .pdel').first(); await del.click(); await del.click(); await p.waitForTimeout(350);
  const p4 = await P(); const added = await p.evaluate((t) => window.app.presets.import(t), JSON.stringify(file)); const p5 = await P();
  const evil = JSON.stringify({ app: 'vandoru', kind: 'presets', version: 1, items: [{ id: 'abcdefg', name: '<img src=x onerror=alert(1)>', data: { ...file.items[0].data, keys: file.items[0].data.keys.map((k) => ({ ...k, sound: { ...k.sound, name: '<b>x</b>' } })) } }] });
  await p.evaluate((t) => window.app.presets.import(t), evil);
  const clean = await p.evaluate(() => window.app.presets.list().every((x) => !/[<>]/.test(x.name) && x.data.keys.every((k) => !/[<>]/.test(k.sound.name))));
  if (p4.n !== 0 || added !== 1 || p5.n !== 1 || !clean) bad('delete, import, sanitise', p4, added, p5, clean);
  await p.keyboard.press('Escape');
  // the FX + MASTER tab
  await p.keyboard.press('f'); await p.waitForTimeout(100);
  const fx = await p.evaluate(() => [document.getElementById('fxside').hidden, document.querySelectorAll('#fxglobal .vf').length]);
  await p.screenshot({ path: `${out}/fx-${w}x${h}.png` });
  await p.keyboard.press('f');
  if (fx[0] || fx[1] < 10) bad('the FX tab', fx);
  // the menus, for the screenshots
  await p.click('#menu-btn'); await p.screenshot({ path: `${out}/random-${w}x${h}.png` }); await p.keyboard.press('Escape');
  await p.click('#settings-btn'); await p.screenshot({ path: `${out}/settings-${w}x${h}.png` }); await p.keyboard.press('Escape');
  await p.close();
}

// THE PHONE: 25 pads on a five-column grid, nothing scrolls; pads play, two fingers at once; NEW SOUND and UNDO
for (const [w, h] of [[412, 915], [412, 780], [360, 640]]) {
  const cx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await cx.newPage(), cdp = await cx.newCDPSession(p);
  p.on('pageerror', (e) => bad(`phone ${w}x${h} page error`, e.message));
  await p.goto(url); await p.waitForFunction(() => window.appReady); await p.waitForTimeout(300);
  const lay = await p.evaluate(() => { const r = (e) => e.getBoundingClientRect(), pads = [...document.querySelectorAll('#pv-pads .pad')], xs = [...new Set(pads.map((e) => Math.round(r(e).left)))];
    return { phone: document.documentElement.classList.contains('phone'), pads: pads.length, cols: xs.length, small: pads.filter((e) => r(e).width < 44 || r(e).height < 44).length,
      scroll: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight],
      out: [...document.querySelectorAll('#pv > *, #pv button, #pv .track')].filter((e) => r(e).left < 0 || r(e).right > innerWidth + 0.5 || r(e).bottom > innerHeight + 0.5).map((e) => e.id || e.className) }; });
  if (!lay.phone || lay.pads !== 25 || lay.cols !== 5 || lay.small || lay.scroll[0] > 0 || lay.scroll[1] > 0 || lay.out.length) bad(`phone ${w}x${h} layout`, lay);
  await p.tap('#start-btn'); await p.waitForTimeout(300);
  const mid = async (sel, n = 0) => { const r = await p.locator(sel).nth(n).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  const a2 = await mid('.pad', 2), a20 = await mid('.pad', 20);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a2.x, y: a2.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a2.x, y: a2.y, id: 1 }, { x: a20.x, y: a20.y, id: 2 }] }); await p.waitForTimeout(150);
  const two = await p.evaluate(() => [document.querySelectorAll('.pad.down').length, window.app.place()]);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(150);
  const none = await p.evaluate(() => document.querySelectorAll('.pad.down').length);
  if (two[0] !== 2 || two[1] !== 20 || none !== 0) bad(`phone ${w}x${h} two fingers`, two, none);
  const name = () => p.evaluate(() => window.app.state().keys[window.app.place()].sound.name);
  const n0 = await name(); await p.tap('#pv-dice'); await p.waitForTimeout(200); const n1 = await name();
  await p.tap('#pv-undo'); await p.waitForTimeout(150); const n2 = await name();
  if (n1 === n0 || n2 !== n0) bad(`phone ${w}x${h} new sound and undo`, n0, n1, n2);
  const r = await p.locator('#pv-reverb .track').boundingBox(); await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await p.waitForTimeout(100);
  const send = await p.evaluate(() => window.app.state().keys[window.app.place()].out.send);
  if (Math.abs(send - 64) > 4) bad(`phone ${w}x${h} reverb bar`, send);
  await p.screenshot({ path: `${out}/phone-${w}x${h}.png` });
  await cx.close();
}
await b.close();
console.log(errors ? `${errors} problems` : 'ok: no problems');
process.exit(errors ? 1 : 0);

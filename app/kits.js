// KITS (SPEC 8.2): kit files imported from Johnny's disk, kept in this browser (IndexedDB), never in the repo. Each
// file is read (sound/kitfile.js), its sounds named and typed, and kept with its bytes and their hash (the same file
// twice is one kit). The KITS menu lists them: hear a sound, put it on the key played last, deal a whole kit onto an
// engine, change a sound's type, delete a kit.
import { $ } from './widgets.js?v=mwmdta0r';
import { readKit, READER_VERSION, SLOT_NAMES } from '../sound/kitfile.js?v=mwmdta0r';
import { tidyParams, noteName } from '../sound/params.js?v=mwmdta0r';
import { guessType } from '../sound/types.js?v=mwmdta0r';
import { jumble } from './names.js?v=mwmdta0r';
import { TYPES, cleanLabel } from './patch.js?v=mwmdta0r';

// the sounds a kit gives the app: the closed hat is decoded but not used (Johnny: open hats only)
const USED = ['drum1', 'drum2', 'drum3', 'snare', 'metal', 'hatOpen'];

// ---- IndexedDB: one store of kits, by hash ----
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((ok, no) => {
    const r = indexedDB.open('vandoru', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kits', { keyPath: 'hash' });
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  return dbp;
}
const tx = async (mode, fn) => { const d = await db(); return new Promise((ok, no) => { const t = d.transaction('kits', mode), s = t.objectStore('kits'), r = fn(s); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); }); };
const allKits = () => tx('readonly', (s) => s.getAll());
const putKit = (k) => tx('readwrite', (s) => s.put(k));
const delKit = (hash) => tx('readwrite', (s) => s.delete(hash));

async function sha(bytes) {
  if (crypto.subtle) { const h = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
  let h = 2166136261; for (const b of bytes) { h ^= b; h = Math.imul(h, 16777619) >>> 0; } return 'f' + h.toString(16).padStart(8, '0') + bytes.length;
}
const seeded = (s) => () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };

/** a kit record's sounds for the library (names seeded by the file's hash and the slot, so the same file names its
 *  sounds the same way every time), avoiding the names in use */
function kitSounds(rec, taken) {
  const kit = readKit(Uint8Array.from(rec.bytes));
  return USED.map((slot, i) => {
    const p = kit.sounds[slot], rng = seeded((parseInt(rec.hash.slice(0, 8), 16) ^ (i * 0x9e3779b9)) >>> 0 || 1);
    let name; do name = jumble(rng, 5, 9).toUpperCase(); while (taken.has(name)); taken.add(name);
    const type = TYPES.includes(rec.types?.[i]) ? rec.types[i] : guessType(slot, p);
    const snd = { v: 1, name, type, kind: p.kind, from: { kit: kit.name, slot: SLOT_NAMES[slot] }, params: tidyParams(p), level: p.level };
    // which kit it came from, for the list only: not copied with the sound onto a key (not enumerable)
    Object.defineProperty(snd, 'kitHash', { value: rec.hash });
    return snd;
  });
}

/** the kits UI. host: { say, starterNames, hear(sound), putOnKey(sound), dealKit(sounds, kitName), closeOthers(), onChange() } */
export function setupKits(host) {
  let kits = []; // { hash, fileName, name, added, bytes, types, sounds }
  let picked = null, delArmed = null, delT = 0;
  const library = () => kits.flatMap((k) => k.sounds);
  async function load() {
    try {
      const recs = (await allKits()).sort((a, b) => a.added - b.added), taken = new Set(host.starterNames);
      kits = recs.map((r) => ({ ...r, name: readKit(Uint8Array.from(r.bytes)).name, sounds: kitSounds(r, taken) }));
      for (const r of recs) if (r.reader !== READER_VERSION) putKit({ ...strip(r), reader: READER_VERSION });
    } catch (e) { kits = []; host.say('the kits could not be read from this browser\'s storage'); }
    draw(); host.onChange();
  }
  const strip = (k) => ({ hash: k.hash, fileName: k.fileName, added: k.added, bytes: k.bytes, types: k.types || [], reader: READER_VERSION });

  async function importFiles(files) {
    let added = 0, sounds = 0, same = 0; const skipped = [];
    for (const f of files) {
      if (f.size > 4096) { skipped.push(`${cleanLabel(f.name)} (${f.size} bytes, not a kit)`); continue; }
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (bytes.length < 9) { skipped.push(`${cleanLabel(f.name)} (too short)`); continue; }
      if (bytes.length !== 255 && !/\.snd$/i.test(f.name)) { skipped.push(`${cleanLabel(f.name)} (${bytes.length} bytes, not a kit)`); continue; }
      const hash = await sha(bytes);
      if (kits.some((k) => k.hash === hash)) { same++; continue; }
      const rec = { hash, fileName: cleanLabel(f.name).slice(0, 40), added: Date.now(), bytes: [...bytes], types: [], reader: READER_VERSION };
      try { await putKit(rec); } catch (e) { skipped.push(`${cleanLabel(f.name)} (the browser would not keep it)`); continue; }
      const k = { ...rec, name: readKit(bytes).name, sounds: kitSounds(rec, new Set([...host.starterNames, ...library().map((s) => s.name)])) };
      kits.push(k); added++; sounds += k.sounds.length;
    }
    draw(); host.onChange();
    const parts = [];
    if (added) parts.push(`imported <em>${added} kit${added === 1 ? '' : 's'}</em>, ${sounds} sounds`);
    if (same) parts.push(`${same} already here`);
    if (skipped.length) parts.push(`skipped ${skipped.length}: ${skipped.slice(0, 2).join(', ')}${skipped.length > 2 ? ' …' : ''}`);
    host.say(parts.join(' · ') || 'no kit files in that');
    return { added, same, skipped: skipped.length };
  }
  async function remove(hash) {
    const k = kits.find((x) => x.hash === hash); if (!k) return;
    clearTimeout(delT);
    if (delArmed !== hash) { delArmed = hash; delT = setTimeout(() => { delArmed = null; draw(); }, 4000); draw(); host.say(`delete the kit <em>${k.name}</em>? Press SURE? (keys using its sounds keep them)`); return; }
    delArmed = null;
    try { await delKit(hash); } catch (e) { /* gone already */ }
    kits = kits.filter((x) => x.hash !== hash); if (picked && picked.kitHash === hash) picked = null;
    draw(); host.onChange(); host.say(`deleted the kit <em>${k.name}</em> · keys using its sounds keep them`);
  }
  async function retype(s, type) {
    const k = kits.find((x) => x.hash === s.kitHash); if (!k) return;
    s.type = type; k.types = k.sounds.map((x) => x.type);
    try { await putKit(strip(k)); } catch (e) { /* not kept */ }
    draw(); host.onChange(); host.say(`${s.name} (${k.name} ${s.from.slot}) is now a <em>${type}</em>`);
  }

  // ---- the menu ----
  function draw() {
    const n = kits.length;
    $('kits-btn').innerHTML = n ? `KITS <span class="dim">${n}</span> ▾` : 'KITS <span class="dim">· none yet, IMPORT</span> ▾';
    if ($('kits-panel').hidden) return;
    $('kits-count').textContent = n ? `${n} KIT${n === 1 ? '' : 'S'} · ${n * USED.length} SOUNDS` : '';
    $('kit-put').disabled = !picked; $('kit-type').disabled = !picked;
    $('kit-picked').textContent = picked ? `${picked.name} · ${picked.from.kit} ${picked.from.slot}` : 'CLICK A SOUND TO HEAR IT';
    $('kit-type').value = picked ? picked.type : '';
    const list = $('kit-list'); list.innerHTML = '';
    if (!n) { list.innerHTML = '<p class="dim">NO KITS YET: IMPORT KITS READS .SND FILES FROM YOUR DISK<br>(OR DROP THEM ON THE PAGE). THEY STAY IN THIS BROWSER</p>'; return; }
    for (const k of [...kits].reverse()) {
      const row = document.createElement('div'); row.className = 'krow';
      const head = document.createElement('div'); head.className = 'khead';
      head.innerHTML = `<b></b><span class="dim"></span>`;
      head.querySelector('b').textContent = k.name;
      head.querySelector('span').textContent = `${k.fileName} · ${new Date(k.added).toISOString().slice(0, 10)}`;
      const deal = document.createElement('button'); deal.type = 'button'; deal.className = 'btn sm'; deal.textContent = 'DEAL KIT';
      deal.title = `Put ${k.name}'s sounds on the keys of the selected engine (UNDO takes it back)`;
      deal.addEventListener('click', () => host.dealKit(k.sounds, k.name));
      const del = document.createElement('button'); del.type = 'button'; del.className = 'pdel'; del.textContent = delArmed === k.hash ? 'SURE?' : 'X';
      del.setAttribute('aria-pressed', delArmed === k.hash); del.title = `Delete ${k.name}: press twice`; del.setAttribute('aria-label', `Delete ${k.name}`);
      del.addEventListener('click', () => remove(k.hash));
      head.append(deal, del);
      const snds = document.createElement('div'); snds.className = 'ksnds';
      for (const s of k.sounds) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm ksnd';
        b.innerHTML = '<span></span><i></i>';
        b.querySelector('span').textContent = s.from.slot.replace('drum ', 'D').replace('hat open', 'HAT').toUpperCase();
        b.querySelector('i').textContent = s.type;
        b.title = `${s.name}: ${s.type}, ${s.from.slot} of ${k.name}, tuned ${noteName(s.params.tune)}. Click to hear it on the selected engine`;
        b.setAttribute('aria-pressed', picked === s);
        b.addEventListener('click', () => { picked = s; draw(); host.hear(s); host.say(`<em>${s.name}</em>: ${s.type}, ${k.name} ${s.from.slot} · PUT ON KEY puts it on the key played last`); });
        snds.append(b);
      }
      row.append(head, snds); list.append(row);
    }
  }
  const open = (on) => { $('kits-panel').hidden = !on; $('kits-btn').setAttribute('aria-expanded', on); if (on) draw(); else if (delArmed) { clearTimeout(delT); delArmed = null; } };
  $('kits-btn').addEventListener('click', () => { const on = $('kits-panel').hidden; host.closeOthers(); open(on); });
  document.addEventListener('pointerdown', (e) => { if (!$('kits-panel').hidden && !e.target.closest('#kmenu')) open(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') open(false); });
  for (const t of TYPES) $('kit-type').append(new Option(t.toUpperCase(), t));
  $('kit-type').addEventListener('change', () => { if (picked) retype(picked, $('kit-type').value); });
  $('kit-put').addEventListener('click', () => { if (picked) host.putOnKey(picked); });
  $('kit-import').addEventListener('click', () => $('kit-file').click());
  $('kit-folder').addEventListener('click', () => $('kit-dir').click());
  for (const id of ['kit-file', 'kit-dir']) $(id).addEventListener('change', async () => { const fs = [...$(id).files]; $(id).value = ''; if (fs.length) await importFiles(fs.filter((f) => /\.snd$/i.test(f.name) || f.size === 255)); });
  // drag and drop onto the page
  addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); document.body.classList.add('dropping'); } });
  addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
  addEventListener('drop', async (e) => {
    document.body.classList.remove('dropping');
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault(); await importFiles([...e.dataTransfer.files]);
  });
  const ready = load();
  return { library, importFiles, close: () => open(false), kits: () => kits, ready };
}

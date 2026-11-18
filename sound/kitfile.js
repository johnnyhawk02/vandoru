// The kit reader (SPEC section 4): the 255 bytes of a kit file in the SND kit format in, a kit out: its name and
// its seven sounds (drum 1, drum 2, drum 3, snare, metal, hat closed, hat open), every one with every parameter of
// SPEC 5.19 (plus its LEVEL and PAN). A pure function: no DOM, no storage.

/** bumped whenever the reader changes, so kits kept in the browser are read again from their bytes */
export const READER_VERSION = 1;
export const SLOTS = ['drum1', 'drum2', 'drum3', 'snare', 'metal', 'hatClosed', 'hatOpen'];
export const SLOT_NAMES = { drum1: 'drum 1', drum2: 'drum 2', drum3: 'drum 3', snare: 'snare', metal: 'metal', hatClosed: 'hat closed', hatOpen: 'hat open' };

// the dial positions of SPEC 6 for the kit's numbers (4.4)
const WAVE_POS = [0, 25, 50, 75, 125, 100]; // kit order: sine, tri, saw, square, noise, pwm
const TYPE_POS = [0, 54, 18, 36, 72, 90, 108, 126]; // kit order: LP, HP, BP, UNITY BP, NOTCH, PEAK, LP2, OFF

// the byte (after the 8-byte name) of each parameter, per kit voice (drum 1, drum 2, drum 3, snare, metal, hat);
// null: the voice has no such byte
const BYTES = {
  tune: [8, 10, 12, 14, 16, 18], fine: [9, 11, 13, 15, 17, 19], wave: [1, 2, 3, 4, 6, 7], pwm: [228, 229, 230, 231, 232, 233],
  aFreq: [83, 85, 87, null, 29, 33], aAmount: [82, 84, 86, null, 31, 35], aWave: [20, 21, 22, null, 23, 25], aMode: [134, 135, 136, null, null, null],
  bFreq: [null, null, null, null, 30, 34], bAmount: [null, null, null, null, 32, 36], bWave: [null, null, null, null, 24, 26],
  noiseRate: [null, null, null, 27, null, null], noise: [null, null, null, 28, null, null],
  attack: [49, 51, 53, 55, 57, 59], decay: [50, 52, 54, 56, 58, 60], ampCurve: [62, 63, 64, 65, 66, 67], repeat: [null, null, null, 68, 69, null],
  pDecay: [70, 71, 72, 73, null, null], pAmount: [74, 75, 76, 77, null, null], pCurve: [78, 79, 80, 81, null, null],
  click: [203, 204, 205, 206, 207, 208], clickVol: [197, 198, 199, 200, 201, 202], clickRate: [209, 210, 211, 212, 213, 214],
  cutoff: [37, 38, 39, 40, 41, 42], reso: [43, 44, 45, 46, 47, 48], type: [191, 192, 193, 194, 195, 196], fltDrive: [128, 129, 130, 131, 132, 133],
  level: [88, 89, 90, 91, 92, 93], pan: [94, 95, 96, 99, 100, 101], drive: [102, 103, 104, 105, 106, 107], crush: [108, 109, 110, 111, 112, 113],
  velVol: [137, 138, 139, 140, 141, 142], velAmount: [143, 144, 145, 146, 147, 148], velDest: [149, 150, 151, 152, 153, 154],
  lfoRate: [115, 116, 117, 118, 119, 120], lfoAmount: [121, 122, 123, 124, 125, 126], lfoWave: [155, 156, 157, 158, 159, 160],
  lfoDest: [167, 168, 169, 170, 171, 172], retrig: [173, 174, 175, 176, 177, 178], lfoSync: [179, 180, 181, 182, 183, 184], phase: [185, 186, 187, 188, 189, 190],
};
const OPEN_DECAY = 61;

// a parameter missing from a short file (4.6), in the kit's own numbers
const SHORT = { tune: 60, fine: 64, wave: 0, pwm: 0, aFreq: 60, aAmount: 0, aWave: 0, aMode: 0, bFreq: 60, bAmount: 0, bWave: 0,
  noiseRate: 127, noise: 0, attack: 0, decay: 40, ampCurve: 64, repeat: 0, pDecay: 20, pAmount: 0, pCurve: 0, click: 0, clickVol: 0,
  clickRate: 25, cutoff: 127, reso: 0, type: 0, fltDrive: 0, level: 100, pan: 64, drive: 0, crush: 127, velVol: 1, velAmount: 0,
  velDest: 0, lfoRate: 64, lfoAmount: 0, lfoWave: 0, lfoDest: 0, retrig: 0, lfoSync: 0, phase: 0 };

// the kit's shared target list (4.7): index -> [kit voice, parameter id]. A dash is null
const DRUM_T = ['tune', 'fine', 'wave', 'pwm', 'attack', 'decay', 'ampCurve', 'pDecay', 'pCurve', 'pAmount', null, 'velAmount', 'velVol',
  'aAmount', 'aFreq', 'aWave', 'aMode', 'click', 'clickVol', 'clickRate', 'cutoff', 'reso', 'type', 'fltDrive', 'lfoRate', 'lfoSync',
  'lfoAmount', 'lfoWave', null, 'phase', 'level', 'pan', 'crush', 'drive', null, null, null, null];
const SNARE_T = ['tune', 'fine', 'noiseRate', 'noise', 'wave', 'pwm', 'attack', 'decay', 'repeat', 'ampCurve', 'pDecay', 'pCurve', 'pAmount',
  null, 'velAmount', 'velVol', 'click', 'clickVol', 'clickRate', 'cutoff', 'reso', 'type', 'fltDrive', 'lfoRate', 'lfoSync', 'lfoAmount',
  'lfoWave', null, 'phase', 'level', 'pan', 'crush', 'drive', null, null, null, null];
const METAL_T = ['tune', 'fine', 'wave', 'pwm', 'attack', 'decay', 'repeat', 'ampCurve', null, 'velAmount', 'velVol', 'aFreq', 'bFreq',
  'aAmount', 'bAmount', 'aWave', 'bWave', 'click', 'clickVol', 'clickRate', 'cutoff', 'reso', 'type', 'fltDrive', 'lfoRate', 'lfoSync',
  'lfoAmount', 'lfoWave', null, 'phase', 'level', 'pan', 'crush', 'drive', null, null, null, null];
const HAT_T = ['tune', 'fine', 'wave', 'pwm', 'attack', 'decayClosed', 'decayOpen', 'ampCurve', null, 'velAmount', 'velVol', 'aFreq', 'bFreq',
  'aAmount', 'bAmount', 'aWave', 'bWave', 'click', 'clickVol', 'clickRate', 'cutoff', 'reso', 'type', 'fltDrive', 'lfoRate', 'lfoSync',
  'lfoAmount', 'lfoWave', null, 'phase', 'level', 'pan', 'crush', 'drive', null, null, null, null];
const TARGETS = [null, null];
[[0, DRUM_T], [1, DRUM_T], [2, DRUM_T], [3, SNARE_T], [4, METAL_T], [5, HAT_T]].forEach(([v, list]) => { for (const id of list) TARGETS.push(id && [v, id]); });

/** the kit's name from its first 8 bytes: printable ASCII only, trimmed; empty is "EMPTY" */
export function kitName(bytes) {
  let s = '';
  for (let i = 0; i < 8 && i < bytes.length; i++) { const c = bytes[i]; s += c >= 32 && c < 127 ? String.fromCharCode(c) : ' '; }
  return s.trim() || 'EMPTY';
}

/** bytes (a Uint8Array or array) in, { name, sounds: { drum1 ... hatOpen } } out; null when it isn't a kit (under 9 bytes) */
export function readKit(bytes) {
  if (!bytes || bytes.length < 9) return null;
  const byte = (p) => (8 + p < bytes.length ? bytes[8 + p] : undefined);
  const sounds = {};
  for (const slot of SLOTS) {
    const v = slot === 'hatOpen' ? 5 : SLOTS.indexOf(slot);
    const kind = v < 3 ? 'drum' : v === 3 ? 'snare' : 'metal';
    const raw = (id) => {
      const at = id === 'decay' && slot === 'hatOpen' ? OPEN_DECAY : BYTES[id][v];
      if (at === null) return undefined;
      const b = byte(at);
      return b === undefined ? SHORT[id] : b;
    };
    const u7 = (id, dflt) => { const x = raw(id); return x === undefined ? dflt : Math.min(127, x); };
    const s = {};
    for (const id of ['tune', 'fine', 'pwm', 'attack', 'decay', 'ampCurve', 'clickVol', 'clickRate', 'cutoff', 'reso', 'fltDrive', 'level', 'pan', 'drive', 'crush',
      'velAmount', 'lfoRate', 'lfoAmount', 'phase']) s[id] = u7(id);
    const wave = (x) => WAVE_POS[x < 6 ? x : 0];
    s.wave = wave(raw('wave'));
    // modulator A: drums, metal and hat have one; the snare doesn't (4.5)
    if (kind === 'snare') Object.assign(s, { aFreq: 60, aAmount: 0, aWave: 0, aMode: 0 });
    else { s.aFreq = u7('aFreq'); s.aAmount = u7('aAmount'); s.aWave = wave(raw('aWave')); s.aMode = kind === 'drum' && raw('aMode') ? 127 : 0; }
    s.fmEnv = kind === 'metal' ? 0 : 127;
    if (kind === 'metal') { s.bFreq = u7('bFreq'); s.bAmount = u7('bAmount'); s.bWave = wave(raw('bWave')); } else Object.assign(s, { bFreq: 60, bAmount: 0, bWave: 0 });
    if (kind === 'snare') { s.noiseRate = u7('noiseRate'); s.noise = u7('noise'); } else Object.assign(s, { noiseRate: 127, noise: 0 });
    s.repeat = slot === 'snare' || slot === 'metal' ? u7('repeat') : 0;
    if (kind === 'metal') Object.assign(s, { pDecay: 20, pCurve: 0, pAmount: 0 }); else { s.pDecay = u7('pDecay'); s.pCurve = u7('pCurve'); s.pAmount = u7('pAmount'); }
    s.click = raw('click') % 14;
    const t = raw('type'); s.type = TYPE_POS[t <= 7 ? t : 7];
    s.toneIn = kind !== 'snare'; s.noiseIn = true; s.clickIn = kind === 'drum';
    s.velVol = !!raw('velVol');
    s.lfoWave = Math.min(7, raw('lfoWave'));
    s.lfoSync = Math.min(11, raw('lfoSync'));
    s.retrig = raw('retrig') === v + 1;
    // a modulation target: one of this voice's own parameters, or none
    const target = (i) => {
      const e = TARGETS[i];
      if (!e || e[0] !== v) return null;
      if (e[1] === 'decayClosed') return slot === 'hatClosed' ? 'decay' : null;
      if (e[1] === 'decayOpen') return slot === 'hatOpen' ? 'decay' : null;
      return e[1];
    };
    s.velDest = target(raw('velDest'));
    s.lfoDest = target(raw('lfoDest'));
    s.kind = kind;
    sounds[slot] = s;
  }
  return { name: kitName(bytes), sounds };
}

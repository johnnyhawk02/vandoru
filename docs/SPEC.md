# VANDORU: specification

*(VANDORU is a working name: one search-and-replace changes it.)*

A percussion instrument for the browser that **imports drum kits in the 255-byte `.SND` kit format and plays every sound in them so that it sounds the same as it does in Johnny's previous app**. Its engine is written new, from this specification alone. Everything else (the screen, the 25 keys, MIDI, the randomisers, morph keys, locks, undo, auto level, presets, the phone screen) keeps the way the previous app works.

Written 2026-11-18 by the spec side of a clean room. The spec side read the previous app's engine and described what it does, in words and maths. Nothing below is code or a transcription of code. The implementer builds only from this document, the reference pack, and the few files of Johnny's own named in section 3.

Contents
1. Ground rules (clean room, names, kit data, standing rules)
2. What carries over from the previous app (by behaviour)
3. Files: copy, adapt, rewrite, leave out
4. The kit import format
5. The sound engine (behaviour)
6. Dials between settings (morph-friendly switches)
7. FX and master
8. Kits, sounds and the randomisers
9. Morphing
10. Storage formats
11. Tests and acceptance
12. Build order
13. Open questions for Johnny
- Appendix A: value curves at a glance
- Appendix B: the reference pack

---

## 1. Ground rules

### 1.1 Clean room

- **Build the engine from this spec only.** Don't open, fetch, search, summarise or quote any drum machine's firmware, any port of one, or any part of the previous app except the files listed in 3.1. That includes its engine folder, its schema, instrument, level and kit modules, its kits folder, its reference tests and its git history. Don't browse its repo on GitHub.
- **Write the DSP from general, published knowledge** (state-variable filters in the zero-delay-feedback form, band-limited oscillators, phase modulation, waveshapers, one-pole smoothers, FDN or allpass-loop reverbs, feed-forward compressors, ITU-R BS.1770 loudness) plus the behaviour, curves and constants written here. Where this spec gives a formula, implement the formula; where it describes a behaviour in words, design your own way of producing it.
- **The reference pack is for measuring, not for copying.** It holds kit files and measurements of how each kit sound should sound (Appendix B). Use it in local tests to compare your output. Never commit it, never ship it, never derive tables from it that end up in the product (the generated clicks in 5.7 are designed from the descriptions and tuned by ear and by the comparison test, not fitted sample by sample).

### 1.2 Names and kit data

- **No old names.** The starting prompt lists four banned words (the names of the hardware family, the previous app, and two related products). Nothing in the repo may contain any of them in any letter case: code, comments, captions, tooltips, logo, page title, storage keys, export ids, file names, folder names, commit messages you write, and this spec (which is written to pass). A test, `test/names-clean.test.mjs`, searches every file in the repo (outside `.git` and the gitignored `local/` folder) and fails if any of the four appears. The test keeps the words in a form that doesn't match itself (for example reversed, or built from pieces at run time). It runs with every change.
- **Call the format by what it is**: "the SND kit format", ".SND kit files", "kits". Don't name the hardware or the company it came from.
- **Kits are the user's data, never the app's.** The repo and the published page contain no kit files, no sounds decoded from them, no numbers measured from them and no names taken from them. Johnny imports kits from his own disk; the app keeps them in the browser (IndexedDB). Presets and exports he makes may contain sound parameters taken from his kits; that's his data on his machine.
- **The reference pack lives in `local/`** (gitignored). Tests that need it skip with a clear message when it's missing, so a fresh clone or CI still passes.
- **A starter set**: so the app works before any kit is imported, it ships 12 sounds written by hand in the engine's own parameters (8.6). They're made for this app, not copied from a kit.

### 1.3 Johnny's standing rules (all still apply)

- **No 3D view, ever.** No three.js, no hardware-on-a-desk look, no skeuomorphic panel. Johnny turned it down twice. Don't suggest it.
- **Everything on a grid.** Equal cells, one knob to a cell. Every knob lines up with the ones above and below it. A menu takes two cells. Rules (lines) sit on cell edges and never shift a knob.
- **Controls change only on click and drag.** No scroll wheel, no trackpad, no arrow-key nudging, no focus ring. Passing the pointer over a control never changes it. A drag must end even if the pointerup is missed: on any move with the button up, on lost pointer capture, on window blur and on the tab being hidden.
- **Edit only the key played.** A knob always changes the last key pressed (or the key picked on the strip). There is no "all keys" mode.
- **No hidden modes, little clutter.** Set-and-forget controls go in SETTINGS. The main screen is for playing and editing.
- **No sequencer.** It was built and removed ("I don't find it useful"). A key plays once per press (the engine's REPEAT still makes flams and claps).
- **Plain words.** Button names are RANDOM and ALTER, never jargon like "scatter". Captions under buttons say what they do in a few plain words.
- **Colours come from two values.** Every colour on screen derives from `--panel-rgb` and `--ink-rgb`. Never hardcode a colour.
- **Much easier than the hardware.** Obvious feedback (a message line that says what happened and what was kept), nothing hidden.
- Johnny's screens: a MacBook Air M1 (browser windows 1440 x 760 and 1280 x 700; also check 1440 x 900 and 1280 x 800) and a Pixel 9a phone (412 x 915; also check 360 x 640).

---

## 2. What carries over (by behaviour)

These are the previous app's features, with the changes this app needs. Section 3 says which of Johnny's own files can be copied for them.

### 2.1 Screen and layout

- **One screen, nothing scrolls**, laid out for a laptop (1440 x 900 native). Below about 1264 x 784 the whole screen scales down to fit. 1440 x 760 and 1280 x 700 must fit.
- **LCD look**: one pane of LCD glass, one ink colour, a faint ghost of unlit segments, an offset shadow, the VT323 pixel font, buttons as outlined boxes that invert when pressed or chosen, segmented bars and meters.
- **Top bar**: logo, PRESET menu (the patch's name, a `*` when unsaved), MIDI status box, LAST box (the last key played and how hard), KITS menu (new, 8.2), SETTINGS menu, RANDOM menu, UNDO.
- **Key panel** (top left): KEY note name and number, its engine and what it plays ("GOSMAN · kick · from VAMET · 2 edits"), the **key strip** of all 25 keys (grouped by engine, a padlock on locked keys, a dot on hand-edited keys; click a key to pick and hear it), and a row of buttons: **NEW SOUND** (a flat 2D dice that turns once and changes face a few times in about a third of a second, K), **ALTER KEY** (an icon of three sliders, A), **LOCK KEY** (L), **COPY**, **PASTE**, **CLEAR**. Under them **MAKE THIS KEY**: two rows of six small buttons (kick, tom, perc, zap, snare, clap, rim, bell, closed hat, open hat, cymbal, any). A locked key turns the header black and veils the knobs ("KEY LOCKED · LOCK KEY (L) unlocks it").
- **Engine bar**: ENGINE 1 to N buttons, each right under its group of keys on the strip, and an **FX + MASTER** tab (F).
- **Knob grid**: the key's sound as knobs, in rows of sections, on one grid shared by every engine (every engine has the same controls, 5.2). The right-hand columns hold the key's **REVERB** send, **PAN** and its big **LEVEL** knob, with an **AUTO** chip above LEVEL showing the key's trim ("AUTO -3.5dB"; press it to re-measure). Section 5.19 lists the controls and a layout.
- **Status line** at the bottom: what just happened, what was kept ("locked DECAY, CUTOFF kept"), and the zones.

### 2.2 Knobs

- Press and drag up or down. A hand edit **lights the knob's label**, a notch outside the ring marks the value it had, and a **double-click puts it back**. The key header counts the edits.
- **Plus-minus knobs** (pan, fine tune) have their centre at the top and light outwards. PAN reads L100 … C … R100.
- **Padlock** at each knob's top right (faint open, solid closed). See 2.6.
- **Values show real units** where there are some: CUTOFF in Hz, DECAY and ATTACK in ms or s, TUNE as a note name, LFO RATE in Hz or a note length when synced (Appendix A has the curves). The dials of section 6 show their setting's name, or both names and how far along between two ("tri>saw 40").

### 2.3 Keys, engines and playing

- **25 keys** on MIDI channel 1, for a Novation Bass Station 2 at its default octave (lowest key MIDI 48). **LOW KEY** (SETTINGS) moves the layout by octaves. Velocity is used. Note-offs from MIDI and from the strip; MIDI all-notes-off releases everything.
- **Every key has its own sound.** A key plays its sound at the sound's own pitch: keys don't transpose.
- **ENGINES 1 to 6** (SETTINGS, **3** as it comes): that many mono engines, the 25 keys split into even side-by-side zones, the extra keys at the top (1 = 25, 2 = 12 + 13, 3 = 8 + 8 + 9, 4 = 6 + 6 + 6 + 7, 5 = 5 x 5, 6 = 4 + 4 + 4 + 4 + 4 + 5). Any sound can sit on any engine. Changing the count keeps every key's sound where it can, deals new sounds onto keys that had none, and is undoable. Only engines in use render.
- **Mono, last-note priority, per zone.** A new key in a zone takes over with its own sound. Let go of it while an earlier key of the zone is still held and the earlier one comes back on the next step of the BPM grid (**RETURN** in SETTINGS: NOW, 1/32, **1/16** as it comes, 1/8, 1/4). Zones don't affect each other.
- **BPM** (SETTINGS) 40 to 240, double-click for 120. It drives RETURN and the synced LFOs (5.15).
- **Computer keys**: `[` `]` or left/right arrows step to the key before or after and play it; Space plays it again; K new sound; A alter key; L lock key; Z undo; F the FX + MASTER tab; 1 to 6 pick an engine; Cmd/Ctrl+C and V copy and paste a key. Buttons show their keys.

### 2.4 MIDI and hardware knobs

- Web MIDI (Chrome, Edge). START AUDIO + MIDI overlay on first load (browsers need a gesture).
- **Knob map for the Bass Station 2** (CC on channel 1, acting on the last key played): filter freq (CC 16) → CUTOFF, resonance (82) → RESO, overdrive (114) → DRIVE, amp attack (90) / decay (91) → ATTACK / DECAY, mod env depth (85) → P AMOUNT, mod env decay (103) → P DECAY, distortion (94) → A AMOUNT, osc 1 coarse (27) / fine (26) → TUNE / FINE, LFO 1 speed (18) → LFO RATE, portamento (5) → REVERB send, osc 1 / osc 2 / sub levels (20, 21, 22) → engine 1 / 2 / 3 levels. These are Novation's published CC numbers.
- **LEARN** (SETTINGS): press it, click a control on screen, turn a hardware knob. **BS2 MAP** puts the default back. The map is kept in the browser, not in presets.

### 2.5 Randomisers (the RANDOM menu and the key panel)

- **INIT PATCH** (top of the menu): a new patch in one press. Every key gets a fresh sound, levelled and panned as RANDOM ALL deals them; **30% of the keys get a reverb send** (8 of 25, chosen at random, in a range of 45..95 out of 127). Locked keys and hand edits are replaced, so if any key is locked it asks first (press again within four seconds). BPM back to 120; reverb, distortion, compressor and output level back to their defaults; RETURN, engine levels and the knob padlocks stay. A knob with a closed padlock keeps its setting on every key. The patch gets a new name and is unsaved. UNDO brings the old patch back whole.
- **MORPH KEYS**, **NEW ENDS**, **KICK > HAT**: section 9.
- **NEW SOUNDS FROM**: the source that the dice, RANDOM, RANDOM ALL and INIT PATCH use: **KIT** (a kit sound as it is), **BREED**, **MORPH**, **STYLE**, **FREE**, **RECIPE**. Section 8.5 defines each.
- **THIS ENGINE**: RANDOM (every key of the engine gets a new sound), ALTER (nudge every key around what it plays now), LEVEL (even out the keys' loudness without changing the sounds). **ALL ENGINES**: RANDOM ALL, ALTER ALL, LEVEL ALL. Each button has a caption.
- **HOW MUCH**: the ALTER amount (10% as it comes; ALTER KEY uses it too). **WILD**: ALTER may take a control outside its usual range.
- **AUTO LEVEL** checkbox (on as it comes).
- **KNOB PADLOCKS**: the count of closed padlocks and UNLOCK ALL.
- **ALTER always starts from the sound's "home"** (what it was before the first alter since the last hand edit), so repeated presses vary one sound instead of drifting away.
- **New sounds keep a key's send** (locked or not).
- **Pan when randomising**: kicks and toms centred, snares and claps within 20% left or right, everything else anywhere. Set by hand, any pan goes anywhere; the pan padlock keeps it out of the randomisers.
- **Duds are skipped**: every generated sound is played offline first and thrown away if it is silent (more than 24 dB under its level target), still loud at 1.5 s, or produces NaN or DC. Up to 8 tries, then the best try. A kit sound dealt as it is (KIT) is never thrown away.

### 2.6 Locks

- **LOCK KEY** freezes a key's whole sound: nothing random, CLEAR or INIT (without asking) changes it until it is unlocked.
- **Knob padlocks**: a closed padlock keeps that knob's setting on every key of its engine through every randomiser (dice, RANDOM, ALTER, ALTER KEY, the ALL versions, INIT PATCH, MAKE THIS KEY, MORPH KEYS). Only a hand edit, UNDO and loading a preset change a locked knob. Nothing is locked as it comes. The message line names what was kept.

### 2.7 Copy, paste, clear, undo

- **COPY / PASTE** a key's whole sound. Every engine has the same controls, so a paste is exact.
- **CLEAR** puts a key back to the engine's base sound (the starter KICK on engine 1, SNARE on 2, CLOSED HAT on 3, and so on round the starter set).
- **UNDO**: 40 steps over every change to the sounds (a whole knob drag is one step, a randomiser, NEW SOUND, ALTER KEY, PASTE, CLEAR, ENGINES, a preset load, INIT PATCH, a kit import that deals sounds). The status line says what it undid. Effects and master changes are not in the undo stack, except as part of a preset load or INIT PATCH (which snapshot everything).

### 2.8 Auto level

- Every sound a randomiser deals or alters (and a paste, and a MAKE THIS KEY) is played offline, measured, and its key gets a **trim**, a gain of its own, separate from LEVEL. Loudness = the loudest 100 ms of the hit at velocity 100, K-weighted per ITU-R BS.1770, in dB below full scale. The trim brings it to its target, never past full scale, at most +12 dB or -16 dB.
- **Targets are per sound type** (kick, snare, hats …), set from the median loudness of all imported kit sounds of that type (8.3) once there are 5 or more, otherwise one shared starting target (-15 dB, adjust by ear). Recompute when kits are imported or deleted. Nothing measured goes into the repo.
- **AUTO** chip above LEVEL: shows the trim, press to re-measure. **LEVEL / LEVEL ALL** even out the keys as they are. **AUTO LEVEL** off: new sounds play as loud as they come out. Locked keys are left alone. UNDO takes it back.
- Offline renders run in a Web Worker so the page never stalls.

### 2.9 Presets and names

- **PRESET menu** (the patch's name beside the logo): a name box (Enter renames), **NEW NAME**, **SAVE**, **SAVE AS NEW**, **REVERT**, a list (click to load, UNDO takes the load back, **X** then **SURE?** deletes), **EXPORT** (all presets to one JSON file) and **IMPORT** (add a file's presets). A preset holds every key's sound (its parameters, not a reference to a kit), hand edits, lock, send, pan, level and trim, the engine count, the effects, the master and the BPM. Not in a preset: knob padlocks, the knob map, LOW KEY, the RANDOM menu's settings, screen colours, imported kits. Keys are stored by place in the layout, so a preset loads the same at any LOW KEY. Imports are sanitised (names, labels, ranges), because messages are shown as HTML.
- **Auto names**: copy `app/names.js` (3.1). Names are jumbled from pieces of words in six themed lists, joined where a vowel meets a consonant, always mixing two lists, never a real list word, never a name in use. **Every imported kit sound gets its own name** this way (seeded from the kit file's content hash and the sound's slot, so re-importing the same file gives the same names), and so does every patch.

### 2.10 Settings and screen colours

- **SETTINGS** menu: TEMPO (BPM, RETURN), KEYBOARD (ENGINES, LOW KEY), SCREEN COLOURS, HARDWARE KNOBS (LEARN, BS2 MAP).
- **SCREEN COLOURS**: six looks (LCD, BLUE LCD, PAPER, AMBER, GREEN CRT, NIGHT), or your own PANEL and TEXT colours, RESET back to LCD. Applied before first paint by an inline script. Kept in the browser.

### 2.11 FX + MASTER tab

- A tab of its own (F). It holds **SEND FX** (the REVERB) and **MASTER**: the distortion with its sidechain, the compressor with a gain-reduction meter, the output level. Section 7.

### 2.12 Phone

- A phone held upright gets a simple screen by itself, at the same address (detected from `screen.width/height`: short side ≤ 700 and taller than wide, set before first paint; `?phone` forces it, `?desktop` forces the big screen).
- **25 pads** on a five-column grid (lowest top left, shaded by engine), each playing while held, several fingers at once. The pad pressed last is the one the buttons act on: **NEW SOUND** (the dice), **ALTER**, **LOCK**, a **REVERB** bar for its send (touch or slide). Then **INIT PATCH**, **RANDOM ALL**, **UNDO** and a two-line message line. **MENU** (top right; reads CLOSE while open): RANDOM and ALTER for the engine of the last pad, ALTER ALL. A press does its thing and closes the menu.
- The phone buttons press the big screen's own buttons, so the rules live in one place. No presets, knobs, kit import or effects on the phone, and it doesn't ask for MIDI. Kits imported on the same browser are used.

### 2.13 Not carried over

The echo (and its SYNC and PING-PONG), the per-key sequencer's leftovers, the cross-feed matrix between engines, the extra click samples that the previous app added beyond the kit format's set, the previous app's stored-data conversions, its storage keys and its kit files. The app starts with fresh storage keys and no history to convert.

---

## 3. Files: copy, adapt, rewrite, leave out

### 3.1 Copy (from the previous app's repo at commit `6b3aa30`; the only files this project may fetch)

Johnny confirmed that the previous app's interface, randomiser and ALTER code, look and master distortion are his own work, written new; only its sound engine and its send effects came from elsewhere. These nine files are his own:

| File | What to do |
|---|---|
| `sound/dirt.js` | **Copy**, then scrub its header comment. The master distortion. The host passes the sidechain signal (`process(L, R, key)`; `key` null = the mix). |
| `app/names.js` | **Copy**, drop the one word in its fantasy list that the names-clean test flags, scrub the header. |
| `test/names.test.mjs` | **Copy as is** (scrub if needed). |
| `tools/stamp.mjs` | **Copy, update its file list.** Cache-busting `?v=` stamps on every module import; run before each commit that changes the page. |
| `css/lcd.css` | **Copy, then adapt**: header comment, logo, drop echo and sequencer rules, re-check grid widths for the knob count. |
| `index.html` | **Copy, then adapt**: title, description, logo, no echo, REVERB only on the phone, KITS menu added. Keep the inline colour and phone scripts and the load-failure check. |
| `app/main.js` | **Copy as a reference and lift its generic parts** (list below); rewrite everything that touches the sound's parameters. Split it into modules while porting. |
| `test/shots.mjs` | **Copy, then adapt**: the Playwright checks of layout (on the grid, nothing scrolls), sizes, phone, dice, undo, presets, locks. |
| `test/dirt.test.mjs` | **Copy, then rewrite its harness** against the new instrument. |

Generic parts of `app/main.js` to lift: `dragger` (with all its drag-ending guards), the knob SVG and ring lighting (`KNOB_SVG`, `knobF`, `knobDeg`, `lightRing`, the plus-minus centre), padlock icon, `hbar`, dice (`DICE_PIPS`, `DICE_FACES`, `rollDice`), screen colours (`THEMES`, `applyColours`), menus open/close, the undo stack (`snapshot`, `undo`), presets (store, save, save as new, revert, delete with SURE?, export, import, `tidyPreset`, `canon` dirty check), MIDI (`startMidi`, `onMidi`, note on/off, `held` stacks, all-off), CC handling and LEARN (`onCC`, `setLearn`), the key strip and `stepKey`, `copyKey` / `pasteKey`, `lockKey`, the `initPatch` flow (arm and confirm), `fitScreen` and `alignEngines`, the whole phone section, the `rnd` xorshift.

`app/main.js` and `test/shots.mjs` still use the old engine's parameter names and numbers (things like `PAR`, `again`, `pamt`, `ukey`, target lists, kit labels). Treat them as holes to fill with this spec's parameters (5.19). Don't go looking for what they meant.

### 3.2 Rewrite (keep the behaviour, write new code)

| What | New file(s) | Notes |
|---|---|---|
| The kit reader | `sound/kitfile.js` | Section 4. Pure function: bytes in, a kit (name, 7 sounds) out. |
| The sound's parameters | `sound/params.js` | Section 5.19: ids, labels, sections, ranges, curves, defaults, display. |
| The engine | `engine/` | Section 5. A pure JS instrument (no DOM, no Web Audio) that renders float buffers at any sample rate, so it runs in an AudioWorklet, in a Worker for offline renders, and in node for tests. |
| Generated clicks | `engine/clicks.js` | Section 5.7: made by maths at start-up. |
| The worklet | `sound/worklet.js` | Thin host for the engine. |
| Auto level | `sound/level.js` | Section 2.8. Write the K-weighting filter from the BS.1770 standard. |
| Randomisers | `sound/makers.js` | Section 8.5. |
| The compressor | `sound/comp.js` | Section 7.3, written fresh. |
| The reverb | `sound/reverb.js` | Section 7.1, new. |

### 3.3 Leave out

Everything else in the previous app: its engine and tables, its click samples, its reverb and echo, its schema and instrument, its kits and anything built from them, its reference tests, `LICENSE`, `README.md`, `docs/`. **Licence of the new repo**: Johnny picks one when he creates it; the files in 3.1 are his to license as he likes.

---

## 4. The kit import format

### 4.1 The file

- A kit file is **255 bytes**. Bytes 0 to 7 are the kit's name in ASCII, padded with spaces or zeros (strip anything outside printable ASCII, trim; empty means "EMPTY"). Bytes 8 to 254 are **247 parameter bytes**: the byte at offset `8 + p` is parameter `p`, for p = 0 to 246.
- Every parameter byte is 0 to 127 (a few are small counts or choices, listed below). Treat values above the listed range as the nearest valid value unless 4.4 says otherwise.
- A shorter file: the missing parameters take the defaults of 4.6. A longer file: ignore the extra bytes. Fewer than 9 bytes: not a kit (say so in the message line).
- File names usually end in `.SND` (any case). Accept any name; check the size.

### 4.2 Six kit voices, seven sounds

A kit holds six voices. Each becomes one or two **sounds** in the app:

| Kit voice | Sound(s) | Finishing kind (5.11) |
|---|---|---|
| 1 | drum 1 | drum |
| 2 | drum 2 | drum |
| 3 | drum 3 | drum |
| 4 | snare | snare |
| 5 | metal (cymbal) | metal |
| 6 | hat, closed and hat, open (two sounds, different decay) | metal |

The hat voice has two decays in the file, one for a closed hit and one for an open hit; import it as two sounds that differ only in DECAY. (The previous app played the hat with its open decay; the closed one is new here and welcome.)

### 4.3 The parameter bytes

"Byte p" means file offset 8 + p. For each sound parameter (5.19) the byte that feeds it, per kit voice. A dash means the voice has no such byte and the sound takes the constant in 4.6.

**Oscillator (the tone)**

| Sound param | drum 1 | drum 2 | drum 3 | snare | metal | hat | Range |
|---|---|---|---|---|---|---|---|
| TUNE | 8 | 10 | 12 | 14 | 16 | 18 | 0..127, a MIDI note number |
| FINE | 9 | 11 | 13 | 15 | 17 | 19 | 0..127, 64 = centre |
| WAVE | 1 | 2 | 3 | 4 | 6 | 7 | 0..5 in kit order (4.5) |
| PWM | 228 | 229 | 230 | 231 | 232 | 233 | 0..127 |

**Modulator A and B**

| Sound param | drum 1 | drum 2 | drum 3 | snare | metal | hat | Range |
|---|---|---|---|---|---|---|---|
| A FREQ | 83 | 85 | 87 | - | 29 | 33 | MIDI note number |
| A AMOUNT | 82 | 84 | 86 | - | 31 | 35 | 0..127 |
| A WAVE | 20 | 21 | 22 | - | 23 | 25 | 0..5 kit order |
| A MODE | 134 | 135 | 136 | - | - | - | 0 = FM, 1 = MIX |
| B FREQ | - | - | - | - | 30 | 34 | MIDI note number |
| B AMOUNT | - | - | - | - | 32 | 36 | 0..127 |
| B WAVE | - | - | - | - | 24 | 26 | 0..5 kit order |

**Noise (snare only in the file)**: NOISE RATE byte 27, NOISE (the noise/tone balance) byte 28.

**Amp envelope**

| Sound param | drum 1 | drum 2 | drum 3 | snare | metal | hat | Range |
|---|---|---|---|---|---|---|---|
| ATTACK | 49 | 51 | 53 | 55 | 57 | 59 | 0..127 |
| DECAY | 50 | 52 | 54 | 56 | 58 | closed 60, open 61 | 0..127 |
| CURVE (amp) | 62 | 63 | 64 | 65 | 66 | 67 | 0..127, 64 ≈ linear |
| REPEAT | - | - | - | 68 | 69 | - | 0..127 (a count) |

**Pitch envelope (drums and snare)**

| Sound param | drum 1 | drum 2 | drum 3 | snare | Range |
|---|---|---|---|---|---|
| P DECAY | 70 | 71 | 72 | 73 | 0..127 |
| P AMOUNT | 74 | 75 | 76 | 77 | 0..127 |
| P CURVE | 78 | 79 | 80 | 81 | 0..127 |

**Click**

| Sound param | drum 1 | drum 2 | drum 3 | snare | metal | hat | Range |
|---|---|---|---|---|---|---|---|
| CLICK (type) | 203 | 204 | 205 | 206 | 207 | 208 | 0..13 (4.4) |
| CLICK VOL | 197 | 198 | 199 | 200 | 201 | 202 | 0..127 |
| CLICK RATE | 209 | 210 | 211 | 212 | 213 | 214 | 0..127 |

**Filter**

| Sound param | drum 1 | drum 2 | drum 3 | snare | metal | hat | Range |
|---|---|---|---|---|---|---|---|
| CUTOFF | 37 | 38 | 39 | 40 | 41 | 42 | 0..127 |
| RESO | 43 | 44 | 45 | 46 | 47 | 48 | 0..127 |
| TYPE | 191 | 192 | 193 | 194 | 195 | 196 | 0..7 kit order (4.5) |
| FLT DRIVE | 128 | 129 | 130 | 131 | 132 | 133 | 0..127 |

**Mix**

| Sound param | drum 1 | drum 2 | drum 3 | snare | metal | hat | Range |
|---|---|---|---|---|---|---|---|
| LEVEL | 88 | 89 | 90 | 91 | 92 | 93 | 0..127 |
| PAN | 94 | 95 | 96 | 99 | 100 | 101 | 0..127, 63/64 = centre |
| DRIVE | 102 | 103 | 104 | 105 | 106 | 107 | 0..127 |
| CRUSH (sample rate) | 108 | 109 | 110 | 111 | 112 | 113 | 0..127, 127 = off |

**Velocity**

| Sound param | drum 1 | drum 2 | drum 3 | snare | metal | hat | Range |
|---|---|---|---|---|---|---|---|
| VEL VOL (velocity sets loudness) | 137 | 138 | 139 | 140 | 141 | 142 | 0 off, else on |
| VEL AMT | 143 | 144 | 145 | 146 | 147 | 148 | 0..127 |
| VEL DEST | 149 | 150 | 151 | 152 | 153 | 154 | a target index (4.7) |

**LFO** (one per kit voice)

| Sound param | drum 1 | drum 2 | drum 3 | snare | metal | hat | Range |
|---|---|---|---|---|---|---|---|
| LFO RATE | 115 | 116 | 117 | 118 | 119 | 120 | 0..127 |
| LFO AMT | 121 | 122 | 123 | 124 | 125 | 126 | 0..127 |
| LFO WAVE | 155 | 156 | 157 | 158 | 159 | 160 | 0..7 |
| LFO DEST | 167 | 168 | 169 | 170 | 171 | 172 | a target index (4.7) |
| RETRIG | 173 | 174 | 175 | 176 | 177 | 178 | 0 free, 1..6 a kit voice |
| LFO SYNC | 179 | 180 | 181 | 182 | 183 | 184 | 0 off, 1..11 |
| PHASE | 185 | 186 | 187 | 188 | 189 | 190 | 0..127 |

**Ignored bytes** (they belong to the hardware's mixer, effects, MIDI and menus, or are unused): 0, 5, 97, 98, 114 (a kit-wide sample-rate reducer, used by 2 of the 131 test kits; leave it out), 127, 161 to 166, 215 to 227, 234 to 246.

### 4.4 Clean-up rules on import

- **WAVE, A WAVE, B WAVE**: kit order is 0 sine, 1 triangle, 2 saw, 3 square, 4 noise, 5 pwm. A value of 6 or more refers to a user sample stored on the hardware, which a kit file doesn't carry: play it as **sine**. Convert to the dial positions of section 6 (sine 0, tri 25, saw 50, square 75, pwm 100, noise 125).
- **TYPE** (filter): kit order is 0 LP, 1 HP, 2 BP, 3 UNITY BP, 4 NOTCH, 5 PEAK, 6 LP2, 7 OFF; anything above 7 is OFF. Convert to the dial positions of section 6.
- **A MODE**: 0 → 0 (FM), anything else → 127 (MIX).
- **CLICK**: 0 SNAP, 1 PHASE, 2 to 13 the twelve clicks of 5.7. A value of 14 or more (a user sample) becomes the value modulo 14.
- **VEL DEST, LFO DEST**: an index into the kit's target list (4.7). An index past the end of the list becomes 0 (none). **A target that belongs to another kit voice becomes none**, and so does a target that isn't one of the sound's own parameters (effects, routing). The previous app let a kit voice's LFO move a different engine's sound; in this app a sound only modulates itself.
- **RETRIG**: equal to the voice's own number (1 for drum 1 … 6 for the hat) → on (the LFO restarts at each note). 0 or another voice → off (free running).
- **VEL VOL**: 0 → off, anything else → on.

### 4.5 Constants for parts a kit voice doesn't have

Every sound has every control (5.19). Where the kit voice has no byte for a control, the import sets:

| Sound param | drum | snare | metal and hat |
|---|---|---|---|
| A FREQ / A AMOUNT / A WAVE / A MODE | from the file | 60 / 0 / sine / FM | from the file / FM |
| FM ENV | 127 | 127 | 0 |
| B FREQ / B AMOUNT / B WAVE | 60 / 0 / sine | 60 / 0 / sine | from the file |
| NOISE RATE / NOISE | 127 / 0 | from the file | 127 / 0 |
| REPEAT | 0 | from the file | metal from the file, hat 0 |
| P DECAY / P CURVE / P AMOUNT | from the file | from the file | 20 / 0 / 0 |
| TONE IN / NOISE IN / CLICK IN (filter routing) | on / on / on | off / on / off | on / on / off |
| KIND (5.11) | drum | snare | metal |

### 4.6 Defaults for a short file

A parameter missing from a short file takes: TUNE 60, FINE 64, WAVE sine, PWM 0, A FREQ 60, A AMOUNT 0, A WAVE sine, A MODE FM, NOISE RATE 127, NOISE 0, ATTACK 0, DECAY 40, CURVE 64, REPEAT 0, P DECAY 20, P AMOUNT 0, P CURVE 0, CLICK SNAP, CLICK VOL 0, CLICK RATE 25, CUTOFF 127, RESO 0, TYPE LP, FLT DRIVE 0, LEVEL 100, PAN 64, DRIVE 0, CRUSH 127, VEL VOL on, VEL AMT 0, VEL DEST none, LFO RATE 64, LFO AMT 0, LFO WAVE sine, LFO DEST none, RETRIG off, LFO SYNC 0, PHASE 0. (A full-size file is the normal case; this is only so a damaged file still loads.)

### 4.7 The kit's target lists

VEL DEST and LFO DEST hold an index into one shared list of 229 targets. Index 0 is none and index 1 is the kit-wide sample-rate reducer (treat as none). The rest is six blocks, one per kit voice, in voice order. Within a block, each position is one of that voice's parameters; a dash means "not a sound parameter here" (treat as none). The hat's position 196 is its closed decay and 197 its open decay: each hat sound takes the one that is its own DECAY and treats the other as none.

- **drum 1 (2..39)**: 2 TUNE, 3 FINE, 4 WAVE, 5 PWM, 6 ATTACK, 7 DECAY, 8 CURVE, 9 P DECAY, 10 P CURVE, 11 P AMOUNT, 12 -, 13 VEL AMT, 14 VEL VOL, 15 A AMOUNT, 16 A FREQ, 17 A WAVE, 18 A MODE, 19 CLICK, 20 CLICK VOL, 21 CLICK RATE, 22 CUTOFF, 23 RESO, 24 TYPE, 25 FLT DRIVE, 26 LFO RATE, 27 LFO SYNC, 28 LFO AMT, 29 LFO WAVE, 30 -, 31 PHASE, 32 LEVEL, 33 PAN, 34 CRUSH, 35 DRIVE, 36 to 39 -.
- **drum 2 (40..77)** and **drum 3 (78..115)**: the same 38 positions in the same order (drum 2's TUNE is 40, drum 3's is 78).
- **snare (116..152)**: 116 TUNE, 117 FINE, 118 NOISE RATE, 119 NOISE, 120 WAVE, 121 PWM, 122 ATTACK, 123 DECAY, 124 REPEAT, 125 CURVE, 126 P DECAY, 127 P CURVE, 128 P AMOUNT, 129 -, 130 VEL AMT, 131 VEL VOL, 132 CLICK, 133 CLICK VOL, 134 CLICK RATE, 135 CUTOFF, 136 RESO, 137 TYPE, 138 FLT DRIVE, 139 LFO RATE, 140 LFO SYNC, 141 LFO AMT, 142 LFO WAVE, 143 -, 144 PHASE, 145 LEVEL, 146 PAN, 147 CRUSH, 148 DRIVE, 149 to 152 -.
- **metal (153..190)**: 153 TUNE, 154 FINE, 155 WAVE, 156 PWM, 157 ATTACK, 158 DECAY, 159 REPEAT, 160 CURVE, 161 -, 162 VEL AMT, 163 VEL VOL, 164 A FREQ, 165 B FREQ, 166 A AMOUNT, 167 B AMOUNT, 168 A WAVE, 169 B WAVE, 170 CLICK, 171 CLICK VOL, 172 CLICK RATE, 173 CUTOFF, 174 RESO, 175 TYPE, 176 FLT DRIVE, 177 LFO RATE, 178 LFO SYNC, 179 LFO AMT, 180 LFO WAVE, 181 -, 182 PHASE, 183 LEVEL, 184 PAN, 185 CRUSH, 186 DRIVE, 187 to 190 -.
- **hat (191..228)**: 191 TUNE, 192 FINE, 193 WAVE, 194 PWM, 195 ATTACK, 196 DECAY (closed), 197 DECAY (open), 198 CURVE, 199 -, 200 VEL AMT, 201 VEL VOL, 202 A FREQ, 203 B FREQ, 204 A AMOUNT, 205 B AMOUNT, 206 A WAVE, 207 B WAVE, 208 CLICK, 209 CLICK VOL, 210 CLICK RATE, 211 CUTOFF, 212 RESO, 213 TYPE, 214 FLT DRIVE, 215 LFO RATE, 216 LFO SYNC, 217 LFO AMT, 218 LFO WAVE, 219 -, 220 PHASE, 221 LEVEL, 222 PAN, 223 CRUSH, 224 DRIVE, 225 to 228 -.

In the app, VEL DEST and LFO DEST are stored as a sound parameter id (or none), never as a kit index.

### 4.8 What the reference pack checks

`local/pack/reference/expected/*.json` holds, for every test kit, the seven sounds exactly as this section says they decode (parameter ids as in 5.19, dial positions already converted, switches as true/false). The import test decodes every kit and compares field by field. They must match exactly.

---

## 5. The sound engine (behaviour)

### 5.1 Time base and units

- **Audio** runs at the output rate (44.1 or 48 kHz, whatever the device uses); every frequency below is in Hz and every time in seconds, so nothing depends on the rate.
- **Control rate**: the envelopes, the LFOs and the modulation are updated on a **control tick of 64/44140 s ≈ 1.4500 ms (689.06 ticks per second)**, independent of the audio rate. Run the tick on its own clock (a fractional counter), not "every 64 samples". This rate is part of the sound: decay times are counted in ticks, and fast LFOs on the cutoff sound stepped because of it. Hold control values between ticks unless a part below says to glide.
- **Full scale** is 1.0. A part "at full level" swings between -1 and +1. "Clip" means hard-clip to [-1, +1].
- **Knob values** are the kit's units, 0 to 127. A knob position may be fractional (a morph or a dial between two settings); curves below take x = value / 127.
- **A shaping function** used in several places: `S(x, s) = (1 + s)·x / (1 + s·|x|)` for x in [-1, 1]. s = 0 is a straight line, s > 0 bends towards a quick rise then flat top, -1 < s < 0 bends the other way.

### 5.2 The voice

One engine plays one sound at a time. Each sound has the same parts:

- **Tone**: the main oscillator (WAVE), at the sound's pitch, moved by the pitch envelope and the snap, phase-modulated by A and B.
- **Mod A**: a second oscillator (A WAVE, A FREQ, A AMOUNT). It either phase-modulates the tone (A MODE = FM) or is mixed in beside it (A MODE = MIX), or a blend.
- **Mod B**: a third oscillator (B WAVE, B FREQ, B AMOUNT), always phase-modulating the tone, summed with A.
- **Noise**: sample-and-hold noise at NOISE RATE, crossfaded with the tone by NOISE.
- **Click**: a short generated transient (CLICK, CLICK VOL, CLICK RATE), or a pitch snap (SNAP), or a start-phase setting (PHASE).
- **Filter**: a resonant multimode filter (TYPE, CUTOFF, RESO, FLT DRIVE) on the parts routed into it (TONE IN, NOISE IN, CLICK IN).
- **Amp envelope** (ATTACK, DECAY, CURVE, REPEAT), **pitch envelope** (P DECAY, P CURVE, P AMOUNT).
- **Drive**: a waveshaper (DRIVE). **Crush**: a sample-rate reducer (CRUSH). **Level, velocity, pan**.
- **Modulation**: one LFO and velocity, each aimed at one of the sound's own parameters.
- **KIND**: one of drum, snare, metal. It picks the order of the last stages (5.11), which is part of how each kind of kit voice sounds.

A part is computed only when it can be heard: mod A when A AMOUNT > 0 or the kind is drum or metal; mod B when B AMOUNT > 0 or the kind is metal; noise when NOISE > 0 or the kind is snare; the pitch envelope when P AMOUNT > 0 or the kind is drum or snare. Skipping a part must not change the sound.

### 5.3 Pitch

- **Note to frequency**: equal temperament, MIDI note 69 = 440 Hz: `freq(n) = 440 · 2^((n - 69) / 12)`, for whole notes 0 to 127 (clamp).
- **The tone's base frequency** = `freq(TUNE + (played note - 60))` × the FINE factor. Keys don't transpose, so the played note is 60 unless a morph (section 9) shifts it by whole semitones.
- **FINE factor** = `1 + (FINE/127 - 0.5) · (2^(1/12) - 1)`, a linear factor of about ±2.97% (about ±half a semitone). FINE 64 is very slightly sharp of exact (by 0.023%); keep it.
- **Mod A and mod B frequencies** are absolute notes: `freq(A FREQ + (played note - 60))` × 1.000234 (their fine is fixed at the centre). They don't follow the tone's TUNE and they don't follow the pitch envelope or the snap.
- **The tone's pitch multiplier**, updated each control tick: `m = 1 + P·E + K`, where E is the pitch envelope's output (5.8, 0 when the sound has no pitch envelope), P = `32 · (P AMOUNT/127)²` (so the multiplier starts at up to 33x, about +60.5 semitones), and K is the snap (5.7, 0 unless CLICK = SNAP). The tone plays at base frequency × m.

### 5.4 The waves

All three oscillators use the same six waves. With phase φ in [0, 1):

- **sine**: `-cos(2πφ)` (its lowest point at φ = 0).
- **triangle**: -1 at φ = 0, rising straight to +1 at φ = 0.5, falling back to -1.
- **saw**: a falling ramp, +1 just after φ = 0 down to -1 at the end of the cycle, the jump at φ = 0.
- **square**: +1 for the first half, -1 for the second.
- **pwm**: `clip(saw(φ) - saw(φ + w))` with w = PWM/127 × 0.5. That is a pulse: for a fraction w of the cycle it sits at `2w - 2` (clipped to -1), for the rest at `2w`. PWM 0 is silence (both saws cancel); PWM 127 is a square at full level. Small PWM gives a thin pulse riding on a small positive offset; keep that, it's how these sounds are.
- **noise**: sample-and-hold white noise at the oscillator's frequency: a new uniform random value in [-1, 1) each time the phase wraps, held between. So the noise's "pitch" is its rate.

**Band-limiting** (triangle, saw, square and the two saws inside pwm): the tone's brightness depends on which octave the current frequency f is in, and these sounds were made with fairly dull high octaves. Build each wave from its harmonic series and keep harmonics up to about these numbers (never above Nyquist), with a smooth roll-off towards the top (harmonics near a third of the limit at about 0.9 of their ideal level, near the limit at about 0.4):

| f (Hz) | saw | square | triangle |
|---|---|---|---|
| below 440 | 45 | 49 | 9 (odd harmonics at 1/n², all audible ones) |
| 440 to 880 | 28 | 31 | 9 |
| 880 to 1760 | 16 | 17 | 7 |
| 1760 to 3520 | 9 | 12 | 5 |
| 3520 to 7040 | 5 | 8 | 3 |
| 7040 to 14080 | 2 | 5 | 3 |
| 14080 and up | 1 (a sine) | 3 | 3 |

Saw: all harmonics at 1/n; square: odd harmonics at 1/n; triangle: odd harmonics at 1/n² with alternating sign. Scale each band-limited wave so its peak is full scale (1.0). The octave is chosen from the frequency at each control tick (with the pitch envelope), and switching tables between ticks is acceptable (the original stepped); a short crossfade is better if it costs little.

**PWM** (the knob) sets the pulse width of every oscillator of the sound that is on pwm: the tone, mod A and mod B share it.

**Start phase on each note**:
- The tone: sine, triangle, saw and square start at φ0 = 0.25 · o, where o = 1 normally, and o = 1 - CLICK VOL/127 when CLICK = PHASE. So by default the sine and triangle start at zero going up, the square at +1, the saw at +0.5. pwm and noise start at φ0 = 0.
- Mod A in the drum kind: the same rule with o = 1 always (PHASE doesn't move it).
- Mod A in the other kinds, and mod B always: φ0 = 0.
- The noise part (5.6) keeps running across notes.

### 5.5 Mod A, mod B and FM

- **Their outputs**: mod A = its wave × A AMOUNT/127; mod B = its wave × B AMOUNT/127. When both run, the modulating signal is `clip(A + B)`.
- **FM is phase modulation with only the positive half**: the tone's phase at each sample is its own running phase plus `D · max(0, M)` cycles, where M is the modulating signal and D the depth below. Negative values of M add nothing (the hardware's conversion saturated negatives to zero, and that one-sided FM is part of the sound: it adds even harmonics and a slight upward pitch pull).
- **Depth scale by the tone's wave**: with the tone on sine, a full-scale M shifts the phase by **1 cycle**; with the tone on triangle, saw, square or pwm, by **4 cycles**. (On noise the tone ignores FM.) Between two waves on the WAVE dial, each of the two is read with its own scale.
- **The depth D**, set each control tick, by FM ENV (e = FM ENV/127) and the kind:
  - e = 1 (drums and snares as imported): `D = A AMOUNT/127 × E`, where E is the pitch envelope's output (5.8). So a drum's FM fades as fast as its pitch drop, and its effective FM index goes with the square of A AMOUNT.
  - e = 0 (metal as imported): D = 1.
  - between: `D = (1 - e) + e · (A AMOUNT/127 × E)`.
- **A MODE** (a = A MODE/127, 6.3 for the dial):
  - a = 0 (FM): as above; the tone's own level is 1.
  - a = 1 (MIX): no FM from A (B still modulates); mod A is added to the tone, after the tone, at A AMOUNT/127; the tone's level is `1 - A AMOUNT/127`. So A AMOUNT crossfades from the tone to the modulator.
  - between: the FM signal from A is scaled by (1 - a), A is added in at a × its level, and the tone's level goes from 1 towards `1 - A AMOUNT/127` by a.
- **NOISE** also scales the tone: the tone's level is multiplied by `1 - NOISE/127` (5.6).
- Sum the tone and the mixed-in A with a clip.

### 5.6 Noise

- White noise, sample-and-hold at **NOISE RATE/127 × 22000 Hz** (0 to 22 kHz): a new uniform value in [-1, 1) each time a phase counter running at that rate wraps. At low rates it's a gritty, pitched rattle; at the top it's nearly white.
- **Level**: 0.9. In the snare kind with its imported routing (5.11) the noise enters the filter at 0.9 and is crossfaded after the filter by NOISE/127; in every other case it enters at `0.9 × NOISE/127`.
- The noise generator for a note is seeded at the note's start from a fixed seed (so offline renders and auto level repeat exactly). Live hits may use the same seed; a fresh seed per hit is also acceptable if Johnny prefers it (ask).

### 5.7 The click

CLICK picks one of three behaviours. CLICK VOL (v = CLICK VOL/127) and CLICK RATE (r = `0.25 + CLICK RATE/33.9`, so 0.25x to 4x, and 1x at about 25) apply to all three.

- **0 SNAP**: no sound of its own; a fast pitch blip on the tone. A value k starts at 1 at each note and falls by `0.2 × r` per control tick until it reaches 0 (so it lasts 5/r ticks: about 1.8 ms at r = 4 to 29 ms at r = 0.25). The tone's pitch multiplier gets `K = 24 · k² · v` added (up to +24x at the start). It makes the hard "tick" of many kicks.
- **1 PHASE**: no sound of its own; it sets where the tone starts its cycle (5.4): the higher CLICK VOL, the further back from the zero crossing, and at the top the sine starts at its lowest point, which makes a hard click.
- **2 to 13: twelve generated clicks**. Each is a one-shot sound about 50 ms long at rate 1, played at rate r (so it lasts 50 ms / r, and its pitch moves with r), at level v, then silent until the next note. They are made by maths at start-up (never sampled audio), designed from these descriptions and tuned against `local/pack/reference/clicks.json` (the measured envelope and 1/3-octave bands of each original, at rate 1) and by ear. Times are at rate 1; "dB" is relative to the click's own peak.

| # | Name | What it is | Envelope | Spectrum |
|---|---|---|---|---|
| 2 | PULSE | One short pulse, a thump of air | full at 0, -18 dB at 2 ms, -38 dB at 4 ms, a faint -40 dB low hum after | mostly below 300 Hz (peaks near 40 and 150 Hz) |
| 3 | SPIKE | A single sharp spike, then a quiet very low tail | spike, then -20 to -30 dB, uneven, to about 40 ms | spike broadband (centre about 600 Hz), tail at 20 to 30 Hz |
| 4 | WOOD | A short tonal knock | builds over 2 ms, -5 dB at 4 ms, -15 dB at 10 ms, -20 dB by 50 ms | a tone near 440 Hz, energy 250 to 600 Hz |
| 5 | THUD | A low tone that holds | near full for 35 ms, uneven, then drops about 25 dB | a tone sliding from about 80 to 40 Hz, almost all below 120 Hz |
| 6 | KNOCK | A knock with body | -3 dB at 4 ms, -8 dB at 8 ms, -18 dB at 16 ms, -36 dB at 32 ms, gone by 45 ms | broad, 150 Hz to 3 kHz, a resonance near 220 Hz |
| 7 | PING | A clear mid ping | -2 dB to 8 ms, -7 at 16, -10 at 24, -17 at 32, -27 at 48 | a tone near 470 Hz rising slightly (to about 495 Hz) |
| 8 | HISS | A burst of bright noise | swells to its peak at 8 ms, -8 dB at 24, -14 at 40, gone at 50 | white-ish noise, most energy 8 to 16 kHz |
| 9 | RATTLE | A noisy rattle that swells and fades twice | -6 dB at the start, dips to -12 at 8 ms, peaks at 30 ms, -14 at 48 | band noise 1 to 3 kHz (centre about 3 kHz) |
| 10 | SUB | A very low double thump | full at 0, dips to -12 dB at 8 ms, swells back at 16 ms, dips and swells again, gone by 48 ms | a 30 to 40 Hz tone |
| 11 | CRACK | A body tone with noise on it | steady within 5 dB to 24 ms, -14 at 32, -18 at 48 | a 200 Hz body with noise up to 8 kHz (centre about 1.5 kHz) |
| 12 | GRIT | A low knock with grit, held | within 6 dB of its peak for 40 ms, then -14 dB | a body at 75 to 90 Hz and mid noise, centre about 1 kHz |
| 13 | TICK | A sharp tick and a thin buzz after it | full at 0, -13 dB at 2 ms, -20 dB at 4 ms, -24 dB for the rest | 2 to 4 kHz, a buzz near 2 kHz |

  Each click peaks near full scale (within -1 to -10 dB of full scale, as in clicks.json). A click is enveloped by the amp envelope like everything else (5.11).

### 5.8 The pitch envelope

- At each note its value u starts at 1. Each control tick u falls by `d = min(1, 2(1 - x)/(1 + 198x))` (x = P DECAY/127) until it reaches 0. So it lasts about `(1 + 198x) / (2(1 - x))` ticks: one tick at 0, 51 ms at 32, 148 ms at 64, 1.08 s at 112, and it never decays at 127 (Appendix A).
- Its output is `E = S(u, s)` with `s = 2a/(1 - a)`, a = (P CURVE/127 - 0.5) × 2, a clamped to at most 0.9995 (the hardware gave a broken result at 127; don't copy that). P CURVE 64 is about linear; low values make the drop fast and the tail long (like an exponential); high values hold the pitch up and drop it late.
- E feeds the tone's pitch multiplier (5.3) and, through FM ENV, the FM depth (5.5).

### 5.9 The amp envelope

- **Stages**: attack (rising from 0 to 1), then decay (falling from 1 to 0), then silence. No sustain, no release: note-offs are ignored.
- **Attack**: each control tick the value rises by `min(1, 2(1 - x)/(1 + 198x))` (x = ATTACK/127). ATTACK 0 is one tick (immediate), 32 is 51 ms, 64 is 148 ms; ATTACK 127 never rises (the sound stays silent; keep it, it's the format's meaning).
- **Decay**: each tick the value falls by `min(1, 2(1 - x)/(1 + 1998x))` (x = DECAY/127). DECAY 0 is one tick, 1 is 13 ms, 16 is 210 ms, 32 is 490 ms, 64 is 1.47 s, 96 is 4.5 s; DECAY 127 never decays (the sound rings until the next note on its engine).
- **CURVE**: a = (CURVE/127 - 0.5) × 1.999; the decay's output is `S(value, 2a/(1 - a))`, the attack's is `S(value, -2a/(1 + a))` (the mirror curve). CURVE 64 is about linear; low values give a punchy exponential-like fall and a slow attack start; high values hold the level up and drop it at the end (a gated, boxy shape).
- **REPEAT** (n = REPEAT, a whole number): when n > 0, the note skips the attack: the value starts at 1 and falls at the **attack** rate (shaped by the decay curve) to 0, then jumps back to 1, n times in all; then the normal decay runs from 1. So there are n short hits then the main one, spaced by the ATTACK time: claps and flams. A short hit may dip just below zero before it restarts; that's fine.
- **How the gain is applied**: drum kind: the gain glides linearly across each control tick from its previous value to its new one, except when ATTACK is 0 (a one-tick attack): then, during the attack and the repeats, it jumps straight to the new value. Snare and metal kinds: the gain is held for the whole tick and steps at each tick (the steps are part of the sound of their fast decays; keep them, and A/B compare a glided version only if Johnny asks).

### 5.10 The filter

- **Cutoff**: `fc = 9931.5 Hz × S(x, -0.9473)` with x = CUTOFF/127, i.e. `9931.5 · 0.05268x / (1 - 0.94732x)`. CUTOFF 0 is 0 Hz, 32 is 173 Hz, 64 is 505 Hz, 96 is 1.39 kHz, 112 is 2.8 kHz, 127 is 9.93 kHz (Appendix A). This is a strongly bent curve: most of the knob is below 1 kHz, and the top is under 10 kHz.
- **Damping**: `R = 1 - RESO/127`, except that when that is below 0.1 it becomes 0.02 (so near the top of RESO the filter jumps to a ringing, near-self-oscillating state). R = 1 is no resonance (Q 0.5); R = 0.02 is Q about 25.
- **Input drive**: the filter's input is multiplied by `g_in = 0.4 + 6 · (FLT DRIVE/127)²` (0.4 to 6.4) and then soft-clipped by `2·tanh(x/2)`. Note the 0.4: with FLT DRIVE at 0 the filtered signal comes out about 8 dB quieter than it went in. That level is part of how the kits are balanced; keep it.
- **The core** is a two-pole state-variable filter in the zero-delay-feedback (trapezoidal integration) form, with `g = tan(π · fc / fs)` and damping R, giving low-pass L, band-pass B and high-pass H from one state. Two nonlinearities: the first integrator's state is passed through `2·tanh(s/2)` each sample (this tames and colours the resonance), and the LP output through a gentle tanh-like saturator.
- **Types** (the TYPE dial, section 6):
  - **LP**: the saturated L.
  - **BP**: B, whose peak gain rises with resonance (1/(2R)): loud and ringing at high RESO.
  - **UNITY BP**: 2R·B, peak at unity.
  - **HP**: x - 2R·B - L (x the driven input).
  - **NOTCH**: x - 2R·B.
  - **PEAK**: L - HP.
  - **LP2**: a different, simpler resonant low-pass: two one-pole low-passes in series with feedback. With `c = 2.21 · fc / fs` as the one-poles' coefficient and feedback `k = (1 - R) · (1.4 + 1/(1 - c))`, per sample: `a ← a + c·((x - a) + k·(a - b))`, then clip a to ±1; `b ← b + c·(a - b)`, then clip b to ±1; output b. Same driven input x.
  - **OFF**: the input passes untouched (no drive, no soft clip).
- **The output is clipped** to full scale.
- **Reset**: in the drum kind the filter's state is cleared at each note; in the others it carries over.
- Above `fc ≥ 0.4499 fs` (not reachable from the knob, only by modulation at low sample rates) set R = 1 to stay stable.

### 5.11 Routing and the finishing stage (KIND)

Per sample, with T the tone (with mixed-in A, at its levels from 5.5), N the noise, C the click:

**General path** (drum and metal, and any snare whose routing has been changed from its imported setting):

1. `F = (T if TONE IN) + (C if CLICK IN) + (N if NOISE IN)`, clipped. If anything is routed in, F goes through the filter.
2. Add the parts not routed in: `Y = filter(F) + (T if not TONE IN) + (C if not CLICK IN) + (N if not NOISE IN)`, clipped.
3. Then by kind:
   - **drum**: `Y × amp gain (glided, 5.9)` → `× velocity/127` if VEL VOL is on → **drive** (5.12), with its shaping amount smoothed by a one-pole of about 2.3 ms → `× LEVEL/127` (smoothed, about 2.3 ms).
   - **metal**: `Y × (LEVEL/127 × [velocity/127 if VEL VOL] × amp gain (stepped))` → **drive**. Note that LEVEL comes before the drive here, so LEVEL changes how hard a metal sound is driven.

**Snare path** (kind snare with TONE IN off, NOISE IN on, CLICK IN off, i.e. as imported):

1. The noise alone, at 0.9, goes through the filter: `Nf = filter(0.9 · N)`.
2. `Y = T + Nf × NOISE/127 + C` (T already carries its `1 - NOISE/127`).
3. `Y × (LEVEL/127 × [velocity/127 if VEL VOL] × amp gain (stepped))` → **drive**.

So in a snare the tone and the click are never filtered, the noise always is, and LEVEL feeds the drive. Then for every kind: **crush** (5.13), then out.

Clipping in the snare path: T + Nf + C isn't clipped before the gain, and the original wrapped round (an integer overflow) when `(T + Nf + C) × gain` went past full scale, making a harsh crackle on a few loud snares. **Don't reproduce the wrap**: clip that product at full scale instead. Note it in the README as a known, deliberate difference.

### 5.12 Drive

A waveshaper on the voice: `y = S(x, k)` with `k = 2s/(1 - s)`, s = DRIVE/127 - 1/128. DRIVE 0 is k = -0.016 (a hair of expansion, effectively clean), 32 is k = 0.65, 64 is 1.97, 96 is 5.9, 112 is 13.9, 127 is k = 254 (a near-square). Its input is clipped to ±1 first. Because it comes after the amp envelope, the tail of a sound gets cleaner as it decays.

### 5.13 Crush (sample-rate reduction)

The voice's output is sampled and held at a rate of `44140 Hz × S(x, -0.8235)` (x = CRUSH/127, i.e. `0.17652x / (1 - 0.82348x)`), with no filtering: a counter adds rate/fs each output sample and takes a new sample when it passes 1. CRUSH 127 is 44.14 kHz (at a 44.1 or 48 kHz output, effectively off: skip it), 112 is 25 kHz, 96 is 15.6 kHz, 64 is 6.7 kHz, 32 is 2.5 kHz, 0 holds forever (silence after the first sample; keep it).

### 5.14 Level, velocity and pan

- LEVEL is linear: LEVEL/127. Velocity is linear: velocity/127, applied when VEL VOL is on.
- **PAN** is equal-power: left = `sqrt((127 - p)/127)`, right = `sqrt(p/127)`. It is read at each note's start and held for that note, so an LFO aimed at PAN places each hit somewhere new rather than sweeping a ringing sound.
- **Into the mix**: each engine's output × the key's TRIM (auto level, gliding over a few ms when changed while ringing) × 0.8 → panned → the dry mix, and × the key's REVERB send → the reverb (7.1).

### 5.15 Modulation: velocity and the LFO

Each sound has one LFO and one velocity route, each aimed at one of the sound's own parameters (or none).

- **How a target moves**: every control tick, the target's **effective** value is worked out from its knob value and the modulator: `x' = clamp(value/127 + amount · (2·m - 1), 0, 1)`, where m is the modulator's output in [0, 1] and amount = AMT/127. The parameter then behaves exactly as if its knob were at `127 · x'` (through all its curves above). The knob itself doesn't move. So m = 0.5 means no change, m = 1 adds the amount, m = 0 subtracts it.
- **Velocity**: m = velocity/127, set at note-on and held for the note. (At velocity 64 the target is nearly as set; harder hits push it up, softer ones down.)
- **LFO**: m is the LFO's output.
- **Both on the same target**: the LFO wins (the velocity route is ignored for that parameter).
- **Stepped targets**: when the effective value feeds TUNE it moves in whole semitones (`floor(127 · x')`), which gives the stepped, arpeggio-like pitch wobble many kits use. A FREQ and B FREQ step in semitones the same way. FINE, ATTACK, DECAY, P DECAY, P AMOUNT, the CURVEs, REPEAT, CLICK RATE, PAN and LFO SYNC also step in whole knob values (`floor(127 · x')`), and VEL VOL is on when that is 1 or more. Everything else (CUTOFF, RESO, A and B AMOUNT, LEVEL, DRIVE, NOISE, NOISE RATE, PWM, FLT DRIVE, CRUSH, CLICK VOL, LFO RATE, LFO AMT, PHASE, VEL AMT) moves continuously.
- **Choice targets** (WAVE, A WAVE, TYPE, CLICK, LFO WAVE): from a setting, the modulated value steps through the choices in **kit order** (4.4): `choice = floor(N · x')` capped at N - 1, where N = 6 for waves, 8 for LFO WAVE, 14 for CLICK, and for TYPE `floor(7·x' + 1) - 1` capped at 6 (it never reaches OFF). Here x' starts from the choice's kit number / 127, so a small amount only reaches the next choice or two. (When the knob sits between two settings, 6.4.)
- **LFO RATE**: `200 Hz · y³` with y = 1/128 + x · (127/128): from about 0.0001 Hz at 0 to 26 Hz at 64, 87 Hz at 96 and 200 Hz at 127.
- **LFO SYNC** 1 to 11: the rate follows the BPM instead: `BPM/240 × q` cycles per second, q = 0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 16, 32 (shown as 4/1, 2/1, 1/1, 1/2, 1/3, 1/4, 1/6, 1/8, 1/12, 1/16, 1/32 of a bar). 0 is off.
- **LFO WAVE** (outputs in [0, 1], phase p in [0, 1)): 0 sine `(1 - cos 2πp)/2` (starts at 0), 1 triangle `1 - |2p - 1|`, 2 ramp up `p`, 3 ramp down `1 - p`, 4 square (0 for the first half, 1 for the second), 5 random (a new uniform value each cycle, held), 6 exp up `p³`, 7 exp down `(1 - p)³`.
- **The LFO advances once per control tick** (its phase moves by rate × tick). At fast rates that is coarse on purpose: a 100 Hz LFO is updated about 7 times per cycle, which gives fast LFO sounds their grainy, stepped character.
- **RETRIG on**: the phase jumps to PHASE/127 of a cycle at each note. **Off**: the LFO runs free across notes (each engine's sound keeps its LFO's phase; a new sound on the engine starts at PHASE/127). Offline renders (auto level, duds, previews) always start at PHASE/127.
- **What an LFO may target**: any of the sound's own parameters except LFO DEST, VEL DEST, RETRIG, the routing switches and KIND (they're "none"). LFO RATE, LFO AMT and LFO WAVE as targets mean the LFO modulating itself; allow it.

### 5.16 Levels and clipping, summed up

Clip to full scale: after summing A and B; after adding the mixed-in A to the tone; after each sum of parts before and after the filter; the filter's output; the drive's input; the voice's output. A kit sound at LEVEL 127 can reach full scale; the 0.8 mix gain and the master take care of headroom.

### 5.17 Notes, retriggers and the end of a sound

- **Note-on**: (1) the LFO restarts if RETRIG is on; (2) the velocity route is set; (3) the tone and mod A reset their phases (5.4), mod B to 0; (4) the pitch envelope and the snap restart at 1; (5) the amp envelope restarts (attack or repeat); (6) the click restarts from its beginning; (7) the drum kind clears its filter; (8) pan is latched.
- **A new note on a sounding engine** restarts everything as above without a fade: the hard restart (the envelope and phases jumping) is part of the sound of fast rolls on hardware like this. Because the amp envelope restarts from 0 with a one-tick attack, a retrigger mostly lands near a zero crossing anyway. If Johnny hears clicks he dislikes, add an optional 1 ms crossfade (a SETTINGS switch, off as it comes).
- **A sound ends** when the amp envelope has finished (value 0 after its decay) and the output has stayed below -90 dB for 50 ms. A sound with DECAY 127 never ends on its own.
- Every engine is mono: one note at a time (2.3).

### 5.18 What not to copy from the original's behaviour

- The integer wrap-round in the snare path (5.11): clip instead.
- A curve of 127 on the pitch envelope producing an invalid number: clamp (5.8).
- Reading past the end of its tables at very high pitches: irrelevant with your own band-limited waves.
- User samples referenced by a kit (wave or click numbers outside the built-in sets): handled by the clean-up rules (4.4).
- Anything the kit's effects, routing and MIDI bytes did: ignored (4.3).

### 5.19 The sound's parameters

Every engine has these controls, in this order. All are 0..127 (stored as numbers; dials and morphs may hold fractions). Ids are suggestions; labels are what the screen shows.

| Section | Id | Label | Notes |
|---|---|---|---|
| OSC | tune | TUNE | a note number, shown as a note name |
| | fine | FINE | plus-minus, centre 64 |
| | wave | WAVE | dial (6.1) |
| | pwm | PWM | |
| MOD A | aFreq | A FREQ | a note number, shown as a note name |
| | aAmount | A AMOUNT | |
| | aWave | A WAVE | dial (6.1) |
| | aMode | A MODE | dial FM ↔ MIX (6.3) |
| | fmEnv | FM ENV | |
| MOD B | bFreq | B FREQ | note name |
| | bAmount | B AMOUNT | |
| | bWave | B WAVE | dial (6.1) |
| NOISE | noiseRate | NOISE RATE | shown in Hz |
| | noise | NOISE | the noise/tone balance |
| AMP | attack | ATTACK | ms |
| | decay | DECAY | ms / s |
| | repeat | REPEAT | whole numbers, 0..15 on the knob (kits use up to 11) |
| | ampCurve | CURVE | plus-minus look, centre 64 |
| PITCH | pDecay | P DECAY | ms |
| | pCurve | P CURVE | |
| | pAmount | P AMOUNT | shown in semitones of the starting jump |
| CLICK | click | CLICK | a menu of 14: SNAP, PHASE and the twelve of 5.7 (2 cells) |
| | clickVol | CLICK VOL | |
| | clickRate | CLICK RATE | shown as a rate (0.25x … 4x) |
| FILTER IN | toneIn, noiseIn, clickIn | TONE IN, NOISE IN, CLICK IN | on/off switches (one cell each) |
| FILTER | cutoff | CUTOFF | Hz |
| | reso | RESO | |
| | type | TYPE | dial (6.2) |
| | fltDrive | FLT DRIVE | |
| VELOCITY | velDest | VEL DEST | a menu of the sound's own parameters (2 cells) |
| | velAmount | VEL AMT | |
| | velVol | VEL VOL | on/off |
| LFO | lfoRate | LFO RATE | Hz, or a note length when synced |
| | lfoSync | LFO SYNC | menu: OFF, 4/1 … 1/32 |
| | lfoAmount | LFO AMT | |
| | lfoWave | LFO WAVE | menu of 8 |
| | retrig | RETRIG | on/off |
| | phase | PHASE | |
| | lfoDest | LFO DEST | a menu of the sound's own parameters (2 cells) |
| MIX | crush | CRUSH | shown as a sample rate, OFF at 127 |
| | drive | DRIVE | |
| (hidden) | kind | | drum, snare or metal; shown in the key header ("kick · drum finish"), changed only by import, RECIPE and paste |
| OUTPUT (per key) | level, pan, send, trim | LEVEL, PAN, REVERB, AUTO | not part of the sound for the randomisers: ALTER doesn't move them, new sounds keep the send |

A suggested grid of 14 columns, four rows, with REVERB, PAN and LEVEL in the right-hand columns: OSC (4) · MOD A (5) · MOD B (3) · NOISE (2) / AMP (4) · PITCH (3) · CLICK (4: CLICK takes 2) · FILTER IN (3) / FILTER (4) · VELOCITY (4: VEL DEST takes 2) · MIX (2) / LFO (8: LFO DEST takes 2). Check every knob sits on the shared column positions at every screen size; move a section, never break the grid.

---

## 6. Dials between settings

Johnny's previous app turned the three switch-like settings of a sound into dials, so two sounds can blend. Keep that. **On a setting, the sound is exactly the setting's sound.** Between two settings:

### 6.1 WAVE, A WAVE, B WAVE

Dial order and positions: **sine 0, tri 25, saw 50, square 75, pwm 100, noise 125** (127 is still noise). Between two neighbours, both waves are read at the same phase (one phase counter at the oscillator's frequency) and crossfaded linearly by how far along the dial is. Each wave keeps its own band-limiting and FM depth scale (5.5). Next to noise, the noise holds its value per cycle as usual. The start phase on a note is the nearer wave's.

### 6.2 TYPE (filter)

Dial order and positions: **LP 0, BP 18, UNITY BP 36, HP 54, NOTCH 72, PEAK 90, LP2 108, OFF 126** (127 is still OFF). Between two neighbours, both types' outputs are taken from the same filter state and crossfaded linearly (LP2 runs alongside when one side is LP2; the dry input when one side is OFF). Johnny found the previous version clicked and jumped in level between types. **Requirement**: moving TYPE at any speed during a note must not click (no discontinuity bigger than the signal's own largest sample-to-sample step), and between two settings the level should stay between the two ends' levels (measured with pink noise; within 1.5 dB of the straight line between them in dB). On a setting the output is exactly that type's.

### 6.3 A MODE

0 is FM, 127 is MIX, between is the blend of 5.5.

### 6.4 Modulating a dial

From a setting, modulation steps through the choices in kit order (5.15). From a position between two settings, it moves continuously along the dial: `position' = 127 · clamp(position/127 + amount·(2m - 1))`.

---

## 7. FX and master

Order: every engine's dry output and the reverb return → DISTORTION → COMPRESSOR → OUTPUT LEVEL → the speakers. The kit files' own effects bytes are ignored (4.3).

### 7.1 Reverb (new)

- One stereo send reverb, fed by each key's REVERB send and returned at unity. Johnny liked the previous one: aim for the same kind of sound, written new. A dense, smooth, slightly dark room-to-hall reverb with early reflections, whose two sides are equally loud and unlike each other so the tail spreads between the speakers.
- Knobs: SIZE, DECAY, TONE (damping, dark to bright), EARLY (early reflection level), PRE-DELAY (0..100 ms), WIDTH.
- Build it from a published design (a feedback delay network, or an allpass-loop plate from the literature), with slow modulation in the loops to avoid metallic ringing. No click when any knob moves; SIZE changes glide.

### 7.2 Distortion

- `sound/dirt.js` copied (3.1), and its UI: DIRT section on the FX + MASTER tab: ON, PREGAIN, FILTER and swap, XOVER, GAIN, CLIP (diode / LED), BASS, TONE, DIRTY, CLEAN; SIDECHAIN: ON, SOURCE (the mix or ENGINE 1 to 6), filter type, FREQ, SENS, DECAY, the ENV meter, direction and target. Off until ON is pressed.

### 7.3 Compressor (written fresh)

- A feed-forward, soft-knee compressor on the stereo master (linked detection), with THRESHOLD (0 to -40 dB, 0 = off), RATIO (1:1 to 20:1), ATTACK (1 to 100 ms), RELEASE (10 to 1000 ms), KNEE (0 to 24 dB), MAKEUP (0 to +24 dB) and a gain-reduction meter. Defaults: threshold -12 dB, ratio 3:1, attack 5 ms, release 120 ms, knee 6 dB, makeup 0.
- Smooth gain: no zipper on fast attacks, no click when THRESHOLD crosses into or out of off.

### 7.4 Output

- OUTPUT LEVEL 0..100%, then a gentle safety limiter (no overs, no clicks): above 0.9 of full scale, a soft knee into 1.0. Peak meters per engine.

---

## 8. Kits, sounds and the randomisers

### 8.1 Words

- A **kit**: one imported `.SND` file: a name and seven sounds (4.2).
- A **kit sound**: one of those, with its own name (2.9), its kit's name, its slot (drum 1 … hat open) and a **type** (8.3).
- The **library**: every kit sound of every imported kit, plus the 12 starter sounds (8.6).
- A **patch** (preset): all 25 keys, the engine count, the effects, the master and the BPM.
- **Types**: kick, tom, perc, zap, snare, clap, rim, bell, closed hat, open hat, cymbal, other. They match the MAKE THIS KEY buttons.

### 8.2 The KITS menu

- **IMPORT KITS**: pick one or many `.SND` files (or a folder, where the browser allows it; drag and drop onto the page works too). Each is read (4), named, typed, measured for auto level in the Worker, and stored in IndexedDB with its bytes' hash (the same file twice is one kit). The message line says how many kits and sounds came in and how many were skipped and why.
- **The list**: each kit with its name, file name, date added, and its seven sounds as small buttons (click to hear one on the selected key's engine without changing the key; **PUT ON KEY** puts it on the key last played, undoable). **X** then **SURE?** deletes a kit (keys already using its sounds keep them).
- **DEAL KIT**: puts one kit's sounds on the selected engine's keys (the kit's seven, then repeats with ALTER for keys beyond seven), undoable. A quick way to play a whole kit.
- **EXPORT KITS / IMPORT** are not needed: the kits are Johnny's files on his disk.
- An empty library (nothing imported yet) says so on the KITS button ("KITS · none yet, IMPORT") and the randomisers use the starter sounds.

### 8.3 Types, worked out on import

Each kit sound gets a type from its slot and its measured render (velocity 100, offline): f0 = the tone's starting pitch after any pitch drop (the frequency at 30 ms), the length (time to -40 dB), how noisy it is (spectral flatness over the first 100 ms) and REPEAT.

- **drum slots**: f0 below 90 Hz and length over 150 ms → **kick**; f0 90 to 400 Hz with a clear pitch → **tom**; P AMOUNT over 64 and P DECAY under 20 → **zap**; length under 60 ms and bright → **rim**; noisy → **perc**; otherwise **perc**.
- **snare slot**: REPEAT > 0 → **clap**; length under 80 ms → **rim**; otherwise **snare**.
- **metal and hat slots**: tonal (low flatness) with length over 300 ms → **bell**; length under 150 ms → **closed hat**; length over 800 ms → **cymbal**; otherwise **open hat**.

These thresholds are a start: tune them by listening to the test kits, and let Johnny re-type a sound by hand in the KITS list (a type menu on each sound), which is kept.

### 8.4 Ranges learned from the library

Each parameter gets a **usual range** per type: the 10th to 90th percentile of the library's sounds of that type (with 5 or more of the type; else of all sounds; else a hand-written starting range). Recompute when the library changes. ALTER and FREE stay inside the usual range unless WILD is on (then the whole 0..127). These ranges are computed in the browser from Johnny's imported kits and never written into the repo.

### 8.5 The randomiser sources

Every one keeps locked keys, closed padlocks and the key's send, applies the pan rule (2.5) and auto level, skips duds (except KIT), and says in the message line what it made and what it kept ("BREED of GOSMAN and TEVYR · kept DECAY").

- **KIT**: a library sound as it is (not the one the key has now). Prefer sounds from kits not yet on the patch.
- **BREED**: two library sounds crossed section by section (OSC, MOD A, MOD B, NOISE, AMP, PITCH, CLICK, FILTER IN + FILTER, VELOCITY, LFO, MIX), at least one section from each parent, then every continuous parameter nudged by 6% of its usual range. Parents of the same type preferred; KIND comes with the section that holds the tone (OSC).
- **MORPH**: two library sounds of the same type blended at a random point between 25% and 75% (section 9's rules).
- **STYLE**: every parameter takes a value that some library sound of the same type has for it (each parameter from a different sound).
- **FREE**: every parameter anywhere in its usual range. The wildest.
- **RECIPE / MAKE THIS KEY**: a sound of a named type: pick a library sound of that type, then ALTER it by 15% within that type's usual ranges. With no library sound of that type, use the starter sound of that type (8.6) and alter it. ANY picks a type at random. A type button is never greyed out.
- **ALTER / ALTER KEY / ALTER ALL**: nudge each parameter around the sound's home by the HOW MUCH amount, within its usual range (WILD: 0..127). ALTER doesn't move OUTPUT (level, pan, send), KIND, the FILTER IN switches, VEL DEST, LFO DEST or SYNC; it may move a dial (WAVE, TYPE) within ±15 of where it is.

### 8.6 The starter set

Twelve sounds written by hand in this engine's parameters, one per type, made and tuned by ear in this project (kick, tom, perc, zap, snare, clap, rim, bell, closed hat, open hat, cymbal, other). They ship in `sounds/starter.json`, are always in the library, and are what CLEAR and an empty library use. They must not be copied or derived from a kit.

---

## 9. Morphing

### 9.1 Features (carried over)

In the RANDOM menu, under INIT PATCH, with captions ("LOWEST KEY TO HIGHEST, STEP BY STEP"):

- **MORPH KEYS**: keeps the lowest and highest keys' sounds (set them first; an end with no sound of its own gets a library sound), and fills every key between with a step of the way from one to the other, across every engine's zone (the whole keyboard).
- **NEW ENDS**: a kick on the lowest key and a sound of another type (snare, clap, rim, perc, bell, hats, cymbal) on the highest, then MORPH KEYS. Press again for another pair.
- **KICK > HAT**: a kick, a snare, a mid perc and a closed hat on four evenly spread keys, each stretch between neighbours morphed.
- All three keep locked keys and closed padlocks, keep the sends, clamp pan to the pan rule, apply auto level, and are undoable.

### 9.2 The blend rules

- **Every 0..127 parameter slides linearly** (the curves of section 5 then make frequencies and times move evenly in pitch and log time, because the knobs are already curved).
- **TUNE**: interpolated, and the fractional part becomes a fine shift (TUNE is whole notes; the remainder goes into FINE's factor, so pitch slides smoothly).
- **Dials** (WAVE, A WAVE, B WAVE, TYPE, A MODE) slide along the dial: a morph from tri (25) to square (75) passes through saw. That's accepted (it's what a dial means).
- **Choices** (CLICK, LFO WAVE, LFO SYNC, VEL DEST, LFO DEST, the FILTER IN switches, VEL VOL, RETRIG, KIND): taken from the nearer end (switch at 50%).
- **A part that is off on one side borrows from the side where it's on**: if A AMOUNT, B AMOUNT, NOISE, CLICK VOL, P AMOUNT, LFO AMT or VEL AMT is 0 in one sound, that part's other settings are taken from the other sound along the whole morph, so the part fades in with the other sound's settings rather than passing through settings neither sound has. (A AMOUNT gates A FREQ, A WAVE, A MODE; B AMOUNT gates B FREQ, B WAVE; NOISE gates NOISE RATE; CLICK VOL gates CLICK and CLICK RATE; P AMOUNT gates P DECAY and P CURVE; LFO AMT gates all LFO settings; VEL AMT gates VEL DEST.)
- **OUTPUT** (level, pan, send, trim) is not morphed by MORPH KEYS: each key keeps its own send, pan follows the pan rule, trim comes from auto level.

### 9.3 Next, after launch (design for it now)

- A live **MORPH** control: a knob (and a CC) that glides the current key between two sounds while playing. The engine takes parameter changes during a note without clicks (CUTOFF, levels and FM amounts glide over about 5 ms at audio rate between control ticks), so this needs no engine change.

---

## 10. Storage formats

All new.

- **Sound** (JSON): `{ v: 1, name, type, kind, from: { kit, slot } | 'starter' | 'made', params: { id: number, ... } }`. Parameters by id, never by position. Unknown ids are ignored; missing ids take their default (4.6), so adding parameters later never breaks a sound.
- **Kit** (IndexedDB only): `{ hash, fileName, name, added, bytes (the 255 bytes), sounds: [7 sounds], types: [7, as edited] }`. Re-read from `bytes` when the reader changes (bump a reader version).
- **Patch / preset** (JSON): `{ v: 1, name, engines, keys: [ by place in layout: { sound, edits, home, lock, out: { level, pan, send, trim } } ], fx: { reverb, dirt, comp, out }, bpm }`.
- **Export files**: `{ app: '<lowercase working name>', kind: 'presets', version: 1, items: [...] }`.
- **localStorage**: the live state (`<name>-v1`), presets (`<name>-presets-v1`), colours (`<name>-colours`). **IndexedDB**: kits.
- Sanitise every import (names, labels, ranges, sizes), since messages are shown as HTML. A kit's 8-character name is shown only after stripping to printable ASCII.

---

## 11. Tests and acceptance

Node tests for the engine and the kit reader (no browser), Playwright for the page. Each part comes with its test. Tests that need `local/pack/` skip with a message when it isn't there.

### 11.1 The kit reader (exact)

- Every kit in `local/pack/kits/` decodes to exactly `local/pack/reference/expected/<id>.json` (field by field, including the dial positions, the cleaned-up targets and the constants of 4.5).
- Hand-made files: a short file, a long file, an empty name, out-of-range bytes, a target pointing at another voice, a user-sample wave and click.

### 11.2 Sounding the same (the main acceptance test)

`local/pack/reference/features/<id>.json` describes how each of the 917 kit sounds (131 kits × 7) sounds, rendered at velocity 100 and 30 (Appendix B has the exact measures). Write `test/compare.mjs`: decode each kit with your reader, render each sound with your engine at 44140 Hz (or render at 48 kHz and measure the same way), measure it the same way, and compare:

| Measure | Pass |
|---|---|
| loudest 100 ms, velocity 100 | within ±1.5 dB |
| loudest 100 ms, velocity 30 (velocity response) | within ±2 dB |
| length (to 60 dB under the loudest 5 ms) | within ±15% or ±20 ms |
| 5 ms envelope, over frames within 50 dB of the peak | mean absolute difference under 3 dB |
| 1/3-octave spectrum averaged over the sound (bands within 40 dB of the loudest band) | mean absolute difference under 3 dB |
| 1/3-octave spectrum over the first 100 ms | mean absolute difference under 4 dB |
| dominant pitch, frames where both have one | within ±0.5 semitone (median over frames) |

Report per sound and a summary (how many pass, the 20 worst with what failed). **Target: 90% of sounds pass every row (aim for 95%), and no sound misses the loudness rows by more than 6 dB.** Sounds with free-running random LFOs or heavy noise get the spectrum rows only. The listening WAVs in the pack (10 kits, each sound) are for Johnny's and your ears: A/B them; Johnny's ear is the final judge.

Expect the clicks, FM and the filter to need the most tuning. Work part by part: the pack's README lists sounds that isolate each part (for example kits whose drums have no click and no FM).

### 11.3 Engine checks

- **Curves**: each value curve of Appendix A, computed at the listed points, matches within 1%.
- **Control tick**: envelopes count ticks of 64/44140 s at 44.1 and 48 kHz alike (with DECAY 32 the envelope's value reaches 0 after 490 ms at both rates).
- **FM**: a sine tone with a sine modulator at full A AMOUNT, FM ENV 0: the phase shift is one-sided (never below the unmodulated phase) and reaches 1 cycle; on a saw tone it reaches 4.
- **Repeat**: REPEAT 3 gives 3 short hits spaced by the ATTACK time, then the main decay.
- **Stability**: 10,000 random sounds (every parameter anywhere in 0..127) never produce NaN, infinity, DC over -40 dB or output over full scale before the mix.
- **Repeatability**: the same sound and velocity render bit-identically twice offline.
- **Dials**: on a setting the output equals the plain setting exactly; moving TYPE and WAVE during a note never clicks; TYPE's level between settings as in 6.2.
- **Performance**: a node benchmark of six engines, reverb, distortion and compressor: under 30% of one core on a MacBook Air M1 and under 60% on a Pixel 9a.

### 11.4 The page

`test/shots.mjs`, adapted: laptop sizes 1440 x 900, 1280 x 800, 1440 x 760, 1280 x 700 and phone 412 x 915, 412 x 780, 360 x 640 with touch. Every knob on the shared column positions, nothing scrolls, the longest status message fits, and the flows: kit import (using a kit from `local/` when present, else a generated test file), dice, alter, lock, padlocks, copy/paste, undo, presets save/load/export/import, ENGINES 1 to 6, MORPH KEYS, phone pads with two fingers. Plus `test/names-clean.test.mjs` (1.2).

---

## 12. Build order

Each step ends live on GitHub Pages, with its tests, small enough for Johnny to try.

1. **Repo and shell**: the files of 3.1 fetched and scrubbed, the names-clean test, a stub engine (a plain decaying sine) so the page, keys, MIDI, strip, menus, colours, presets and phone all work. Fresh storage keys. The reference pack unzipped into `local/` (gitignored).
2. **The kit reader** and the KITS menu (import, list, delete, hear a sound), with the exact decode test (11.1).
3. **Engine core**: the instrument, the worklet, the Worker for offline renders; the control tick; the tone with all six waves and band-limiting; pitch, FINE; the amp envelope with CURVE and REPEAT; LEVEL, velocity, PAN. The compare test running (most sounds will fail; that's the to-do list).
4. **Pitch envelope, snap and PHASE; mod A and B with one-sided FM, FM ENV and MIX.** Re-run compare.
5. **Noise, the filter (all types, drive, the 0.4 input level), routing and the three kinds' finishing stages, drive, crush.** Re-run compare.
6. **The twelve generated clicks**, tuned against clicks.json and the compare test.
7. **Modulation**: velocity and the LFO, with stepped and choice targets. Compare should now pass its target (11.2).
8. **The parameter list and the knob grid** for the whole voice, on the grid at every size; the dials of section 6 with their click and level tests.
9. **FX and master**: the reverb, the copied distortion, the new compressor, the output limiter, the FX + MASTER tab.
10. **Auto level, types, usual ranges and the dud filter.**
11. **Randomisers**: KIT, BREED, MORPH, STYLE, FREE, RECIPE, MAKE THIS KEY, ALTER, INIT PATCH, padlocks, the pan rule; the starter set.
12. **Morph keys**: MORPH KEYS, NEW ENDS, KICK > HAT.
13. **Phone screen** brought up to date.
14. **Polish**, then the live MORPH control (9.3).

---

## 13. Open questions for Johnny

1. **Name**: VANDORU is a working name made by the app's own name jumbler. Keep it or pick another?
2. **Licence** for the new repo.
3. **Noise per hit**: the same noise every hit (repeatable, as offline) or fresh noise every hit (livelier, as the hardware)? This spec assumes the same for offline, fresh live; say if you want it fixed both ways.
4. **Closed hats**: the previous app only ever played each kit hat with its open decay. This app imports both. Keep both, or open only?
5. **Retrigger clicks**: hardware-style hard restarts (as it comes) or a 1 ms crossfade (an option in SETTINGS)?
6. **Echo**: METAMORF dropped the echo. This spec drops it too. Say if you want it back for this app.

---

## Appendix A: value curves at a glance

Computed from the formulas in section 5 (times are counted in control ticks of 1.45 ms, so short values are whole ticks).

| value | ATTACK | DECAY | P DECAY | CUTOFF | CRUSH rate | LFO RATE | NOISE RATE | CLICK RATE |
|---|---|---|---|---|---|---|---|---|
| 0 | 1.45 ms | 1.45 ms | 1.45 ms | 0 Hz | 0 Hz | 0.0001 Hz | 0 Hz | 0.25x |
| 1 | 2.9 ms | 13.0 ms | 2.9 ms | 4.2 Hz | 62 Hz | 0.0008 Hz | 173 Hz | 0.28x |
| 4 | 5.8 ms | 49 ms | 5.8 ms | 17 Hz | 252 Hz | 0.012 Hz | 693 Hz | 0.37x |
| 8 | 11.6 ms | 99 ms | 11.6 ms | 35 Hz | 518 Hz | 0.07 Hz | 1386 Hz | 0.49x |
| 16 | 21.7 ms | 210 ms | 21.7 ms | 75 Hz | 1095 Hz | 0.47 Hz | 2772 Hz | 0.72x |
| 24 | 34.8 ms | 339 ms | 34.8 ms | 120 Hz | 1744 Hz | 1.49 Hz | 4157 Hz | 0.96x |
| 32 | 50.7 ms | 490 ms | 50.7 ms | 173 Hz | 2477 Hz | 3.43 Hz | 5543 Hz | 1.19x |
| 48 | 88 ms | 882 ms | 88 ms | 308 Hz | 4276 Hz | 11.2 Hz | 8315 Hz | 1.67x |
| 64 | 148 ms | 1.47 s | 148 ms | 505 Hz | 6712 Hz | 26.2 Hz | 11087 Hz | 2.14x |
| 80 | 247 ms | 2.47 s | 247 ms | 817 Hz | 10198 Hz | 50.7 Hz | 13858 Hz | 2.61x |
| 96 | 448 ms | 4.49 s | 448 ms | 1393 Hz | 15601 Hz | 87.0 Hz | 16630 Hz | 3.08x |
| 112 | 1.08 s | 10.8 s | 1.08 s | 2804 Hz | 25098 Hz | 137.6 Hz | 19402 Hz | 3.55x |
| 120 | 2.48 s | 24.8 s | 2.48 s | 4713 Hz | 33176 Hz | 169.0 Hz | 20787 Hz | 3.79x |
| 126 | 18.2 s | 183 s | 18.2 s | 8631 Hz | 42241 Hz | 195.4 Hz | 21827 Hz | 3.97x |
| 127 | never | never | never | 9932 Hz | 44140 Hz | 200 Hz | 22000 Hz | 4.00x |

Other curves:

- P AMOUNT → starting pitch multiplier `1 + 32(v/127)²`: 16 → 1.51x (+7.1 st), 32 → 3.03x (+19.2 st), 64 → 9.13x (+38.3 st), 96 → 19.3x (+51.2 st), 127 → 33x (+60.5 st).
- DRIVE → k: 0 → -0.016, 16 → 0.27, 32 → 0.65, 64 → 1.97, 96 → 5.94, 112 → 13.9, 127 → 254.
- Amp CURVE → decay shape s: 0 → -1.0 (fast fall), 32 → -0.66, 64 → 0.016 (linear), 96 → 2.1, 127 → about 4000 (holds then drops).
- TUNE (note) → Hz: 24 → 32.7, 36 → 65.4, 48 → 130.8, 60 → 261.6, 72 → 523.3, 96 → 2093, 127 → 12544.

## Appendix B: the reference pack

Johnny attaches `cleanroom-pack.zip` to this project's first message. Unzip it to `local/pack/` (gitignored, never committed). It holds:

- `kits/`: 131 kit files in four folders (the top level, `factory/`, `extra/`, `dlc/`). They are Johnny's test data; never commit them or anything decoded from them.
- `reference/expected/<id>.json`: each kit decoded into its seven sounds (11.1). `<id>` is the kit's path with `/` turned into `__` and `.SND` dropped.
- `reference/features/<id>.json`: for each sound (`drum1`, `drum2`, `drum3`, `snare`, `metal`, `hatClosed`, `hatOpen`), measures of the target sound, rendered at 44140 Hz, note 60, by the original behaviour with this spec's import rules applied (cross-voice modulation removed, free LFOs starting at their PHASE, the kit-wide sample-rate byte ignored):
  - `v100`: `peakDb` (sample peak, dBFS), `loud100Db` (the loudest 100 ms, plain RMS in dBFS; not K-weighted), `lengthMs` (until the 5 ms RMS stays 60 dB under its loudest frame), `env5ms` (5 ms RMS frames in dB, up to the length), `bands20ms` (frames 20 ms apart, centred on t = 20·i ms, each a 2048-point Hann-windowed FFT summed into 1/3-octave bands with centres 1000·2^(k/3) Hz for k = -16 … 12 (25 Hz to 16 kHz), band edges at ±1/6 octave, power in dB, up to 200 frames), `centroid20ms` (spectral centroid per frame, Hz), `pitch20ms` (the strongest spectral peak per frame for the first 25 frames, from an 8192-point zero-padded FFT with parabolic interpolation, or null when the peak is less than 40 times the mean magnitude).
  - `v30`: the same loudness, length and envelope at velocity 30.
  - Exact definitions, so your measurements line up: samples are floats with full scale 1. `peakDb` = 20·log10 of the largest absolute sample. `env5ms`: consecutive frames of 221 samples, each 10·log10(mean square + 1e-12), rounded to 0.1 dB. `loud100Db`: the largest mean square over any 4414-sample window, as 10·log10, rounded to 0.1 dB (-100 when silent). Band frames: hop 883 samples, frame i centred on sample 883·i (samples outside the sound are 0); bin power `|X_k|² · 4 / N²` (N = 2048, no window gain correction); a band is the sum over bins whose frequency `k·44140/N` lies in [centre·2^(-1/6), centre·2^(1/6)); stored as 10·log10, rounded to whole dB (-100 for 1e-10 or less). Centroid: Σ power·frequency / Σ power over bins 1 to N/2 - 1. Pitch: the same windowed 2048 samples zero-padded to 8192, magnitude peak over bins 1 to 4095, parabolic interpolation on log magnitude, null unless the peak is over 40 times the mean magnitude.
  - `reference/isolate.json`: lists of sound ids that isolate one part each (a plain tone with no FM, click, filter or LFO; FM with no filter; each filter type; each click type; noise snares; repeats; LFO on cutoff; LFO on tune), for working part by part.
- `reference/clicks.json`: the twelve original clicks (types 2 to 13) at rate 1 and level 1: `env2ms` (2 ms RMS frames, dB), `bands20ms`, `centroid20ms`, `pitch20ms` as above.
- `reference/wav/<id>--<sound>.wav`: listening renders of 10 kits (all seven sounds each, up to 4 s, 44140 Hz, 16-bit mono).
- `reference/index.json`: the kit ids, files and names.

# VANDORU

A percussion instrument for the browser. It imports drum kits in the 255-byte SND kit format and plays every sound in them, from a 25-key keyboard over Web MIDI, the screen, the computer keyboard or a phone.

The full specification is [docs/SPEC.md](docs/SPEC.md).

## Running

No build step: serve the repo root with any static server and open `index.html`. The page loads ES modules directly.

## Tests

`node test/names-clean.test.mjs` and the other `test/*.test.mjs` files run in node. Tests that need the reference pack (in `local/pack/`, never committed) skip when it isn't there.

`npm run compare` is the main sound test (SPEC 11.2): every sound of the reference pack's kits rendered by this engine and measured against the pack's features. It prints how many pass, each row's count and the 20 worst. `--set plainTone` (or any list in the pack's `isolate.json`) runs one part's sounds, `--only kit#slot,...` single sounds, and `--wav dir` writes our renders for listening.

The browser test needs a local server: `python3 -m http.server 8123`, then `node test/shots.mjs` (screenshots go to `local/shots/`).

## Known differences

- A loud snare whose tone, filtered noise and click together pass full scale is clipped there. The original wrapped round instead (an integer overflow), which gave a few snares a harsh crackle; that isn't copied (SPEC 5.11).
- The filters are tuned an octave above the CUTOFF curve of SPEC 5.10: the compare test matches the reference best there (see `engine/filter.js`).

## Where it is

Built in the steps of SPEC section 12. Done: the shell (1), kit import (2), the engine core (3): the control tick, the six waves, pitch, the amp envelope with CURVE and REPEAT, level, velocity and pan, (4) the pitch envelope, snap, PHASE, mod A and B with one-sided FM, (5) noise, the filter, the routing of each kind, drive and crush, and (6) the twelve generated clicks. Still to come: modulation (7), then the effects (9) and the rest.

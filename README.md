# VANDORU

A percussion instrument for the browser. It imports drum kits in the 255-byte SND kit format and plays every sound in them, from a 25-key keyboard over Web MIDI, the screen, the computer keyboard or a phone.

The full specification is [docs/SPEC.md](docs/SPEC.md).

## Running

No build step: serve the repo root with any static server and open `index.html`. The page loads ES modules directly.

## Tests

`node test/names-clean.test.mjs` and the other `test/*.test.mjs` files run in node. Tests that need the reference pack (in `local/pack/`, never committed) skip when it isn't there.

`npm run compare` is the main sound test (SPEC 11.2): every sound of the reference pack's kits rendered by this engine and measured against the pack's features. It prints how many pass, each row's count and the 20 worst. `--set plainTone` (or any list in the pack's `isolate.json`) runs one part's sounds, `--only kit#slot,...` single sounds, and `--wav dir` writes our renders for listening.

The browser test needs a local server: `python3 -m http.server 8123`, then `node test/shots.mjs` (screenshots go to `local/shots/`).

## Where it is

Built in the steps of SPEC section 12. Done: the shell (1), kit import (2), and the engine core (3): the control tick, the six waves, pitch, the amp envelope with CURVE and REPEAT, level, velocity and pan. Still to come: the pitch envelope and FM (4), noise, the filter, drive and crush (5), the clicks (6), modulation (7), then the effects (9) and the rest.

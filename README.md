# VANDORU

A percussion instrument for the browser. It imports drum kits in the 255-byte SND kit format and plays every sound in them, from a 25-key keyboard over Web MIDI, the screen, the computer keyboard or a phone.

The full specification is [docs/SPEC.md](docs/SPEC.md).

## Running

No build step: serve the repo root with any static server and open `index.html`. The page loads ES modules directly.

## Tests

`node test/names-clean.test.mjs` and the other `test/*.test.mjs` files run in node. Tests that need the reference pack (in `local/pack/`, never committed) skip when it isn't there.

The browser test needs a local server: `python3 -m http.server 8123`, then `node test/shots.mjs` (screenshots go to `local/shots/`).

## Where it is

Built in the steps of SPEC section 12. Step 1 (this shell) plays a stand-in sine on every key; the real voice arrives in steps 3 to 7, the reverb and compressor in step 9, kit import in step 2.

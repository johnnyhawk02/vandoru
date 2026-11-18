# VANDORU

A percussion instrument for the browser. It imports drum kits in the 255-byte SND kit format and plays every sound in them, from a 25-key keyboard over Web MIDI, the screen, the computer keyboard or a phone.

The full specification is [docs/SPEC.md](docs/SPEC.md).

## Running

No build step: serve the repo root with any static server and open `index.html`. The page loads ES modules directly.

## Tests

`node test/names-clean.test.mjs` and the other `test/*.test.mjs` files run in node. Tests that need the reference pack (in `local/pack/`, never committed) skip when it isn't there.

# Frotzsmith Roadmap

Frotzsmith is a browser-based **Inform 6** IDE: write, compile to a Z-machine
story file entirely client-side, and play it inline. See
[CHANGELOG.md](./CHANGELOG.md) for what's shipped, and
[`docs/13-v2-roadmap.md`](./docs/13-v2-roadmap.md) for detailed feasibility notes.

## Shipped (v1)

- Client-side Inform 6 → Z-machine compile (Standard Library + PunyInform,
  fuzzily auto-detected), proven byte-identical to a native build
- z3 / z4 / z5 / z8 targets (profile-aware; `.z5` default), full verbose output,
  and footer stats (story size, dynamic memory / 64 KB, free)
- **Inline play** via Parchment + the pure-JS ZVM — light/dark, edge-to-edge,
  fullscreen toggle
- 21 verified samples across both libraries — concept demos (rooms, light,
  daemons, NPCs, puzzles, grammar, devices, randomness…) plus a Haunted House
  port that targets `.z3` — prettified on load; a sample can grey out the
  library it doesn't support
- **Extensions** — bundled `.h` catalog + drop-your-own `.h` / `.zip`, with a
  Borogove-style select/deselect picker that mounts them into the compile
- Prettify (collapses blank lines, indents custom classes), live lint, syntax
  highlighting, click-to-jump errors
- Open `.inf` / Save As, New Project, crash-recovery autosave
- Technical Details page (limits + resources), privacy-friendly analytics
  (Plausible), SEO/OG, accessible, responsive, dark by default
- **Test scripts** — named scripts (CodeMirror editor, localStorage persistence,
  first-class rename, Clear) replayed headlessly via the `StoryEngine`/`replay()`
  Web Worker seam, with live progress + cancel; blessed-output diffing (the Skein)
  is still ahead
- **Play transcript** — interactive Play records the commands you type into a
  read-only **Transcript** tab; one-click **Copy to Test Script** turns a playthrough
  into a reusable script (captured via a verified same-origin `postMessage` from the player)
- Title-bar **Compile / Play**, a branded **SPA loading splash**, **slugified** Save-As /
  Download filenames (`-puny` for PunyInform), and a recorded **red/blue security audit**
  (see the README's Security audits log)

## Planned (v2)

See [`docs/13-v2-roadmap.md`](./docs/13-v2-roadmap.md) for the full assessments.

- **ZIL / ZILF** as a third source language — Zorkie + Pyodide (client-side) or a
  complete ZILF backend, ideally surfaced as a third option in the library/compiler
  selection dropdown alongside Standard Library and PunyInform. The play side is free:
  ZIL compiles to the same z-code.
- **Auto-map** — a play-time map of revealed rooms (the Map tab is stubbed).
- **Extensions registry** — a searchable online catalog.
- **Glulx** — larger games (the `StoryEngine` seam allows it).
- **Multi-`.inf` projects**, and an `app.frotzsmith.com` + landing-page split.

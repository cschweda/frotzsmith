# Frotzsmith Roadmap

Frotzsmith is a browser-based **Interactive Fiction** IDE with two source languages —
**Inform 6** and **ZIL** (via ZILF): write, compile to a Z-machine story file entirely
client-side, and play it inline. See
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
- **Export playable HTML** — one self-contained offline-playable file
  (interpreter inlined via import-map → `data:` URI, story embedded as
  base64); the no-hosting distribution path (itch.io, Neocities, any static
  host)
- Technical Details page (limits + resources), privacy-friendly analytics
  (Plausible), SEO/OG, accessible, responsive, dark by default
- **Test scripts** — named scripts (CodeMirror editor, localStorage persistence,
  first-class rename, Clear) replayed headlessly via the `StoryEngine`/`replay()`
  Web Worker seam, with live progress + cancel — or sent into the live game with
  **Send to Play**; blessed-output diffing (the Skein) is still ahead
- **Play transcript** — interactive Play records the commands you type into a
  read-only **Transcript** tab; one-click **Copy to Test Script** turns a playthrough
  into a reusable script (captured via a verified same-origin `postMessage` from the player)
- Title-bar **Compile / Play**, a branded **SPA loading splash**, **slugified** Save-As /
  Download filenames (`-puny` for PunyInform), and a recorded **red/blue security audit**
  (see the README's Security audits log)
- **Auto-map** — a live Trizbort-style map of the rooms you've revealed, built as you
  play (room names from the status line, exits from your movement); zoom / pan / Fit, a
  graph-paper backdrop, and a per-room hover popover (exits + objects). Per-game, resets
  on compile
- **ZIL — a second source language** *(alpha)* — write ZIL (Infocom's original MDL/Lisp-like
  language) at `/zil/` and compile it client-side with the **ZILF + ZAPF** toolchain (C#/.NET 10)
  built to .NET WebAssembly, run **in a Web Worker** (non-blocking UI; automatic main-thread
  fallback) and lazy-loaded on first compile; `zillib` is
  embedded and the `<VERSION>` directive targets z3 / z5 / z8. A title-strip **I6 ↔ ZIL toggle**
  (Inform 6 `beta` · ZIL `alpha`) with per-language namespaced project state, a basic CodeMirror
  ZIL syntax mode, and 7 ZIL concept demos (Cloak of Darkness, rooms, NPC, puzzle, light, daemon).
  Because ZIL emits Z-code, inline play, the auto-map, test scripts, and the transcript all work
  for it unchanged

- **The Skein** *(v1)* — a branching tree of commands with **blessed-output
  regression diffing**: live play and imported test scripts grow the tree;
  bless a thread's outputs, and every compile re-runs blessed threads
  headlessly, flagging changed nodes red with a blessed-vs-current line diff.
  Play-to-here, per-game IndexedDB persistence, `.skein` export/import.

## Planned (v2)

See [`docs/13-v2-roadmap.md`](./docs/13-v2-roadmap.md) for the full assessments.
- **Richer ZIL tooling** — deeper ZIL syntax highlighting / lint beyond the compiler's
  diagnostics, more samples, and a landing-page language picker at `/` (the title-strip
  toggle is the interim).
- **Extensions registry** — a searchable online catalog.
- **Glulx** — larger games (the `StoryEngine` seam allows it).
- **Multi-file projects**, and an `app.frotzsmith.com` + landing-page split.
- **Publish mode** — hosted card pages (cover, summary, play-online link) for
  works-in-progress and finished games, Borogove-style. Designed and
  deliberately deferred: it requires maintaining hosted storage (Supabase) —
  and every published game — indefinitely. Full design (auth model, data
  model, sandboxed play origin) preserved in
  [`docs/superpowers/specs/2026-07-09-publish-mode-design.md`](./docs/superpowers/specs/2026-07-09-publish-mode-design.md).
  The no-hosting alternative ships first: the self-contained **HTML bundle
  export**, which lets authors distribute via itch.io or any static host with
  zero Frotzsmith infrastructure.

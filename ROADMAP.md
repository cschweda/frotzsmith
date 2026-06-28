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
- 14 verified samples (7 concepts × 2 libraries), prettified on load
- Prettify, live lint, syntax highlighting, click-to-jump errors
- Open `.inf` / Save As, New Project, crash-recovery autosave
- Technical Details page (limits + resources), SEO/OG, accessible, responsive,
  dark by default

## In progress (v1)

- **Extensions** — bundled `.h` catalog + drop-your-own `.h` / `.zip`, with a
  Borogove-style select/deselect picker that mounts them into the compile

## Planned (v2)

See [`docs/13-v2-roadmap.md`](./docs/13-v2-roadmap.md) for the full assessments.

- **ZIL / ZILF** as a third source language — Zorkie + Pyodide (client-side) or a
  complete ZILF backend. The play side is free: ZIL compiles to the same z-code.
- **Auto-map** — a play-time map of revealed rooms (the Map tab is stubbed).
- **Extensions registry** — a searchable online catalog.
- **Glulx** — larger games (the `StoryEngine` seam allows it).
- **Multi-`.inf` projects**, and an `app.frotzsmith.com` + landing-page split.

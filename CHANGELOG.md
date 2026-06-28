# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

> Working alpha — the core IDE compiles and plays Inform 6 entirely in the browser.

### Added — compiler & libraries
- Client-side **Inform 6 → Z-machine** compilation: `inform6` v6.44 built to
  WebAssembly, verified byte-identical to a native build.
- **Standard Library** (v6.12.8) and **PunyInform** (v6.7) bundled and fuzzily
  auto-detected from the source; either can be forced.
- Story-version targets **z3 / z4 / z5 / z8**, profile-aware (Standard → z5/z8;
  PunyInform → z3–z8; `.z5` default). Maximally verbose `-s` output.
- Footer stats: story-file size, dynamic memory / 64 KB (warns near the ceiling),
  total Z-machine free.

### Added — play
- **Inline Play** via the bundled Parchment interpreter + pure-JS **ZVM** (MIT):
  a clean compile runs in the right pane, fully client-side — the story is passed
  to the player iframe as a version-tagged blob URL, no server round-trip. Play is
  gated on a clean compile. Attribution in `public/play/web/README.md`.
- Player is light/dark-aware (follows the IDE), edge-to-edge, with a fullscreen
  toggle.

### Added — editor & authoring
- CodeMirror 6 with Inform 6 syntax highlighting, live linting, click-to-jump
  compile errors, and ⌘/Ctrl+B to compile.
- **Prettify** (structural re-indent); built-in samples are prettified on load.
- **14 verified samples** (7 concepts × 2 libraries): Skeleton, Two Rooms, The
  Hermit (NPC), The Locked Chest (puzzle), Custom Grammar, The Dark Cellar
  (darkness & light), and Timed Candle (daemons), grouped by library.
- **New Project** (title / author / library → skeleton), **Open `.inf`**,
  **Save As**, and crash-recovery autosave.

### Added — site & infrastructure
- **Technical Details** page (`/technical`): the compile→play pipeline, Z-machine
  limits with measured numbers, "why Inform 6 over Inform 7", and a resource list
  (DM4, Inform site, libraries, Z-machine standards).
- `frotzsmith.config.ts` — a single source of truth for identity, toolchain
  versions, Z-machine limits, defaults, and storage keys.
- SEO/OG: a branded `og:image` (SVG + 1200×630 PNG), Open Graph + Twitter Card
  meta, favicons, `robots.txt`, and `sitemap.xml`.
- Footer links to the Changelog, Roadmap, and Technical page.
- `ROADMAP.md` and `docs/13-v2-roadmap.md` (ZIL/ZILF, auto-map, and other v2 notes).
- Dark mode by default with an accessible light/dark toggle; responsive.
- `netlify.toml` for static deployment (`nuxt generate` → `.output/public`) with
  headers tuned so the WASM compiler and ZVM player work under CSP.
- Repository scaffolding: `LICENSE` (MIT), `README.md`, `.gitignore`,
  `.nvmrc` (Node 22), and the design & specification suite in `docs/`.

### In progress
- **Extensions**: a bundled `.h` catalog plus drop-your-own `.h` / `.zip`, with a
  Borogove-style select/deselect picker that mounts them into the compile (the
  compiler already accepts mounted extensions).

### Decided (see `docs/11-architecture-decisions.md`)
- Client-side `inform6` → WebAssembly compilation. Feasibility verified against
  Borogove (compiles I6 client-side in production) and upstream
  DavidKinder/Inform6 v6.44 (Artistic License 2.0). — ADR-001
- Z-machine only in v1; the `StoryEngine` seam + `createEngine` factory ship so
  Glulx can be added later without a refactor. The author does not use Glulx. — ADR-002
- The `.inf` file is the canonical source; localStorage is crash-recovery only,
  with options/scripts as its working store and a project `.json` backup. — ADR-010
- Static deployment via `nuxt generate` (`ssr: false`) to `.output/public`. — ADR-011
- Inform 6 extension catalog: bundled/pinned + local `.h` import (offline);
  remote registry deferred. — ADR-012
- Dark mode by default with an accessible light/dark toggle; WCAG 2.1 AA,
  axe-core zero-violation gate, fully responsive.

[Unreleased]: https://github.com/cschweda/frotzsmith

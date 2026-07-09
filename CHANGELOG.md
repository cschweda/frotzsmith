# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

> Working alpha — the core IDE compiles and plays **Inform 6** and **ZIL** entirely in the browser.

### Fixed — 2026-07-09 Inform 6 compiles off the main thread; first paint slims down
- **Inform 6 compiles in a Web Worker** — with a 60 s wall-clock timeout, a
  fail-fast error channel (`error`/`messageerror`), and an automatic
  main-thread fallback, mirroring the ZILF worker. Closes the 2026-06-30
  audit's tracked Medium: a pathological source can no longer freeze the tab.
- **~1.1 MB of compile-time-only text left the critical-path chunk** — the
  Standard Library + PunyInform `.h` bodies now ride the compile worker's own
  chunk (fetched on first compile, not page load), with a lazy copy behind the
  file explorer's read-only library tabs; the 23 sample bodies are per-sample
  lazy chunks loaded on selection. Critical-path JS drops from ~600 KB gz to
  ~330 KB gz on both pages (ZIL authors previously downloaded the entire
  Inform 6 library before first paint).
- **Error paths fail loudly instead of invisibly** — a thrown compile
  exception (e.g. a failed `inform6.wasm` fetch) surfaces as a fatal
  diagnostic instead of an error banner reading "0 errors" over empty panes;
  the ZIL worker falls back immediately when its script fails to boot (was: a
  silent 60 s hang); the ZIL pre-warm no longer shares the real compiles'
  timeout, so a slow connection can't get the shared worker terminated
  mid-compile and every later compile silently latched onto the main-thread
  freeze; and `useIde` survives blocked or full `localStorage` (new
  `safeGetItem`/`safeSetItem` utility — the IDE previously failed to mount
  under Chrome's "Block all cookies").

### Fixed — 2026-07-02 ZIL compiles off the main thread
- **The ZIL Web Worker is enabled** — ZILF compiles no longer block the UI (warm
  compiles ~5 s fully off-thread; the main-thread path remains as an automatic
  fallback). The historical `dotnet.create()` hang was
  [dotnet/runtime#114918](https://github.com/dotnet/runtime/issues/114918):
  dotnet.js treats a worker with an **assigned `onmessage`** as a managed-pthread
  deputy and never resolves its asset loads. The worker now registers its handler
  via `addEventListener` (which leaves the `onmessage` IDL attribute null), boots
  eagerly on spawn, tags requests with ids, and posts stage breadcrumbs; the
  worker timeout is boot-aware (60 s) instead of shorter than the compile itself.
- **The ZIL compiler pre-warms on `/zil/`** — the first `Compile()` after a cold
  boot pays ~20 s of mono-interpreter warm-up (measured; download + `create()`
  are sub-second on a fast connection), so the page now boots the worker and runs
  a throwaway skeleton compile in the background on mount. The author's first
  real compile behaves like a warm one (~5 s, off-thread). `/zilf/_framework/*`
  also gets a one-week cache header (it previously revalidated ~30 assets per
  session).

### Fixed — 2026-07-01 review batch
- **Run replays test scripts headlessly again** — the per-turn transcript fills the
  Test Script panel in place; the live-game path is now its own **Send to Play**
  button. Replay **timeouts** are reported as timeouts (not "Stopped"), and the
  wall-clock budget scales with script length (15 s + 250 ms/command, capped at 2 min);
  **Stop** keeps working after a mid-run tab switch.
- **Language switches no longer leak state** — navigating `/` ↔ `/zil/` blanks the
  other language's compile result/status/game/queued script (a stale I6 game could
  previously boot inside the ZIL IDE); empty-storage restores reset scripts,
  extensions, and open tabs instead of inheriting (and persisting) the other
  language's; the editor reseeds the language default in **both** directions.
- **Session watchers survive navigation** — crash-recovery autosave (and the
  script-bucket/map/transcript reset watchers) are registered in detached effect
  scopes, so a visit to `/technical` no longer silently kills autosave.
- **Active test-script selection survives compiles and reloads** (compiles no longer
  blank the persisted selection back to "Script 1").
- **Compiler robustness** — Inform 6 source is compiled as UTF-8 (`-Cu`; accented
  prose no longer silently mojibakes), raw WASM traps surface as a fatal diagnostic
  instead of a silent zero-diagnostic failure, and a failed lazy WASM boot (network
  blip) retries on the next compile instead of bricking the session.
- **Main-thread compile UX** — "Compiling…" is guaranteed to paint before the
  synchronous ZIL compile freezes the thread (double-rAF), and clicks queued during
  the freeze can't immediately trigger a second full freeze.
- **Accessibility** — right-pane tabs get accessible names (they were unnamed
  icon-only below 640 px), full tabs semantics (`aria-controls`/`tabpanel`, roving
  tabindex, arrow keys) and an sr-only compile-status cue; editor-tab close is
  pointer-only + **Delete** key (no focusable control nested in `role="tab"`);
  the auto-map SVG uses coherent group/graphic roles; a `<main>` landmark; the
  mobile Source/Output switch announces state (`aria-pressed`);
  `prefers-reduced-motion` is honoured.
- **Auto-map fit** no longer over-zooms tiny maps — a one-room map renders
  room-sized (fit is clamped to ~3 cells across).
- **Security** — extension `.zip` import is capped (200 `.h` entries / 5 MB
  uncompressed, rejected before expansion), closing the 2026-06-30 audit's
  zip-bomb finding; oversized single `.h` uploads are rejected too.
- **SEO** — per-route `canonical`/`og:url` (`/zil/` and `/technical/` no longer
  declare themselves duplicates of the homepage); stale "ZIL coming" OG copy.
- **Send-to-Play feed is event-paced** — command feeding now waits on the game's
  actual DOM output (MutationObserver) instead of fixed timers, so Chrome's
  background-tab timer throttling can no longer stall a script mid-feed; the
  cosmetic per-command delay is skipped while the tab is hidden.

### Added — 2026-07-01 review batch
- **CI** (GitHub Actions): `yarn test` + `yarn typecheck` + `yarn generate` on
  every push/PR.

### Added — compiler & libraries
- Client-side **Inform 6 → Z-machine** compilation: `inform6` v6.44 built to
  WebAssembly, verified byte-identical to a native build.
- **Standard Library** (v6.12.8) and **PunyInform** (v6.7) bundled and fuzzily
  auto-detected from the source; either can be forced.
- Story-version targets **z3 / z4 / z5 / z8**, profile-aware (Standard → z5/z8;
  PunyInform → z3–z8; `.z5` default). Maximally verbose `-s` output.
- Footer stats: story-file size, dynamic memory / 64 KB (warns near the ceiling),
  total Z-machine free.

### Added — ZIL (second source language · alpha)
- **A second language at `/zil/`** — write **ZIL** (Infocom's original MDL/Lisp-like
  authoring language) and compile it to a Z-machine story file entirely client-side,
  alongside Inform 6. A **title-strip toggle** switches the two (Inform 6 `beta` · ZIL
  `alpha`), each with its own `frotzsmith:<lang>:*`-namespaced project state.
- **ZILF/ZAPF compiler in the browser** — the modern **ZILF + ZAPF** toolchain
  (C# / .NET 10) is built offline to **.NET WebAssembly** and committed like
  `inform6.wasm`. It runs **in a Web Worker** (originally main-thread; see the
  2026-07-02 fix above), and the
  ~7.5 MB bundle is **lazy-loaded only on the first ZIL compile** — Inform 6 users never
  download it. The `zillib` standard library is
  embedded; the `<VERSION>` directive drives the **z3 / z5 / z8** target.
- **ZIL authoring** — a CodeMirror 6 **ZIL syntax mode**, compile **diagnostics** parsed
  to the same click-to-jump format as Inform 6, a **ZIL-safe Prettify**, and a
  post-compile **summary** (target · story size · time · diagnostics).
- **7 ZIL concept demos** — Cloak of Darkness, a Skeleton starter, Two Rooms, an NPC,
  a locked-chest puzzle, light & darkness, and a daemon/timed event; each verified to
  compile as a golden case.
- **Shared for free** — because ZIL emits Z-code, inline **play**, the **auto-map**,
  **test scripts**, and the **transcript** all work for ZIL unchanged.
- **Relicensed MIT → GPLv3** — bundling and distributing the GPLv3 ZILF/ZAPF compiler
  requires the combined app to be GPLv3.

### Added — play
- **Inline Play** via the bundled Parchment interpreter + pure-JS **ZVM** (MIT):
  a clean compile runs in the right pane, fully client-side — the story is passed
  to the player iframe as a version-tagged blob URL, no server round-trip. Play is
  gated on a clean compile. Attribution in `public/play/web/README.md`.
- Player is light/dark-aware (follows the IDE), edge-to-edge, with a fullscreen
  toggle.

### Added — auto-map
- **Live Trizbort-style map** — as you play, the **Map** tab draws the rooms you've
  discovered and their connections: room names read from the status line, exits
  inferred from your movement commands, placed on a direction grid over a graph-paper
  backdrop. The current room is highlighted; **zoom / pan / Fit** keep a large map in
  one view. Hovering (or keyboard-focusing) a room shows its essentials — discovered
  exits, objects, and a one-line description. Per-game, reset on compile. Built live
  from hand-play: the room structure is reliable; objects/description are best-effort
  from the game's prose.

### Added — editor & authoring
- CodeMirror 6 with Inform 6 syntax highlighting, live linting, click-to-jump
  compile errors, and ⌘/Ctrl+B to compile.
- **Prettify** (structural re-indent); built-in samples are prettified on load.
- **14 verified samples** (7 concepts × 2 libraries): Skeleton, Two Rooms, The
  Hermit (NPC), The Locked Chest (puzzle), Custom Grammar, The Dark Cellar
  (darkness & light), and Timed Candle (daemons), grouped by library.
- **New Project** (title / author / library → skeleton), **Open `.inf`**,
  **Save As**, and crash-recovery autosave.

### Added — transcript & replay

- Headless **StoryEngine seam** (`app/modules/inform6/engine/`): a `createEngine`
  factory returns a `ZmachineEngine` (the `ifvms` ZVM wired to a headless GlkOte,
  with `normalizeTurnOutput` stripping trailing prompts and Glk input echoes) or a
  `GlulxEngine` stub; Glulx is behind the same factory but not yet implemented
  (ADR-002). Covered by golden, normalize, createEngine, and parseScript unit tests.
- **`replay()` Web Worker primitive** (`replay.worker.ts` + `useReplay` composable):
  runs a command script against the engine fully off-thread; supports cancellation
  and a configurable timeout. `glkapi.js` (Zarf's classic-mode script) is loaded
  via `?raw` + indirect `eval` so it executes inside the strict-ESM worker context.
  The worker chunk is emitted by `nuxt generate` (`replay.worker-*.js`).
- **Test Script tab** in the IDE right pane: a **CodeMirror** script editor
  (`ScriptEditor.vue`) + `TestScriptPanel.vue` with named-script CRUD, a Run /
  Cancel button pair, a live `role="status"` progress region, and the rendered
  turn-by-turn transcript. Named scripts persist to localStorage under the
  `frotzsmith:scripts` key. Run is gated on a clean compile.

### Added — play transcript & test-script UX

- **Play Transcript** — interactive Play now records every command you type into a
  read-only **Transcript** tab (`TranscriptPanel.vue`); **Copy to Test Script** turns a
  captured playthrough into a reusable, named Test Script in one click. Capture is a
  same-origin `postMessage` from the player iframe, verified by origin, a source tag,
  and `e.source`; the captured value is inert data (appended to a list, never executed).
- The original script-runner tab was **renamed Transcript → Test Script**
  (`TranscriptPanel.vue` → `TestScriptPanel.vue`), freeing "Transcript" for the capture.
- **Test Script UX** — first-class rename (a modal text input, replacing the browser
  prompt), a **Clear** button (empties the active script), and a fresh compile blanks the
  play transcript + the last run output (saved scripts are kept, and scripts never
  auto-run — only the Run button executes them).
- **Compile / Play moved into the title bar** (right-aligned; de-duplicated via an
  opt-in `actions` prop on `TitleStrip`). The tab row now holds only tabs; the redundant
  "Ready" status text was dropped (the Results tab's red/green dot signals readiness);
  and the Play iframe stays mounted (`v-show`) so switching tabs no longer restarts the game.
- **Slugified filenames** — Save-As and Download default to a slug of the story's
  `Constant Story` title (fallback `story`), with `-puny` for PunyInform — e.g.
  `haunted-house.inf` / `haunted-house.z5`, `haunted-house-puny.z3`.

### Added — loading & polish

- **SPA loading splash** (`app/spa-loading-template.html`) — a branded dark splash
  (amber spinner + wordmark) shown during the client-only initial load (Nuxt
  auto-detects the template when `ssr: false`), replacing the blank screen.

### Security

- **2026-06-30 red/blue audit** — findings + mitigations recorded in the
  [Security audits](./README.md#security-audits) README log. **Fixed:** the player accepts
  **same-origin `blob:` story URLs only** (closing a `?story=data:` remote delivery vector
  into the ZVM JIT); CSP `connect-src` tightened (dropped `data:` and a dead endpoint) and a
  `Permissions-Policy` header added; the play-command `postMessage` listener pins `e.source`.
  **Tracked (recommended):** zip-bomb decompression caps, worker-isolated compile, analytics SRI.

### Added — file explorer & multi-file editing
- **File explorer** — a collapsible panel (left column on desktop, a slide-over
  drawer on mobile) listing the project's **compilation bundle**: the `story.inf`
  source, enabled extensions, and a read-only **Library** group of the active
  library's `.h` files (the group switches with Standard Library / PunyInform).
- **Tabbed multi-file editing** — open any listed file in its own editor tab
  (one CodeMirror view with a per-file state, so undo history and cursor survive
  tab switches). `story.inf` is always open and non-closable; uploaded extensions
  are editable; library and bundled-extension files open read-only (still
  selectable and keyboard-scrollable, just not editable).
- Panel open/closed state and the set of open tabs persist; clicking a compile
  error still jumps to the source. Toggle the panel from the source toolbar
  (and the explorer's own close button).

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

### Fixed
- Brought the repository to a **clean `yarn typecheck`** (resolved 12 pre-existing
  strict-null / TS-library errors) and **zero axe-core violations** — fixing the
  output-pane tablist's non-tab child, giving the editor textbox an accessible
  name, making the editor scroll region keyboard-focusable, and raising the
  line-number gutter contrast to WCAG AA. The advertised axe-zero / WCAG 2.1 AA
  gate now holds.

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

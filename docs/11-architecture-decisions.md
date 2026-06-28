# Frotzsmith — Architecture Decisions

**Document 11 of 13 · Architecture Decisions (ADR log)**

Each ADR: context → decision → consequences. These are the load-bearing choices; change them and the suite changes.

---

## ADR-001 — Compile client-side via WASM (no backend)

**Context.** The IDE needs to compile I6. Options: a server endpoint running `inform6`, or a WASM build in the browser.
**Decision.** Compile **in the browser** with `inform6` built to WebAssembly.
**Verified (June 2026).** Feasibility confirmed in production: Borogove compiles Inform 6 fully client-side today (it offloads only Inform 7, which is too large). Upstream is healthy — DavidKinder/Inform6 v6.44 (Sept 2025), **Artistic License 2.0**, ~25 portable C files with a standard `main()`. We build our own pinned, single-threaded Emscripten module from upstream (recipe: Doc 01 §2); the 2021 `rockwalrus/Inform6` wasm branch is a stale hand-rolled POC, reference-only.
**Consequences.** (+) No backend, no server cost, deploy-anywhere static, works offline, no upload of source. (+) Matches the markdown editor's static deployment. (−) A few-MB WASM asset to lazy-load. (−) Must build/maintain the WASM artifact. No longer a research risk (proven), but still Phase 1's first task because everything depends on it. Licensing: bundle the compiler under Artistic 2.0 with attribution; the app stays MIT.

## ADR-002 — One `StoryEngine` interface, Z-machine only in v1

**Context.** The author works exclusively in the Z-machine and has never used Glulx. But the Skein/test runner must not branch on VM type, and a later Glulx add-on shouldn't force a retrofit.
**Decision.** Define `StoryEngine` (`boot/send/reset/target`, plus `snapshot/restore` used by Send-to-Play and the future Skein) and a `createEngine(target)` factory **now**, but implement **only `ZmachineEngine` (ZVM/ifvms) in v1**. `GlulxEngine` is a deferred stub: the factory throws "Glulx not yet supported" for `.ulx`. The Glulx target stays visible in the options panel, marked "coming later."
**Rationale for the revision.** The original plan built both VMs from v1; the author confirmed Glulx is never used. Keeping the *seam* costs an afternoon and preserves "no retrofit"; building, headless-shimming, snapshotting, and bundle-supporting a second VM the author won't touch costs weeks.
**Consequences.** (+) Play tab, test runner, and future Skein are VM-agnostic by construction. (+) Glulx drops in later as one new class behind the existing factory — no refactor. (+) Removes Quixe/Emglken, a Glulx headless shim, and Glulx bundle handling from the v1 surface. (−) `.ulx` output isn't playable/exportable until `GlulxEngine` lands — acceptable; the author targets Z-machine. Shared output normalization (ADR-006) still applies so a future Glulx engine stays diff-compatible.

## ADR-003 — Single-threaded WASM (no SharedArrayBuffer)

**Context.** Emscripten can build threaded (pthreads) or single-threaded. Threaded needs `SharedArrayBuffer`, which needs COOP/COEP cross-origin-isolation headers.
**Decision.** Build the compiler **single-threaded**.
**Consequences.** (+) No COOP/COEP headers → "deploy anywhere static" holds, no Netlify-specific header coupling for isolation. (+) Simpler. (−) No threaded speedups (irrelevant for a one-shot compile). Web Workers (message-passing, not shared memory) are still available for off-main-thread compile/replay without isolation headers. **Both compile and replay run in a Web Worker** so a main-thread wall-clock timeout can `terminate()` a runaway — a synchronous compile/replay on the main thread cannot be aborted (the timer can't fire until it returns). This is why the timeout promise in Doc 06 requires the worker; it supersedes Doc 10's earlier "compile on main thread" lean.

## ADR-004 — Library *profiles*, not "the library"

**Context.** Support the standard library and PunyInform. PunyInform is a **replacement** library (different parser/world-model/verbs/init), not a superset; std and Puny source are mutually incompatible.
**Decision.** Model a `LibraryProfile` bundling include set, default Z-version, default switches, highlight keywords, and starter template. Projects carry a profile; v1 ships `std` (default) + `puny`.
**Consequences.** (+) The two libraries coexist without contaminating each other. (+) Adding a future library = adding a profile. (+) Highlighting and templates stay correct per library. (−) Switching profiles can't auto-convert source (surfaced as a warning, not silently attempted).

## ADR-005 — Auto-import via MEMFS preloading

**Context.** A plain `.inf` should compile without the user managing include paths.
**Decision.** On compile, write the active profile's `.h` files into the Emscripten MEMFS and pass the matching `+include_path`. Library files are **swappable, pinned bundles**, versioned independently of the WASM.
**Consequences.** (+) "It just works." (+) Library updates don't require recompiling the WASM. (−) Library bytes ship with the app (small).

## ADR-006 — One shared, VM-agnostic output normalizer

**Context.** Glulx (Glk I/O) and Z-machine expose per-turn text differently. Headless replay and future blessed-output diffing must compare apples to apples or yield false regressions.
**Decision.** A single `normalizeTurnOutput(raw, target)` used by **every** engine's `send()`: canonicalize trailing prompt, handle status-line/banner consistently, normalize whitespace → engine-agnostic text.
**Consequences.** (+) Blessed transcripts are portable across VMs; diffs are honest. (+) Specified in Phase 3 though diffing is Phase 6 — paid early. (−) Its behavior is load-bearing; lock with unit tests before the Skein.
**Status-line decision (locked).** Status-line text is **excluded** from diffable output by default, with a per-script opt-in toggle to include it. Status lines (score/turns/location) churn every turn → false regressions; the few games that encode real state there can flip the toggle on. (Resolves Doc 10 §3 open question 1.)

## ADR-007 — `replay()` is the one testing primitive

**Context.** The author wants flat script→transcript now; a branching Skein later.
**Decision.** Implement a single thin, VM-agnostic `replay(story, target, commands)` (Phase 4). The flat runner uses it directly; every future Skein operation is `replay()` along a path from root.
**Consequences.** (+) The Skein inherits the primitive unchanged — no refactor. (+) Author's real need ships first. (−) Must keep `replay()` minimal and resist baking flat-runner assumptions into it.

## ADR-008 — Composables, not Pinia (house style)

**Context.** The markdown editor uses `use*` composables for all state, no Pinia.
**Decision.** Same here: `useCompiler`, `useProject`, `useReplay`, etc. own state.
**Consequences.** (+) Consistency with the author's codebase; portability of `app/modules/inform6/`. (−) Discipline needed for cross-composable state (singletons via module-scoped refs where shared).

## ADR-009 — Parchment for both play and export

**Context.** Need an inline player and a shareable artifact.
**Decision.** Use Parchment as the play runtime **and** as the embedded runtime in the single-file HTML bundle.
**Consequences.** (+) "What you test is what you ship" — identical runtime. (+) No second player to build. (−) Bundle carries the runtime (size noted, acceptable).

## ADR-010 — Persistence: `.inf` is canonical; localStorage is recovery + working store

**Context.** The author's real source of truth is the `.inf` file they save/export (and archive/ship) — not the browser. Source/options/scripts are small; a Skein tree can be large.
**Decision.** The **`.inf` file is the canonical source artifact.** localStorage holds (a) a crash-recovery snapshot of the working source buffer, and (b) the working copy of compiler options and test scripts, which have no file of their own (namespaced `frotzsmith:*`, quota-graceful). The project `.json` export (Doc 05) is the portable backup of the full working set (source + options + scripts). IndexedDB for the future Skein tree + `.skein` file export.
**Consequences.** (+) A tab crash can't lose work, but the mental model is "my source is a file," not "my source lives in the browser." (+) Simple, proven pattern (mirrors markdown editor). (+) Headroom for the Skein later. (−) Options/scripts live only in localStorage unless exported to `.json` — acceptable for a personal tool; the `.json` export is the safety valve. (−) Two storage mechanisms once the Skein lands — bounded by clear ownership (Skein → IndexedDB only).

## ADR-011 — Static deployment, no SSR

**Context.** The app is a client-side tool; all heavy lifting is WASM/interpreters in the browser.
**Decision.** `nuxt generate` (`yarn generate`) with `ssr: false` → static output at **`.output/public`** on Netlify (the Nuxt 4 path — *not* `dist`, which was Nuxt 2). No SSR. All WASM/interpreter code **and CodeMirror 6** are client-only (CM6 touches `document` and will break prerendering otherwise).
**Consequences.** (+) Offline-capable, cheap, deploy-anywhere. (+) No server runtime to secure. (−) Must guard every WASM/interpreter/CM6 path against SSR (dynamic import / `.client` / `<ClientOnly>`). (−) `netlify.toml` publishes `.output/public`.

> Note: the author's *default* new-project preference is SSR-mode Nuxt; Frotzsmith is a deliberate exception because it's a pure client-side tool with no server-rendered content — flagged per the "flag when Nuxt/SSR doesn't fit" standing instruction.

## ADR-012 — Inform 6 extension catalog: bundled + local import (remote registry deferred)

**Context.** Beyond the base library, I6 authors use community extensions (`.h` contributions). The author wants to browse them, link to their source, and pull one or more into a project — but the app is offline/static with a tight CSP (`connect-src 'self'`).
**Decision.** Ship a **curated, pinned extension catalog** bundled in `app/modules/inform6/extensions/`, surfaced in an Extensions panel that links out to each entry's source and toggles it into `Project.extensions`. At compile, selected extensions' `.h` files are written into MEMFS on the include path — the same auto-import mechanism as profiles (ADR-005). Add a **local `.h` import** escape hatch for anything off-catalog. A **remote/auto-updating registry** (fetch from the IF Archive) is deferred (Doc 10) because it requires relaxing `connect-src`.
**Consequences.** (+) Reuses the profile auto-import machinery — cheap to build. (+) Fully offline; no CSP change. (+) Satisfies both "link to" and "pull in"; selections persist and export with the project. (−) The v1 catalog is only as broad as what's bundled — mitigated by local import. (−) A future remote registry is a deliberate, reviewed CSP relaxation, never silent.

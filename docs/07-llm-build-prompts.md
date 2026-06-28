# Frotzsmith — LLM Build Prompts

**Document 07 of 13 · LLM Build Prompt**
**Purpose:** Self-contained prompts fed to Claude (or another capable coding model) to build each phase. Each prompt assumes **no prior context** beyond what it states, so it can be pasted fresh. Order matters: build phases in sequence; each assumes the prior phase merged.

> House rules baked into every prompt: Nuxt 4, `app/`-rooted, Yarn, Nuxt UI 4, TypeScript, **composables not Pinia**, portable `app/modules/inform6/`, JSDoc on all composables/utils, axe-core a11y gate (zero violations), dark mode by default + accessible light/dark toggle, fully responsive (mobile→desktop), WCAG 2.1 AA contrast, no `v-html` on untrusted content, client-only for all WASM/interpreter code. Match the author's established Nuxt house style (as in the author's markdown-editor project).

---

## Prompt — Phase 1: Compiler Core & Editor Shell

> You are building Phase 1 of **Frotzsmith**, a browser-based Inform 6 IDE, in an existing Nuxt 4 app that follows the author's Nuxt house style (`app/`-rooted, Yarn, Nuxt UI 4, TypeScript, composables not Pinia, JSDoc everywhere, axe-core zero-violation gate, dark/light WCAG AA).
>
> **Goal:** A two-pane shell that compiles a standard-library Inform 6 `.inf` to a `.z8` entirely client-side via a WASM build of `inform6`, shows parsed errors as clickable rows that jump the editor cursor, autosaves source to localStorage, and highlights Inform 6 syntax in a CodeMirror 6 editor.
>
> **Build:**
> 1. `app/composables/useCompilerWasm.ts` — lazy-loads `app/modules/inform6/wasm/inform6.mjs` (Emscripten, single-threaded, MODULARIZE/EXPORT_ES6/INVOKE_RUN=0/FORCE_FILESYSTEM; full `emcc` recipe + verified upstream — DavidKinder/Inform6 v6.44, Artistic 2.0 — in Doc 01 §2). Client-only. Exposes a factory returning a **fresh instance per compile** (the I6 compiler is not safe to run `main()` twice — re-instantiate, never cache), each with `FS`, `callMain`, and `print`/`printErr` capture hooks. Run the compile **in a Web Worker** so a wall-clock timeout can terminate a runaway. (If the `.mjs`/`.wasm` artifacts don't exist yet, building them per Doc 01 §2 is task zero; document the exact invocation + upstream rev in `wasm/README.md`.)
> 2. `app/composables/useCompiler.ts` — `compile(req: CompileRequest): Promise<CompileResult>` per the interfaces in Doc 01 §3. Writes source to MEMFS `/work/story.inf`, preloads the standard library `.h` files (in `app/modules/inform6/lib/std/`) to `/lib/std`, runs `callMain(['+include_path=/lib/std','-v8','/work/story.inf'])`, reads the story file back (output filename derived from target/version, not hard-coded — Doc 01 §2.2), parses stderr to `Diagnostic[]`.
> 3. Inform 6 stderr parser (Doc 01 §4): regex `^(.+)\((\d+)\): (Error|Warning|Fatal error):\s*(.*)$`, plus the "Compiled with N errors" summary → `ok`. Keep raw stderr.
> 4. `app/modules/inform6/editor/i6-language.ts` — CodeMirror 6 `StreamLanguage` mode: `!` line comments, `"..."` strings, the I6 directive keyword list (Doc 01 §6), `[`/`]`, `->`, numbers/`$`hex. `i6-theme.ts` — `HighlightStyle` honoring dark/light + AA contrast.
> 5. `app/composables/useSourceDocument.ts` — source ref + debounced **crash-recovery** snapshot to localStorage (buffer + options; the `.inf` file is the canonical source, this is just a swap file against tab crashes — Doc 01 §7 / ADR-010), quota-graceful, restore on load, "saved Ns ago" indicator. (Model on the markdown editor's `useAutoSave`.)
> 6. Components: `IdeLayout.vue` (resizable twin pane), `IdeToolbar.vue` (Compile button + stubbed profile/options/export), `SourcePane.vue` (CM6 wrapper, exposes cursor-jump), `ResultsPanel.vue` (clickable `Diagnostic` rows → `cursorTo(line)`, raw-output toggle, `.z8` download), `RightPaneTabs.vue` (Results/Play/Transcript tabs; Play/Transcript stubbed).
>
> **Exit test:** Good source → "Compiled OK · story.z8 (N bytes)" + download. Bad source → clickable error row jumps cursor. Reload restores source. axe-core: zero violations.

---

## Prompt — Phase 2: Library Profiles & Auto-Import

> Building Phase 2 of **Frotzsmith** (Phase 1 merged: client-side compile of standard-library `.inf` → `.z8`, two-pane shell, I6 highlighting, autosave). Same house rules.
>
> **Goal:** Projects carry a `LibraryProfile` (Doc 02 §1). Ship two: **Standard Library** (`std`, default, `.z8`) and **PunyInform** (`puny`, `.z5` default, different includes/keywords/template). Auto-import the profile's `.h` files into MEMFS at compile time. Add a compiler-options panel with profile defaults + free-text switch override. Profile-aware highlighting. Add an **Inform 6 extension catalog** (Doc 02 §3.1): a curated, pinned set the author can browse, link out to, and pull into a project's include set, with a local `.h` import escape hatch — no remote fetch.
>
> **Build:**
> 1. `app/composables/useProfiles.ts` — registry of `LibraryProfile`, `activeProfile`. Two profiles with their `includeFiles` (from `app/modules/inform6/lib/std/` and `.../lib/puny/`), `includePaths`, `defaultZVersion`, `defaultSwitches`, `keywords`, `starterTemplate`, `notes`.
> 2. `app/composables/useCompilerOptions.ts` — options state (target z/glulx, zVersion, toggles, freeText), computes effective switch list (`defaults ⊕ toggles ⊕ freeText`, last-wins dedupe), persists `frotzsmith:options`.
> 3. `app/composables/useProject.ts` — `Project` record (Doc 02 §6), new-project flow (pick profile → seed starter template), switch-profile flow (swap includes/defaults/keywords/template; do NOT rewrite source; surface the incompatibility note).
> 4. Wire `useCompiler` to read includes + switches from active profile + options instead of hard-coded values.
> 5. Reconfigure the CM6 language `Compartment` from `activeProfile.keywords` on profile switch (no editor teardown).
> 6. `OptionsPanel.vue` (Nuxt UI dialog: target, zVersion radio, toggles, free-text, reset-to-defaults) + profile selector in `IdeToolbar.vue`.
> 7. `app/composables/useExtensions.ts` + `app/components/ide/ExtensionsPanel.vue` — registry of bundled `I6Extension` (Doc 02 §3.1) from `app/modules/inform6/extensions/`; the panel lists each with its description + source link-out, an "Add to project" toggle writing `Project.extensions`, and a local "Import `.h` file" action. On compile, write selected extensions' `includeFiles` into MEMFS on the include path alongside the profile's (reuse the ADR-005 mechanism). Filter by active profile. No remote fetch (offline; ADR-012).
>
> **Exit test:** New project = std/`.z8`/std template/std keywords, compiles clean. Switch to PunyInform = puny includes/`.z5`/puny template/puny keywords, compiles clean. Options toggles + free-text reach the compiler. Pull a catalog extension into a project and `Include` it in a clean compile; import a local `.h` and use it. All persisted. axe-core clean.

---

## Prompt — Phase 3: Play via Parchment & StoryEngine

> Building Phase 3 of **Frotzsmith** (Phases 1–2 merged). Same house rules.
>
> **Goal:** Clean compile auto-focuses a **Play** tab running the story inline via Parchment. Implement the `StoryEngine` interface + `createEngine(target)` factory and the **`ZmachineEngine` only** (Doc 03 §1, ADR-002); `GlulxEngine` is a stub that throws "Glulx not yet supported." Specify a shared `normalizeTurnOutput` now (used by `send()`), even though headless replay is Phase 4.
>
> **Build:**
> 1. `app/modules/inform6/engine/StoryEngine.ts` — the interface + `createEngine(target)` factory.
> 2. `ZmachineEngine.ts` (ZVM/ifvms) implementing `boot/send/snapshot/restore/reset/target`; `send()` returns `normalizeTurnOutput(raw, target)`. `GlulxEngine.ts` is a deferred stub that throws — **do not integrate Quixe/Emglken in v1** (ADR-002).
> 3. `normalizeTurnOutput.ts` — shared, VM-agnostic: strip trailing prompt, **exclude the status line from diffable output by default, with a per-script opt-in toggle** (ADR-006), normalize whitespace. (Critical for later diffing — Doc 03 §4.)
> 4. `app/components/ide/PlayPanel.vue` — embeds Parchment configured to load in-memory story bytes (not a URL). Teardown prior instance on recompile/unmount.
> 5. `app/composables/usePlay.ts` — on `CompileResult.ok`, build engine via factory, hand bytes to Parchment, auto-focus Play tab. Fresh boot each compile.
>
> **Exit test:** Z-machine game plays inline; recompile reloads from a fresh start; no leaked interpreter instances; selecting Glulx (`-G`) surfaces a clean "not yet supported" message rather than crashing. axe-core clean.

---

## Prompt — Phase 4: Test Scripts & Headless Replay

> Building Phase 4 of **Frotzsmith** (Phases 1–3 merged; `StoryEngine` + `normalizeTurnOutput` exist). Same house rules.
>
> **Goal:** Save arbitrarily long command scripts, run them through a headless `replay()` primitive, show the transcript in a **Transcript** tab. This is the linear spine of a future Skein — keep `replay()` thin and VM-agnostic.
>
> **Build:**
> 1. `app/composables/useReplay.ts` — `replay(storyFile, target, commands): Promise<ReplayResult>` (Doc 04 §1): `createEngine` → `boot` (capture banner as turn 0) → loop `send` capturing normalized output → `snapshot` as `finalState`. Run in a Web Worker if feasible; enforce turn-cap + timeout; cap transcript length.
> 2. Lenient script parser (Doc 04 §2.1): split on newlines and/or periods, `!` comments ignored, blank lines ignored, strip leading `> `.
> 3. `app/composables/useTestScripts.ts` — CRUD + `localStorage` persistence (`frotzsmith:scripts:<projectId>`).
> 4. `app/composables/useTranscript.ts` — current transcript, run/cancel, "Send to Play" (load `finalState` into Play via `restore()`).
> 5. `TranscriptPanel.vue` (scrollable per-turn transcript, run indicator, cancel) + scripts list/editor UI (small CM6 instance, `!`-comment highlighting). Auto-focus Transcript on run.
>
> **Exit test:** A 40-command script runs and fills the transcript; recompiling + re-running reflects new behavior; multiple named scripts persist; long scripts don't freeze the UI. axe-core clean.

---

## Prompt — Phase 5: Export & Playable Bundles

> Building Phase 5 of **Frotzsmith** (Phases 1–4 merged). Same house rules.
>
> **Goal:** Export (1) the raw `.z5`/`.z8`/`.ulx` story file, (2) a single self-contained offline-playable Parchment HTML bundle (same runtime as the Play tab), and (3) project export/import (source + options + scripts).
>
> **Build:**
> 1. Extend `app/composables/useExport.ts`: raw story download (sanitized filename, correct MIME); bundle builder that assembles one `.html` inlining the pinned Parchment runtime + the story file as embedded base64 (no fetches), picking the runtime matching the target.
> 2. `app/composables/useProjectTransfer.ts`: export `ProjectExport` JSON (Doc 05 §3); import with strict validation, text-only treatment, no `eval`.
> 3. `ExportMenu.vue` (Nuxt UI dropdown): Download story file / Download playable bundle (both gated on clean compile, with explained disabled states) / Export project / Import project. Composable-scoped timers, cleanup on unmount.
>
> **Exit test:** Story file plays in external interpreters; bundle `.html` plays offline by double-click with no tooling/internet; project export re-imports to restore everything. axe-core clean.

---

## Notes for whoever runs these prompts

- **Phase 1's WASM compile is task zero, and it's feasibility-proven** (Borogove compiles I6 client-side in production). Build a pinned single-threaded Emscripten module from current upstream (DavidKinder/Inform6 v6.44, Artistic 2.0) per Doc 01 §2, plus the standard library `.h` bundle; document the exact invocation + upstream rev in `app/modules/inform6/wasm/README.md`. The 2021 `rockwalrus` wasm branch is a stale POC, reference-only.
- **Re-instantiate the compiler module per compile** (it isn't safe to run `main()` twice); run compile + replay in a Web Worker so timeouts can terminate runaways.
- **Parchment, ZVM** are mature; integration risk is mostly "load in-memory bytes" + "drive headlessly," both addressed in Doc 03–04. **Glulx (Quixe/Emglken) is out of v1** — seam only (ADR-002).
- Keep `replay()` (Phase 4) minimal and VM-agnostic — the Skein (Doc 10) inherits it unchanged.

# Frotzsmith — ZIL as a second language (the `/zil/` IDE)

**Date:** 2026-06-30
**Status:** Design — pending review, then plan
**Builds on:** the validated ZILF→WASM spike ([`../spikes/2026-06-30-zilf-wasm-spike.md`](../spikes/2026-06-30-zilf-wasm-spike.md)), the GPLv3 relicense, the existing Inform 6 IDE (compiler seam, play/map/Test-Scripts/Transcript), the "Interactive Fiction IDE" rebrand.

## 1. Context & problem

Frotzsmith is now an **Interactive Fiction IDE**, not an Inform-6-only one. Inform 6 and PunyInform share one compiler and are syntactically near-identical (a library toggle). **ZIL is a different language** (MDL/Lisp-like) with a different compiler (ZILF, C#/.NET 10). The spike proved ZILF compiles `.zil` → z5/z3 **client-side in the browser** via .NET-WASM, and the compiled story **plays in the existing Parchment/ZVM player** unchanged (Z-code is Z-code). Licensing is cleared (Frotzsmith is GPLv3; ZILF is GPLv3).

Goal: a **`/zil/` route** — the same IDE experience, ZIL-specific — alongside `/` (Inform 6), with a title-strip toggle. `/` stays I6; a landing picker is deferred.

## 2. Decisions (locked)

- **D1 — Shared workspace component + per-language profile.** One reusable IDE shell, parameterized by a `LanguageProfile`; both `/` and `/zil/` mount it. Done as a *behavior-preserving refactor first* (I6 profile = today's behavior), then ZIL added on top. (Chosen over a parallel `/zil/` page: the language-specific delta is small, the shared surface large, and B carries a recurring two-page sync tax.)
- **D2 — ZILF runs client-side as a trimmed .NET-WASM module in a Web Worker, lazy-loaded only on `/zil/`.** Built offline, committed like `inform6.wasm`. Netlify stays static.
- **D3 — Play/map/Test-Scripts/Transcript are shared, not re-implemented.** They operate on Z-code, so they work for ZIL for free.
- **D4 — z3/z5/z8 via the ZIL `<VERSION>` directive / ZAPF**, driven by the existing version selector through the profile.
- **D5 — Per-language namespaced state** so an I6 project and a ZIL project coexist; a title-strip toggle with **I6 `beta` / ZIL `alpha`** badges.

## 3. Architecture

### 3.1 `LanguageProfile` (the seam) — `app/modules/languages/`

```ts
export interface LanguageProfile {
  id: 'i6' | 'zil'
  label: string            // "Inform 6", "ZIL"
  badge: 'beta' | 'alpha'
  route: '/' | '/zil/'
  fileExt: string          // 'inf' | 'zil'
  stateKey: string         // namespace for frotzsmith:* keys ('i6' | 'zil')
  editorMode: () => LanguageSupport   // CodeMirror 6 mode (lazy)
  samples: SampleSet
  compile(source: string, opts: CompileOpts): Promise<CompileResult>  // → { storyFile, storyExt, diagnostics, stats? }
  versionTargets: StoryExt[]          // i6: z3/z4/z5/z8 via -v flags; zil: via <VERSION>
  libraryControls?: LibraryControlsConfig  // i6: Std/Puny picker + extensions; zil: none (zillib bundled)
}
export const I6_PROFILE: LanguageProfile   // wraps today's inform6 path verbatim
export const ZIL_PROFILE: LanguageProfile  // ZILF backend
```

`CompileResult` keeps the **existing shape** (`{ storyFile: Uint8Array, storyExt, diagnostics, stats }`) so every downstream consumer (PlayPanel, ResultsPanel, the engine seam) is unchanged.

### 3.2 The shell — refactor `useIde` / `useCompiler` to be profile-driven

- The active profile comes from the **route** (`/` → `I6_PROFILE`, `/zil/` → `ZIL_PROFILE`) via a `useLanguage()` composable (`useState('frotz:lang')`, set from the route).
- `useCompiler().compile()` delegates to `profile.compile()` (today's inform6 path becomes `I6_PROFILE.compile`, byte-for-byte). `useIde` reads the profile for the editor mode, samples, version targets, library controls, and the `frotzsmith:<stateKey>:*` state namespace.
- The shell components (`IdeToolbar`, `RightPaneTabs`, the source/results/play panes) are **unchanged in structure** — they already use `useIde`/`useCompiler`; they now read the active profile. The library/version controls render from `profile.libraryControls`/`versionTargets` (I6 shows Std/Puny + extensions; ZIL shows none).
- **Behavior-preserving:** with only `I6_PROFILE` wired, `/` is byte-identical to today (the 225-test suite + a live check confirm it before any ZIL lands).

### 3.3 The ZILF compiler backend — `app/composables/useZilfWasm.ts` + a Worker

- A small **.NET 10 `wasmbrowser`** project at **`tools/zilf-wasm/`** (with ZILF pinned as a git submodule or a build-script clone at a fixed rev, for reproducibility + GPLv3 provenance) references `Zilf.csproj` + `Zapf.csproj`, exposes `[JSExport] ZilfExports.Compile(source, version) → JSON {success, storyBase64, diagnostics}` — the **spike's validated recipe** (`FrontEnd.Compile` → `ZapfAssembler.Assemble`, in-memory FS, embedded `zillib`).
- **Built offline** (`dotnet publish` with `WasmFingerprintAssets=false` + a trim pass), output committed to `public/zilf/` (like `inform6.wasm`). A `docs/` note records the build command + the .NET SDK requirement (Netlify never builds it).
- **Loaded in a Web Worker** (the ~5 s compile must not block the UI; the runtime boot is ~200 ms). The worker loads `dotnet.js`, calls `Compile`, posts back `{ bytes, diagnostics }`. `useZilfWasm` wraps it as `compile(source, version) → CompileResult`, **lazy-loaded on first ZIL compile** (the 9.3 MB-gz, trim-target bundle downloads only on `/zil/`).
- ZIL **diagnostics** (e.g. `ZIL0122 …`) parse into the existing diagnostic shape so the editor's click-to-jump + the Results panel work as for I6.

### 3.4 ZIL editor mode + samples

- A **basic CodeMirror 6 ZIL mode** (`app/modules/languages/zil/`): angle-bracket forms, atoms, strings, `;`-comments, the core directives (`<ROUTINE>`, `<OBJECT>`, `<ROOM>`, `<VERSION>`, `<GLOBAL>`, …). v1 is highlighting + bracket matching (not a full grammar); lint is the compiler's diagnostics.
- **ZIL samples:** a **concept set mirroring the Inform 6 samples** (one-room/skeleton, two rooms, an NPC, a puzzle, light & darkness, a daemon) plus **Cloak of Darkness** and a Zork-y `<VERSION ZIP>` (z3) starter — ~6–8 demos, drawn from ZILF's bundled `sample/` dir + zillib examples where possible, each verified to compile (golden cases). Bundled like the I6 samples, profile-scoped.

### 3.5 The `/zil/` route + toggle

- Two explicit pages — `app/pages/index.vue` (I6) + `app/pages/zil.vue` (ZIL) — each mount `<IdeWorkspace :profile>` (keeps `/` byte-untouched, the simplest route split).
- A **toggle in the title strip** (I6 | ZIL) = route navigation, each with its maturity badge (I6 `beta`, ZIL `alpha`). Per-language state via the `frotzsmith:<stateKey>:*` namespace — projects coexist.

## 4. Phasing (for the plan)

1. **Behavior-preserving refactor** — `LanguageProfile` + `useLanguage`; parameterize `useCompiler`/`useIde`; `I6_PROFILE` = today's exact behavior; namespace the I6 state under `i6`. **Gate: 225 suite green + `/` live-identical, no ZIL yet.**
2. **ZILF WASM backend** — the .NET project + build/trim recipe; the Worker + `useZilfWasm`; a **golden ZIL-compile test** (compile a fixed `.zil` in Node, byte/sha-check — like the I6 golden test).
3. **ZIL profile** — the ZIL editor mode, samples, `<VERSION>`→z3/z5 mapping, `ZIL_PROFILE.compile` via `useZilfWasm`.
4. **`/zil/` route + toggle + lazy-load + namespaced state** — wire the page, the title-strip toggle + badges, lazy-load the bundle, verify play/map/Test-Scripts/Transcript all work for a ZIL game end-to-end.

## 5. Error handling / limitations

- **Bundle size** (~9.3 MB gz untrimmed → trim target) — lazy-loaded on `/zil/` only; I6 users pay nothing. Trimming the .NET BCL is a Phase-2 task (ZILF+ZAPF is only ~2.3 MB).
- **Compile latency** (~5 s) — the Worker keeps the UI responsive; show a "compiling…" state.
- **Refactor risk** to the working I6 IDE — bounded by Phase 1 being behavior-preserving + the test suite + per-task reviews + a live I6 check before ZIL lands.
- **ZIL mode** is basic v1 (highlighting, not a full grammar); rich features are later.
- **A second build toolchain** (.NET SDK) — offline only; the committed artifact is what ships (same model as `inform6.wasm`).
- **WASM load failure** — surfaced as a clear error; the `_framework/*`-returns-`text/html` SPA-fallback caveat from the spike is documented for debugging.

## 6. Testing

- **Pure/unit:** `LanguageProfile` selection + the version mapping; the ZIL diagnostic parser; the ZIL mode tokenizer (a few cases).
- **Golden ZIL compile** (node): a fixed `.zil` → byte/sha-checked story (mirrors the I6 golden-compile test).
- **I6 regression:** the existing 225 tests stay green through the refactor (the headline safety net).
- **Composable/state:** `useLanguage` + the namespaced state (per the happy-dom pattern).
- **Live:** the `/zil/` end-to-end (compile a sample → plays in Parchment → walk → map draws → a Test Script runs) — the same live checks used for the map.

## 7. Out of scope (v1)

A ZIL debugger / stepper; a full ZIL grammar/lint beyond compiler diagnostics; the landing-page picker at `/` (toggle only for now); the Skein (separate roadmap item); Glulx; multi-`.inf`/`.zil` projects. v1 is: **write ZIL, compile it client-side, play/map/test it, with z3/z5 targeting** — a real second language.

## 8. Licensing

Frotzsmith is **GPLv3** (relicensed for this). Bundled: **ZILF + ZAPF + zillib — GPLv3** (add to the README attribution); the **.NET runtime — MIT/.NET Foundation**. The build/attribution note lands with Phase 2.

## 9. Done =

At `/zil/`: pick a ZIL sample (Cloak of Darkness), compile it client-side (a Worker, lazy-loaded ZILF bundle) to a z5 (or z3 via `<VERSION>`), and it **plays in Parchment**; the **map**, **Test Scripts**, and **Transcript** all work on the ZIL game; the title-strip toggle flips `/` ↔ `/zil/` with `beta`/`alpha` badges; **`/` (Inform 6) is byte-identical to before** and the suite is green.

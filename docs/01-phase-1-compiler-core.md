# Frotzsmith — Phase 1: Compiler Core & Editor Shell

**Document 01 of 13 · Phase 1**
**Deliverable:** A two-pane shell that compiles a hard-coded standard-library `.inf` to a `.z8` entirely in the browser, shows parsed errors in the right pane, and autosaves source to localStorage. I6 syntax highlighting in the left pane.

> **Testable exit criteria:** Type a known-good `.inf`, click Compile, see "Compiled OK · story.z8 (N bytes)" in the Results tab and a download link for the raw story file. Introduce a deliberate error, see a clickable row that moves the cursor to that line. Reload the page; source is restored.

---

## 1. Scope of this phase

In:
- WASM build of `inform6` (single-threaded) wired into a composable.
- Two-pane layout shell (left editor / right tabbed panel; Play & Transcript tabs present but stubbed).
- CodeMirror 6 editor with an Inform 6 `StreamLanguage` highlighting mode.
- stderr → structured error/warning parsing, rendered as clickable Results rows.
- localStorage autosave of source (debounced, quota-graceful), mirroring `useAutoSave` from the markdown editor.
- Raw `.z8` download of the compile output.

Out (later phases): library *profiles* (Phase 2 — Phase 1 hard-codes the standard library include set), Parchment play (Phase 3), test scripts (Phase 4), bundle export (Phase 5).

## 2. Building the compiler to WASM

### 2.0 Verified feasibility & source (checked June 2026)

Client-side I6 compilation is **proven in production**: [Borogove](https://borogove.app) compiles Inform 6 entirely in the browser today, reserving its remote compiler service for Inform 7 (too large to ship) — I6 is small enough to run client-side. This is a build task, not a research risk.

- **Upstream source:** [DavidKinder/Inform6](https://github.com/DavidKinder/Inform6) — the canonical compiler, **v6.44 (Sept 2025)**, actively maintained, **Artistic License 2.0**. ~25 portable C files plus `header.h`; a standard `main(argc, argv)` CLI program.
- **Prior art (reference only, do not reuse):** Nathan Summers' `rockwalrus/Inform6` `wasm` branch — the 2021 "Inform 6 says Hello, WebAssembly!" demo — is a **stale, hand-rolled WASI proof-of-concept (last commit Sep 2021), not an Emscripten build.** Useful as proof it works, not as a recipe.
- **Our path:** build a pinned, single-threaded **Emscripten** module from current upstream. The recipe below is the whole job.

### 2.1 The build recipe

First a native sanity build, to confirm the sources compile unmodified:

```
cc -O2 -o inform *.c
```

Then the Emscripten build — single-threaded (no `-pthread`, so no `SharedArrayBuffer`, so **no COOP/COEP headers**; the site stays "deploy anywhere static"):

```
emcc -O2 *.c -o inform6.mjs \
  -sMODULARIZE=1 -sEXPORT_ES6=1 \       # import as an ES module, instantiate on demand
  -sINVOKE_RUN=0 \                      # don't auto-run main(); we call callMain() ourselves
  -sEXIT_RUNTIME=1 \                    # run-once-then-discard (flushes stderr) — see §2.2
  -sALLOW_MEMORY_GROWTH=1 \             # large games won't OOM a fixed heap
  -sFORCE_FILESYSTEM=1 \                # MEMFS: library + source in, story file out
  -sEXPORTED_RUNTIME_METHODS=FS,callMain \
  -sENVIRONMENT=web,worker             # runnable on the main thread or in a Web Worker
```

**Deliverable artifacts:** `inform6.mjs` (ES-module glue) + `inform6.wasm`, pinned in `app/modules/inform6/wasm/` and lazy-loaded on first compile (not at page load — the blob is a few MB). Document the exact upstream revision and `emcc` invocation in that folder's `README.md`.

### 2.2 Invocation (and the re-instantiation rule)

> **Critical:** the I6 compiler holds extensive global state (symbol tables, memory arrays) and is not designed to run `main()` twice. **Re-instantiate the module per compile** — call the `MODULARIZE` factory fresh each time — so every compile gets clean memory and a fresh MEMFS. Never reuse one instance across compiles. This is what makes a `callMain`-based design safe in an IDE that recompiles constantly.

Per compile:
1. `const inform6 = await createInform6({ print: capStdout, printErr: capStderr })` — fresh instance; stdout/stderr captured into buffers via the Module hooks.
2. Write the active profile's library `.h` files (e.g. to `/lib/std`) and the source to `/work/story.inf` in MEMFS.
3. `inform6.callMain(['+include_path=/lib/std', '-v8', '/work/story.inf'])`.
4. Read the story file back. The output basename follows the source; the extension follows the target/version (`-v8`→`.z8`, `-v5`→`.z5`, `-G`→`.ulx`) — **derive it from the options, do not hard-code `story.z8`.** (Phase 1 only emits `.z8`, but the readback must generalize for Phase 2.)
5. Discard the instance.

**Timeout / abort:** a runaway source can make the compiler spin. To support the "Compile timed out" abort (Doc 06 §2), run the compile **in a Web Worker** so a main-thread wall-clock timeout can `worker.terminate()` it — a synchronous compile on the main thread cannot be aborted (the timer can't fire until it returns). This resolves the old "compile on main thread" lean in Doc 10.

### 2.3 Swappable WASM (forward-compat with Doc 11)

The WASM module is loaded behind a thin loader (`useCompilerWasm`) so the *source* of the binary (bundled-and-pinned vs. CDN-fetched) is a config flag, not a code change. v1 bundles a pinned build in the repo.

## 3. The compile composable

`app/composables/useCompiler.ts`

```ts
interface CompileRequest {
  source: string;
  includePaths: string[];   // Phase 1: ['/lib'] (std library)
  switches: string[];       // Phase 1: ['-v8']
  outputName: string;       // 'story.z8'
}

interface CompileResult {
  ok: boolean;
  storyFile?: Uint8Array;   // the .z8 bytes
  storyExt: 'z3'|'z5'|'z8'|'ulx';
  diagnostics: Diagnostic[];
  rawStderr: string;
  ms: number;
}

interface Diagnostic {
  severity: 'error' | 'warning' | 'fatal';
  line?: number;            // for cursor-jump
  column?: number;
  message: string;
  file?: string;
}
```

The composable: (1) lazy-loads the WASM module, (2) writes source + (Phase 2) library files into MEMFS, (3) `callMain`, (4) reads the story file, (5) parses stderr into `Diagnostic[]`, (6) returns. All client-only — guard against SSR with `import.meta.client` / dynamic import in a `.client` plugin.

## 4. Parsing I6 compiler output

Inform 6 emits diagnostics in a stable, greppable shape, e.g.:

```
story.inf(42): Error:  Expected ';' but found 'rock'
story.inf(58): Warning: Variable "n" declared but not used
Compiled with 1 error and 1 warning
```

A line-oriented parser produces `Diagnostic[]`. Regex captures `file(line): Severity: message`. The summary line ("Compiled with N errors") sets `ok`. Keep the raw stderr available for a "show raw output" toggle — I6 occasionally emits messages the parser won't structure, and the author will want the unvarnished text.

## 5. The two-pane shell

`app/components/ide/IdeLayout.vue` — mirrors the markdown editor's `EditorLayout.vue` resizable twin-pane, but the right pane is a tabbed panel.

```
┌──────────────────────────┬──────────────────────────────┐
│ SOURCE (CodeMirror 6)     │ [ Results | Play | Transcript ]│
│                           │                               │
│ Object rock "rock"        │ ▸ story.inf(42): Error: …  ←click→ jumps left
│   with name 'rock',       │ ▸ story.inf(58): Warning: …   │
│        description "...";  │                               │
│                           │ Compiled with 1 error          │
└──────────────────────────┴──────────────────────────────┘
   ▲ autosave: "saved 3s ago"          ▲ Compile button in toolbar
```

Components:
- `IdeToolbar.vue` — Compile button, profile selector (stub in P1), options trigger (stub), export menu (stub).
- `SourcePane.vue` — wraps CodeMirror 6; emits `cursorTo(line)` target for Results-row clicks.
- `ResultsPanel.vue` — renders `Diagnostic[]` as clickable rows; "Compiled OK" / error summary; raw-output toggle; raw `.z8` download link.
- `RightPaneTabs.vue` — Nuxt UI tabs; auto-focuses Results on compile-with-errors, (later) Play on clean compile, Transcript on script run.

State lives in composables (no Pinia), matching house style: `useCompiler`, `useIdeLayout` (tab focus, split ratio), `useSourceDocument` (source + autosave).

## 6. CodeMirror 6 Inform 6 highlighting

`app/modules/inform6/editor/i6-language.ts` — a `StreamLanguage` mode. I6's lexical surface is small:

- **Comments:** `!` to end of line.
- **Strings:** `"..."` (double-quoted; high/low-string `@` escapes noted but not deeply tokenized in v1).
- **Directives:** `Object Class Verb Constant Global Array Include Attribute Property Replace Default Fake_action Lowstring Message Statusline Switches Abbreviate Dictionary Ifdef Ifndef Endif Iftrue Iffalse` …
- **Routine markers:** `[` … `]` opening/closing embedded routines.
- **Property/`with`/`has` keywords**, the `->` arrow notation for object tree, `*` in grammar lines.
- **Numbers**, `$`-hex, `$$`-binary.

Keyword list is a constant in v1; **Phase 2 sources it from the active profile** so PunyInform's keywords highlight correctly. A `HighlightStyle` maps token tags to theme colors honoring the markdown editor's dark/light modes and WCAG AA contrast.

> Honest note: a `StreamLanguage` mode gives solid keyword/string/comment highlighting and is an afternoon's work. A full Lezer grammar (for folding, structural selection) is a stretch goal in Doc 10 — not needed for v1.

## 7. Crash-recovery autosave (not the canonical store)

**The canonical source is the `.inf` file the author saves/exports** (Doc 05); localStorage is only a crash / accidental-tab-closure safety net — the editor equivalent of a swap file, so a tab crash never loses the working buffer. `app/composables/useSourceDocument.ts` reuses the markdown editor's `useAutoSave` approach: a debounced write (~1s after last keystroke or on blur — short, so a crash loses almost nothing) of a recovery snapshot of the working buffer + options to `localStorage`. Graceful degradation on `QuotaExceededError` (warn, keep editing in memory). On load, restore the snapshot so an interrupted session continues. A "saved Ns ago" indicator in the status bar.

The distinction that matters: source is *also* a real file (`.inf`), so localStorage is just its recovery copy; compiler options and (Phase 4) test scripts have no file of their own, so they use localStorage as their working store, with the project `.json` export (Doc 05) as their portable backup. See Doc 11 ADR-010.

## 8. Accessibility gate (non-negotiable, house standard)

- axe-core CI run with **zero violations** before merge (matches the markdown editor's gate).
- Full keyboard path: Compile (e.g. ⌘/Ctrl+B), tab switching, Results-row activation via Enter, cursor-jump focus management.
- Results rows are real interactive elements (`<button>`), screen-reader announced with severity + line.
- CodeMirror focus indicators and reduced-motion respected.
- **Dark mode by default** with an accessible, persisted light/dark toggle; both themes (including the CodeMirror I6 syntax theme) meet WCAG 2.1 AA contrast.
- **Fully responsive:** the two-pane shell collapses to a single-column layout on narrow viewports — editor and the right-pane tabs become switchable rather than side-by-side — keeping the compile→play→test loop usable on small screens.

## 9. Phase 1 file manifest

```
app/
  components/ide/
    IdeLayout.vue
    IdeToolbar.vue
    SourcePane.vue
    ResultsPanel.vue
    RightPaneTabs.vue
  composables/
    useCompiler.ts
    useCompilerWasm.ts      # swappable WASM loader
    useSourceDocument.ts    # source + autosave
    useIdeLayout.ts         # split ratio, tab focus
  modules/inform6/
    wasm/inform6.mjs
    wasm/inform6.wasm
    editor/i6-language.ts   # CM6 StreamLanguage mode
    editor/i6-theme.ts      # HighlightStyle (dark/light, AA)
    lib/std/                # standard library .h files (Phase 1 hard-coded)
  pages/index.vue
```

## 10. Phase 1 done = 

A page where you write standard-library I6, press Compile, and either download a working `.z8` or click an error to land on the bad line — with your source surviving a reload. No play, no profiles, no scripts yet. The hard part (WASM compile in-browser + error round-trip) is proven here, deliberately first, because it's the only true unknown.

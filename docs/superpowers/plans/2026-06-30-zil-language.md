# ZIL as a second language (`/zil/`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ZIL as a second source language behind a `/zil/` route — write `.zil`, compile it client-side via ZILF on .NET-WASM, and play/map/test it — while keeping the Inform 6 IDE byte-identical.

**Architecture:** Extract a `LanguageProfile` seam so one shared IDE shell serves both `/` (Inform 6) and `/zil/` (ZIL). The I6 profile reproduces today's behavior exactly (a behavior-preserving refactor first); the ZIL profile adds a trimmed .NET-WASM ZILF compiler run in a Web Worker, lazy-loaded only on `/zil/`. Everything downstream of the compiler (play, map, Test Scripts, Transcript) is unchanged — it operates on Z-code.

**Tech Stack:** Nuxt 4 (`ssr:false`, static), Vue 3 `<script setup>`, Nuxt UI 4, TypeScript strict, Vitest; CodeMirror 6; ZILF + ZAPF (C#/.NET 10) → WebAssembly; Parchment/ZVM (unchanged).

**Spec:** `docs/superpowers/specs/2026-06-30-zil-language-design.md`
**Spike (recipe + caveats):** `docs/superpowers/spikes/2026-06-30-zilf-wasm-spike.md`

## Global Constraints

- **Behavior-preserving Phase 1:** after the refactor, `/` (Inform 6) is **byte-identical** and the existing **225-test suite stays green**. The `I6_PROFILE` wraps today's exact compile/editor/samples/version/library behavior.
- **`CompileResult` shape is UNCHANGED** (`{ storyFile: Uint8Array, storyExt: StoryExt, diagnostics, stats? }`) so PlayPanel / ResultsPanel / the engine seam need no changes.
- **ZILF .NET-WASM is built OFFLINE** (`tools/zilf-wasm/`, ZILF pinned), output committed to `public/zilf/` like `inform6.wasm`. The .NET 10 SDK is a *build-only* dependency — Netlify never builds it. Publish with **`WasmFingerprintAssets=false`** (stable `dotnet.js`, inlined boot config).
- **The heavy ZIL bundle loads only on `/zil/`** (lazy), in a **Web Worker** (the ~5 s compile must not block the UI). I6 users download nothing extra.
- **Per-language state:** namespace `frotzsmith:*` keys as `frotzsmith:<lang>:*` (`i6` | `zil`) so projects coexist.
- **No `Co-Authored-By` / AI-attribution trailer.** Frotzsmith is **GPLv3**; add ZILF + ZAPF + zillib (GPLv3) and the .NET runtime (MIT) to the README attribution in Phase 2.
- **Spike recipe is canonical** for the ZILF API (`FrontEnd.Compile` → `ZapfAssembler.Assemble`, in-memory FS, embedded zillib, `[JSExport] ZilfExports.Compile`) and the Vite caveats (the `_framework/*`-returns-`text/html` SPA-fallback gotcha).

---

## Phase 1 — Behavior-preserving refactor (the `LanguageProfile` seam)

### Task 1: `LanguageProfile` type + `useLanguage()`

**Files:**
- Create: `app/modules/languages/types.ts`, `app/composables/useLanguage.ts`
- Test: `app/composables/useLanguage.nuxt.test.ts`

**Interfaces — Produces:**
```ts
// app/modules/languages/types.ts
import type { CompileResult, StoryExt } from '~/modules/inform6/types'
export interface CompileOpts { version?: StoryExt /* + existing opts */ }
export interface LanguageProfile {
  id: 'i6' | 'zil'
  label: string                 // 'Inform 6' | 'ZIL'
  badge: 'beta' | 'alpha'
  route: string                 // '/' | '/zil/'
  fileExt: string               // 'inf' | 'zil'
  stateKey: string              // 'i6' | 'zil'  (frotzsmith:<stateKey>:*)
  versionTargets: StoryExt[]
  compile(source: string, opts: CompileOpts): Promise<CompileResult>
  // editorMode / samples / libraryControls added in Tasks 2, 8-10
}
export function useLanguage(): { profile: Ref<LanguageProfile>; setLanguage(id: 'i6'|'zil'): void }
```

- [ ] **Step 1: Write the failing test** — `useLanguage()` defaults to the i6 profile; `setLanguage('zil')` swaps it; the value is a `useState('frotz:lang')` so it's shared. (Mirror `usePlayTranscript.nuxt.test.ts`'s env.)
- [ ] **Step 2: Run → fail.** `yarn vitest run app/composables/useLanguage.nuxt.test.ts`
- [ ] **Step 3: Implement** the `LanguageProfile` type + `useLanguage` (a `useState<'i6'|'zil'>('frotz:lang', () => 'i6')` + a `profile` computed that maps the id → the registered profile; profiles registered in a map, populated by Tasks 2/10). For now register only `I6_PROFILE` stub (filled in Task 2).
- [ ] **Step 4: Run → pass.** `yarn typecheck` clean.
- [ ] **Step 5: Commit** `feat(lang): LanguageProfile seam + useLanguage`.

### Task 2: `I6_PROFILE` — wrap today's Inform 6 behavior

**Files:**
- Create: `app/modules/languages/i6/profile.ts`
- Modify: `app/composables/useCompiler.ts` (read first — its current `compile` becomes `I6_PROFILE.compile`)
- Test: `app/modules/languages/i6/profile.test.ts`

**Interfaces — Consumes** Task 1's `LanguageProfile`. **Produces** `I6_PROFILE`.

- [ ] **Step 1: Write the failing test** — `I6_PROFILE` has `id:'i6'`, `badge:'beta'`, `fileExt:'inf'`, `stateKey:'i6'`, `versionTargets:['z3','z4','z5','z8']`, and `compile` returns the existing `CompileResult` shape for a known `.inf` (you can assert structure / delegate to a stubbed `useCompilerWasm`, matching how `useCompiler` is tested today — read `useCompiler.ts` to mirror its boundary).
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** `I6_PROFILE`: lift the current inform6 compile body (the `useCompilerWasm` invocation + diagnostics + targets + the Std/Puny profile detection from `~/modules/inform6/profiles`) into `I6_PROFILE.compile`, **unchanged in behavior**. Register it in the `useLanguage` profile map.
- [ ] **Step 4: Run → pass;** `yarn test` (the existing 225 must still pass).
- [ ] **Step 5: Commit** `feat(lang): I6_PROFILE wraps the inform6 compile path (behavior-preserving)`.

### Task 3: Parameterize `useCompiler` / `useIde` by the active profile

**Files:**
- Modify: `app/composables/useCompiler.ts`, `app/composables/useIde.ts` (read both first)
- Test: existing `useIde.nuxt.test.ts` must stay green (extend if needed)

- [ ] **Step 1:** `useCompiler().compile()` → `useLanguage().profile.value.compile(source, opts)`. `useIde` reads `versionTargets`/`fileExt` from the active profile instead of hardcoded I6 values. **No behavior change** while only `I6_PROFILE` is active.
- [ ] **Step 2: Run** `yarn test` → 225 green; `yarn typecheck` clean.
- [ ] **Step 3:** Live check: `/` compiles + plays a sample exactly as before.
- [ ] **Step 4: Commit** `refactor(ide): drive compile + targets from the active LanguageProfile`.

### Task 4: Namespace I6 state under `frotzsmith:i6:*`

**Files:**
- Modify: the composables that own `frotzsmith:*` keys (`useTestScripts`, `usePlayTranscript`/scoping, project files, source doc — grep `frotzsmith:`); add a `frotzsmith:<stateKey>:` prefix from the active profile, with a one-time migration of existing un-prefixed keys → `i6`.
- Test: the affected composable tests stay green; add a migration test.

- [ ] **Step 1: Write the failing migration test** (existing `frotzsmith:scripts` → `frotzsmith:i6:scripts`, idempotent; mirror the `test-scripts.ts` migration pattern).
- [ ] **Step 2-4:** Implement the prefix (read the profile's `stateKey`) + the migration; run `yarn test` green; live-check I6 projects survive a reload.
- [ ] **Step 5: Commit** `feat(lang): namespace per-language state (frotzsmith:i6:*) + migrate`.

> **Phase 1 gate:** `/` is byte-identical, 225 suite green, no ZIL code yet. The final whole-branch review checks this.

---

## Phase 2 — ZILF WASM compiler backend

### Task 5: The `.NET` ZILF→WASM build (`tools/zilf-wasm/`)

**Files:**
- Create: `tools/zilf-wasm/` — the `wasmbrowser` project (`ZilfWasm.csproj`, `ZilfExports.cs`, a `build.sh`), ZILF pinned (git submodule **or** `build.sh` clones a fixed rev). A `tools/zilf-wasm/README.md` with the .NET-10-SDK build command.
- Output (committed, generated): `public/zilf/_framework/…` (the trimmed bundle).

This task is a **build recipe**, not app code. Use the spike's validated csproj fixes + API:
```csharp
// ZilfExports.cs — the spike recipe
[JSExport] internal static string Compile(string source, int version) {
  var fs = new InMemoryFileSystem();
  fs.SetText("/game.zil", $"<VERSION {version}>\n{source}");
  // load embedded zillib → /zillib/*.zil
  var fe = new FrontEnd { FileSystem = fs, Logger = logger };
  fe.IncludePaths.Add("/zillib");
  var diags = ...; fe.Compile("/game.zil", "/_build/game.zap", false);
  new ZapfAssembler { FileSystem = fs }.Assemble("/_build/game.zap", "/_build/game.z#");
  var bytes = fs.GetBytes(fs.Paths.First(p => Regex.IsMatch(p, @"\.z\d$")));
  return JsonSerializer.Serialize(new { success = true, storyBase64 = Convert.ToBase64String(bytes), diagnostics = diags });
}
```
csproj: `ValidateExecutableReferencesMatchSelfContained=false`; `<AdditionalProperties>PortableTarget=true</AdditionalProperties>` on the Zilf/Zapf refs; embed `zillib` (`LogicalName=zillib_%(Filename)%(Extension)`); publish `-c Release` with **`WasmFingerprintAssets=false`**.

- [ ] **Step 1:** Scaffold `tools/zilf-wasm/`, pin ZILF, write `ZilfExports.cs` per the recipe.
- [ ] **Step 2:** `build.sh` runs `dotnet publish` → copies `_framework/` to `public/zilf/`. Run it; confirm the bundle appears.
- [ ] **Step 3: Commit** `build(zil): offline ZILF->WASM build (tools/zilf-wasm) + committed bundle`. Add `public/zilf/**` is committed (it ships).

### Task 6: Trim the bundle

**Files:** Modify `tools/zilf-wasm/ZilfWasm.csproj` (enable `PublishTrimmed=true` + a trimmer config / `TrimMode`), re-run `build.sh`.

- [ ] **Step 1:** Enable trimming; re-publish. **Re-run the Node smoke test** (Task 7's, or the spike's) on the trimmed bundle — z5 + z3 must still compile (trimming can drop reflection-used types in ZILF; if it breaks, add `TrimmerRootAssembly`/`DynamicDependency` for the offending types, documented).
- [ ] **Step 2:** Record before/after size in `tools/zilf-wasm/README.md`.
- [ ] **Step 3: Commit** `build(zil): trim the .NET bundle (NN MB gz -> MM MB)`.

### Task 7: Worker + `useZilfWasm` + golden compile test

**Files:**
- Create: `app/modules/zil/zilf.worker.ts` (loads `/zilf/_framework/dotnet.js`, calls `ZilfExports.Compile`, posts `{ bytes, diagnostics }`), `app/composables/useZilfWasm.ts` (lazy-spawns the worker, returns a `CompileResult`), `app/modules/zil/zil-diagnostics.ts` (parse ZILF diagnostics → the existing diagnostic shape)
- Test: `app/modules/zil/zilf.golden.test.ts` (node — mirror the I6 golden test), `app/modules/zil/zil-diagnostics.test.ts`

- [ ] **Step 1: Write the failing golden test** — load the committed `public/zilf/_framework/dotnet.js` under Node, `Compile(fixtureZil, 5)`, assert `bytes[0]===5`, a stable sha/length; `version=3` too; a broken `.zil` → diagnostics. (The spike proved this works; this locks it as a test.)
- [ ] **Step 2: Run → fail/pass** (it should pass against the committed bundle).
- [ ] **Step 3: Implement** `zilf.worker.ts` + `useZilfWasm` (lazy worker spawn, base64→Uint8Array, `{ storyFile, storyExt, diagnostics }`), and `zil-diagnostics.ts` (a pure parser, unit-tested: `ZIL0122 …:line: msg` → `{ line, severity, message }`).
- [ ] **Step 4:** `yarn typecheck` clean; `yarn test` green.
- [ ] **Step 5: Commit** `feat(zil): ZILF worker + useZilfWasm + golden compile test`.

---

## Phase 3 — The ZIL profile (mode, samples, ZIL_PROFILE)

### Task 8: ZIL CodeMirror 6 mode

**Files:** Create `app/modules/languages/zil/mode.ts` + `mode.test.ts`.
- [ ] Basic StreamLanguage/Lezer-lite tokenizer: angle-bracket forms `<…>`, atoms, `"strings"`, `;`-comments, core directives (`ROUTINE`,`OBJECT`,`ROOM`,`GLOBAL`,`CONSTANT`,`VERSION`,`SYNTAX`,`TELL`,`COND`,`SET`,`SETG`…), bracket matching. Unit-test the tokenizer on a few lines. Commit `feat(zil): basic CodeMirror ZIL syntax mode`.

### Task 9: ZIL samples

**Files:** Create `app/modules/languages/zil/samples/` — **Cloak of Darkness** (canonical IF, exists in ZIL) + a **one-room Zork-y starter** (`<VERSION ZIP>` z3). A `samples.ts` registry mirroring the I6 samples shape.
- [ ] Add the `.zil` sources (verified to compile via the golden harness — add each as a golden case), the registry, a `sampleById` test. Commit `feat(zil): ZIL samples (Cloak of Darkness + starter)`.

### Task 10: `ZIL_PROFILE`

**Files:** Create `app/modules/languages/zil/profile.ts`; register in `useLanguage`.
- [ ] `ZIL_PROFILE`: `id:'zil'`, `badge:'alpha'`, `route:'/zil/'`, `fileExt:'zil'`, `stateKey:'zil'`, `versionTargets:['z3','z5','z8']`, `compile` → `useZilfWasm().compile(src, version)` (maps the version target → the `<VERSION>` number), editor mode = Task 8, samples = Task 9, `libraryControls: undefined`. Test the profile shape + the version mapping. Commit `feat(zil): ZIL_PROFILE`.

---

## Phase 4 — `/zil/` route + toggle

### Task 11: Extract `<IdeWorkspace>` + the `/zil/` page

**Files:** Create `app/components/ide/IdeWorkspace.vue` (the shell currently inlined in the index page), `app/pages/zil.vue`; Modify `app/pages/index.vue` (read first).
- [ ] Move the workspace shell into `<IdeWorkspace>` (it reads `useLanguage().profile`). `index.vue` sets language `i6` + mounts it; `zil.vue` sets language `zil` + mounts it. Both routes work; `/` unchanged. `yarn typecheck` + live check both. Commit `feat(zil): IdeWorkspace component + /zil/ route`.

### Task 12: Title-strip toggle + badges + lazy-load

**Files:** Modify `app/components/ide/IdeToolbar.vue` (or the TitleStrip) — read first.
- [ ] Add an **I6 | ZIL toggle** (NuxtLink to `/` and `/zil/`) with maturity badges (`beta`/`alpha`) from the profile. Confirm the ZIL bundle is **lazy** (only fetched when `/zil/` first compiles — `useZilfWasm` spawns the worker on first compile, not on mount). A "compiling…" state for the ~5 s ZIL compile. Commit `feat(zil): language toggle (I6 beta / ZIL alpha) + lazy compile`.

### Task 13: End-to-end live verification + attribution

**Files:** Modify `README.md` (attribution: ZILF/ZAPF/zillib GPLv3, .NET runtime MIT) + `ROADMAP.md`/`CHANGELOG.md` (ZIL shipped).
- [ ] Live e2e on `/zil/`: load Cloak of Darkness → compile (worker, lazy bundle) → **plays in Parchment** → walk → **map draws** → a **Test Script** runs → switch to `/` and confirm I6 still works + state is separate. Update the attribution + changelog/roadmap (move ZIL from Planned to Shipped). Commit `feat(zil): ship ZIL — attribution + changelog + roadmap`.

---

## Self-Review

- **Spec coverage:** D1 (shared component + profile) → Tasks 1-3, 11; D2 (.NET-WASM Worker, lazy, offline build) → Tasks 5-7, 12; D3 (shared play/map/scripts) → free, verified Task 13; D4 (`<VERSION>`→z3/z5) → Task 10; D5 (namespaced state + toggle/badges) → Tasks 4, 12. §6 testing → golden ZIL compile (7), mode (8), diagnostics (7), migration (4), 225 regression (Phase 1 gate). §8 licensing → Task 13.
- **Behavior-preserving gate** is explicit (Phase 1 + the final review).
- **Type consistency:** `CompileResult` reused unchanged; `LanguageProfile` defined in Task 1, consumed in 2/3/10/11; `useZilfWasm` (Task 7) consumed by `ZIL_PROFILE` (Task 10).
- **Build-vs-app split:** Tasks 5-6 are the offline .NET build (need the .NET 10 SDK; the committed `public/zilf/` bundle is what the app uses); Tasks 7-13 are app code against that committed bundle.
- **Known open detail (not a blocker):** the exact `frotzsmith:*` keys to namespace (Task 4) come from grepping the composables at implementation time; the trimmer roots (Task 6) are discovered by re-running the golden test after trimming.

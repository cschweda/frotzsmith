# M2b — Multi-file ZIL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A ZIL project can be several `.zil` files. The main file pulls the others in with `<INSERT-FILE "rooms">`, and ZILF in the browser compiles them together exactly as it would on disk. The extra files show in the explorer, are editable, travel in a `.frotzsmith` package, and diagnostics jump to the right file.

**Architecture:** The .NET export wrapper gains `CompileProject(filesJson, mainPath, version)`, which places every file under `/project/` on a case-insensitive in-memory file system with `/project` searched before `/zillib`. The bundle is rebuilt under a new versioned path. The worker protocol carries a file set. A new per-language store, `useZilProjectFiles`, holds the open project's extra files. It belongs to the open game (cleared wherever `releaseExtras` runs, replaced on package open), feeds the compile, the explorer, and the package reader/writer.

**Tech Stack:** Nuxt 4 SPA (Vue 3.5, TypeScript, vitest), .NET 10 WASM (`~/.dotnet/dotnet` 10.0.301 + `wasm-tools`; not on PATH), ZILF source rev `5262550` (gitignored clone at `tools/zilf-wasm/zilf/`, recreated by `build.sh`).

**Spec:** `docs/superpowers/specs/2026-11-04-desktop-app-design.md` §5.3a (multi-file ZIL), with §5.3b (library clashes) deferred to M2c, §6 (nothing runs on open), and the package format `docs/spec/frotzsmith-package.md`.

## Global Constraints

- Shell: prefix every command with `export PATH="$HOME/.nvm/versions/node/v22.23.4/bin:$PATH";` (Nuxt needs Node ≥ 22.22.3). .NET is `~/.dotnet/dotnet` (call it directly).
- Never assign `self.onmessage = …` in `app/modules/zil/zilf.worker.ts` (dotnet/runtime#114918). Use `addEventListener`.
- ZILF and ZAPF themselves are untouched. Only the export wrapper (`tools/zilf-wasm/ZilfExports.cs`) changes.
- The rebuilt bundle goes under a NEW versioned path: `public/zilf/r5262550-w2/_framework/`. Keep the old `public/zilf/r5262550/` for one release so open tabs on the old build keep compiling. `frotzsmith.versions.zilf` stays `'r5262550'` (the ZILF source revision, shown to users). Add `frotzsmith.versions.zilfBundle: 'r5262550-w2'` and derive `ZILF_FRAMEWORK_BASE` from it.
- `INSERT-FILE` lines are the single source of truth for links. Nothing else records them (spec §5.3a). A `.zil` that nothing inserts isn't compiled.
- Project files are searched before `zillib`, so a project's own `parser.zil` shadows the library's. Shadowing is allowed in M2b. M2c adds the warning, so don't build it here.
- Nothing runs on open (§6). Opening a package with extra files must not compile. The existing outside-source mark (`useOutsideSource`) applies unchanged.
- Limits for a project's extra ZIL files: at most **100 files**, each at most **1 MiB**, all extra files together at most **4 MiB** (UTF-16 length, the measure `planUploaded` uses). Paths must pass `pathProblem` (app/project-package/paths.ts), end in `.zil` (case-insensitive), and differ (by `pathKey`) from the main file and from each other.
- User-facing text: plain English, one sentence, names through `displayPath`/`quotedPath`. Storage writes go through `safeSetItem` + `notifyStorageFull` (never throw).
- Commits: conventional messages; **never** add `Co-Authored-By` or any AI trailer. Do not push.
- Gates per task: `yarn test`, `yarn typecheck` (0 errors). Tasks 1, 2 and 5 also run `npx nuxt generate` followed by `node tools/inject-preloads.mjs && node tools/smoke-replay-worker.mjs && node tools/check-sw.mjs`.

## Review Focus

1. **Circular or repeated `INSERT-FILE`** (a inserts b inserts a; one file inserted twice). The author expects a ZILF diagnostic or the existing worker timeout result, never a hung tab. Pinned in Task 2.
2. **Line numbers in the main file are exact.** The wrapper's `<VERSION n>` prefix must not shift them (today it prepends `<VERSION n>\n`, an off-by-one). An error on line 3 of the main file reports line 3. Pinned in Task 1 (smoke) and Task 2 (golden).
3. **Case of `INSERT-FILE` names.** `<INSERT-FILE "Rooms">` must find `rooms.zil`, as on macOS/Windows disks. Pinned in Task 1.
4. **Edits in an extra file's tab are what compiles**, including after a reload (the autosave path). Pinned in Task 4.
5. **Storage full while adding or editing extra files.** The files stay usable in memory for the session; the author gets the existing storage-full cue once; nothing throws. Pinned in Task 3.

---

### Task 1: ZILF wrapper takes a file set; rebuild the bundle

**Files:**
- Modify: `tools/zilf-wasm/ZilfExports.cs`
- Create: `tools/zilf-wasm/CaseInsensitiveFileSystem.cs`
- Modify: `tools/zilf-wasm/build.sh`, `tools/zilf-wasm/test-smoke.mjs`, `tools/zilf-wasm/README.md`
- Modify: `frotzsmith.config.ts` (add `versions.zilfBundle`; `ZILF_FRAMEWORK_BASE` uses it)
- Create: `public/zilf/r5262550-w2/_framework/**` (build output, committed)
- Modify: `tools/vendored-files.json` / checksum test, only if they cover `public/zilf` (check). Modify the service-worker config/tests (`nuxt.config.ts` workbox ZILF route, `tools/check-sw.mjs`) only if they hardcode `r5262550`.

**Interfaces:**
- Produces (C#, `[JSExport]`): `string CompileProject(string filesJson, string mainPath, int version)`.
  - `filesJson` is a JSON object `{ "<relative path>": "<text>" }`, and it includes the main file.
  - It returns the same JSON shape as today: `{ success, storyBase64, diagnostics }`.
  - `Compile(string source, int version)` stays, implemented as `CompileProject({"game.zil": source}, "game.zil", version)`, so the warm-up, existing tests and samples keep working.
- Produces (config): `ZILF_FRAMEWORK_BASE === '/zilf/r5262550-w2/_framework'`.

Behaviour the wrapper must have (each is a smoke assertion in step 1):
- **File placement:** each file goes at `/project/<path>`. `IncludePaths` = `["/project", "/zillib"]`, in that order. The compile runs on `/project/<mainPath>`.
- **Path validation:** a key that is empty, absolute, contains `..` segments, a backslash or NUL, or isn't `.zil` is refused. The wrapper returns `success:false` with one diagnostic naming the key, and doesn't compile.
- **VERSION prefix:** prepend `<VERSION n> ` (trailing space, **no newline**) to the main file only, so its line numbers are unchanged.
- **Case-insensitive lookup:** done through a decorator implementing ZILF's public `IFileSystem` (`tools/zilf-wasm/zilf/src/Zilf.Common/FileSystem.cs`; `InMemoryFileSystem` is a case-sensitive `Dictionary`). Reads resolve the path case-insensitively. Writes (the `/_build` outputs) pass through.
- **Diagnostic names:** `/project/` is stripped from the start of every diagnostic string, so they read `rooms.zil:12: error …`. `/zillib/…` names stay as they are.

- [ ] **Step 1: Extend the smoke test (failing)** in `tools/zilf-wasm/test-smoke.mjs`:
  - **Bundle path:** read it from `frotzsmith.config.ts`'s `versions.zilfBundle` (a small regex over the file is fine), not a hardcoded `public/zilf/_framework`.
  - **Multi-file game:** compile `{ "story.zil": <game that does <INSERT-FILE "rooms"> and <INSERT-FILE "lib/items">>, "rooms.zil": …, "lib/items.zil": …, "unused.zil": "<THIS IS NOT VALID" }` with main `story.zil`. Expect success.
  - **Case:** `<INSERT-FILE "Rooms">` with file `rooms.zil` succeeds.
  - **Errors in extra files:** an error on line 4 of `rooms.zil` gives a diagnostic starting `rooms.zil:4:`.
  - **Exact main line numbers:** an error on line 3 of the main file gives a diagnostic starting `story.zil:3:`.
  - **Path refusal:** a `../x.zil` key gives `success:false` and a diagnostic containing `../x.zil`.
  - **Old export:** the existing single-file `Compile` test still passes.
- [ ] **Step 2: Implement** `CompileProject`, `CaseInsensitiveFileSystem`, and `Compile` delegating to `CompileProject`.
  - `build.sh` writes to `public/zilf/<zilfBundle>/` (read from `frotzsmith.config.ts`) and leaves other `public/zilf/*` directories alone.
  - Update `versions.zilfBundle` and the README build notes.
- [ ] **Step 3: Build and verify**:
  - Run: `bash tools/zilf-wasm/build.sh && node tools/zilf-wasm/test-smoke.mjs`. Expected: `ALL TESTS PASSED`.
  - Then the gates and the full generate + postgenerate chain. `check-sw` must report the ZILF runtime cache for the new path.
- [ ] **Step 4: Commit** `feat(zil): ZILF compiles a set of files (INSERT-FILE), exact line numbers; bundle r5262550-w2`

### Task 2: Worker protocol and compile API carry a file set

**Files:**
- Modify: `app/modules/zil/zilf.worker.ts`, `app/composables/useZilfWasm.ts`, `app/modules/languages/zil/profile.ts`
- Modify: the shared `CompileOpts` type (find it, probably next to the language profile type) to add `files?: ZilProjectFile[]` and `mainPath?: string`
- Modify: `app/modules/zil/zil-diagnostics.ts` (file names arrive without `/project/`; leave `/zillib/` ones)
- Test: `app/modules/zil/zilf-multifile.golden.test.ts` (new; same node harness as `app/modules/zil/zilf.golden.test.ts`), plus `useZilfWasm.lazy.test.ts` and `zil-diagnostics.test.ts`

**Interfaces:**
- Consumes: `CompileProject` (Task 1).
- Produces:
  - `export type ZilProjectFile = { path: string; text: string }` (in `app/modules/zil/zil-project.ts`, new; Task 3 adds its logic there).
  - `useZilfWasm().compile(source: string, version: number, opts?: { files?: ZilProjectFile[]; mainPath?: string }): Promise<CompileResult>`. `mainPath` defaults to `'story.zil'`. With no files it behaves exactly as today.
  - Worker message IN: `{ files: Record<string,string>, main: string, version: number, requestId: number }`.
  - `parseZilDiagnostics` keeps `file` as the project-relative path.

- [ ] **Step 1: Golden tests (failing)** in `zilf-multifile.golden.test.ts`, run under Node against the committed `r5262550-w2` bundle:
  - a 3-file game compiles and plays its walkthrough (look/north/take) with the expected output lines;
  - an un-inserted file with a syntax error is ignored;
  - an error in `rooms.zil` is parsed to `{ file: 'rooms.zil', line: 4 }`;
  - an error in the main file at line 3 gives `{ file: 'story.zil', line: 3 }`;
  - a circular insert (`a.zil` inserts `b`, `b.zil` inserts `a`) and a file inserted twice each return `ok:false` with at least one diagnostic, within the test timeout.
  - If the 3-file walkthrough is slow, gate it with `describe.skipIf(!process.env['ZIL_SAMPLE_GOLDEN'])` like `architect-legacy.golden.test.ts`. The diagnostics cases must run in the normal suite.
- [ ] **Step 2: Implement** the protocol through the worker, the RPC, the main-thread fallback and `warmZilCompiler` (unchanged single-file warm-up). The ZIL profile's `compile` passes `opts.files`/`opts.mainPath` through.
- [ ] **Step 3: Run** `yarn test` + `yarn typecheck`, then `ZIL_SAMPLE_GOLDEN=1 npx vitest run app/modules/zil`. All pass.
- [ ] **Step 4: Commit** `feat(zil): the compile worker takes a project's files`

### Task 3: The open project's extra ZIL files (store + lifecycle + compile)

**Files:**
- Modify: `app/modules/zil/zil-project.ts`, adding the pure logic: `planZilFiles(files: ZilProjectFile[], mainPath: string): { ok: true } | { ok: false; message: string }`, which enforces the Global Constraints limits and path rules.
- Create: `app/composables/useZilProjectFiles.ts`
- Modify: `frotzsmith.config.ts` (`storageKeys.zilFiles: 'project-files'` → `frotzsmith:zil:project-files` via `buildStorageKey`)
- Modify: `app/composables/useIde.ts` (compile passes files for ZIL; clearing at the same call sites as `releaseExtras`: sample, New, plain opened file, share link)
- Test: `app/modules/zil/zil-project.test.ts`, `app/composables/useZilProjectFiles.nuxt.test.ts`, `app/composables/useIde.nuxt.test.ts`

**Interfaces:**
- Produces:
  - `useZilProjectFiles(): { files: Ref<readonly ZilProjectFile[]>; mainPath: Ref<string>; replaceAll(files: ZilProjectFile[], mainPath: string): void; add(file: ZilProjectFile): { ok: true } | { ok: false; message: string }; update(path: string, text: string): void; remove(path: string): void; clear(): void }`.
  - **Storage:** one localStorage record `{ v: 1, mainPath, files }` per language key (ZIL only).
  - **Restore:** on restore, a record that fails `planZilFiles` is dropped, with one plain notice. It is never half-loaded.
  - **Add:** `add` with a path that already exists replaces that file. The UI confirms first (Task 4).
  - **Clear:** `clear()` sets `mainPath` back to `'story.zil'`.

- [ ] **Step 1: Tests (failing):**
  - `planZilFiles` refusals: the 101st file; a 1 MiB + 1 file; 4 MiB + 1 in total; `../a.zil`; `a.h`; a path equal to main by `pathKey`; two paths differing only in case.
  - Store round-trip: survives a simulated reload.
  - Storage full: when `safeSetItem` returns false, the files stay in memory and `notifyStorageFull` is called once.
  - `useIde`: a ZIL compile passes the files and `mainPath`; `loadSample`, `newProject`, `loadOpenedFile` and a share-link load each clear them; editing the main source does not.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run the gates.**
- [ ] **Step 4: Commit** `feat(zil): a ZIL project can hold extra source files`

### Task 4: Explorer, tabs, add/remove, and diagnostics jump to the file

**Files:**
- Modify: `app/composables/useProjectFiles.ts`, `app/composables/project-files.ts` (`buildProjectFileList` gains `projectFiles?: { id: string; name: string }[]`)
- Modify: `app/components/ide/FileExplorer.vue` (ZIL only: an "Add .zil files" button with a multiple file picker, accept `.zil`, and a remove action per file that asks first)
- Modify: `app/composables/useIde.ts` (`jumpTo(line: number, file?: string)`; `jumpSignal` carries the target file id), `app/components/ide/ResultsPanel.vue` (passes `d.file`), `app/components/ide/SourcePane.vue` (opens the tab, then jumps)
- Test: `app/composables/project-files.test.ts`, `app/composables/useProjectFiles.nuxt.test.ts`, `app/composables/useIde.nuxt.test.ts`

**Interfaces:**
- Consumes: `useZilProjectFiles` (Task 3).
- Produces:
  - File ids: `zil:<path>` for extra ZIL files. `readFile`/`writeActive` support them; writes go to `useZilProjectFiles().update`.
  - Diagnostic mapping:
    - a diagnostic `file` equal to `mainPath` (by `pathKey`) → `'source'`;
    - equal to an extra file → `zil:<path>`;
    - anything else (e.g. `/zillib/parser.zil`) → no tab change, but the line still shows in Results.

- [ ] **Step 1: Tests (failing):**
  - The explorer lists the main file, then the extra files sorted by path. No zillib entries (as today).
  - Editing a `zil:` tab updates the store, and the next compile receives the edit (Review Focus 4).
  - `jumpTo(4, 'rooms.zil')` opens `zil:rooms.zil` and signals line 4.
  - `jumpTo(3, 'story.zil')` targets `'source'`.
  - `jumpTo(1, '/zillib/parser.zil')` changes no tab.
  - Adding a file over a limit shows the `planZilFiles` message and adds nothing.
  - I6 explorer behaviour is unchanged (existing tests stay green).
- [ ] **Step 2: Implement.**
  - Upload reads files with `File.text()`; a NUL in the text is refused with one sentence.
  - The remove confirm names the file.
  - Use the existing modal/confirm pattern (see `OpenProjectModal.vue` or the extension modal); don't add a new UI library.
- [ ] **Step 3: Gates**, plus a manual check in `nuxt dev` on `/zil/`: add two files, insert them, compile, click an error in an extra file, and confirm its tab opens at the line. Note the result in the report.
- [ ] **Step 4: Commit** `feat(zil): extra .zil files in the explorer; diagnostics open the file they name`

### Task 5: `.frotzsmith` packages carry ZIL files; share links say what they leave out

**Files:**
- Modify: `app/project-package/project.ts`. Reader: for `language: 'zil'`, every `.zil` other than `main` is an include, the same as `.h` for I6. Writer: ZIL includes are written at their paths. Note that M2a-era packages kept these as opaque entries; they now open as includes.
- Modify: `app/composables/useProjectPackage.ts`:
  - `check`: ZIL runs `planZilFiles(project.includes, project.main.name)`; a refusal refuses the whole package.
  - `inspect`: returns `sourceFiles: string[]` for ZIL.
  - `apply`: `useZilProjectFiles().replaceAll(includes, main.name)`, after `loadSource`.
  - `buildPackage`: for ZIL, uses `mainPath` and the store's files as includes.
  - `needsConfirm`/`whatOpenReplaces`: count existing extra files as work being replaced.
- Modify: `app/components/ide/OpenProjectModal.vue` (ZIL: "It adds N source files: …", capped at 5 names + "and N more", like extensions)
- Modify: the share action (`app/components/ide/SourceToolbar.vue` / `useShareLink`). When a ZIL project has extra files, the copy-link toast adds one sentence: the link carries only the main file; Download project shares all of them.
- Modify: `docs/spec/frotzsmith-package.md` (ZIL includes: path rules, limits, `main` names the root, INSERT-FILE is the only link record), `docs/06-security.md` §6.1 (ZIL includes are per-project, never per-language; shadowing zillib is per project and M2c adds the warning), `CHANGELOG.md`, and `docs/superpowers/specs/2026-11-04-desktop-app-design.md` §5.3a (mark it done for the web).
- Test: `app/project-package/project.test.ts`, `app/composables/useProjectPackage.nuxt.test.ts`, `app/components/...` only where a pure helper exists.

**Interfaces:**
- Consumes: `planZilFiles`, `useZilProjectFiles` (Task 3).

- [ ] **Step 1: Tests (failing):**
  - Write→read round trip of a 3-file ZIL project keeps paths, texts and main.
  - An M2a-era ZIL package whose extra `.zil` was opaque now opens it as an include.
  - A ZIL package with 101 extra files is refused whole and nothing changes.
  - Opening shows the file names and replaces the previous project's extra files.
  - Opening doesn't compile (no compile call recorded), and the outside-source mark is set.
  - The "every download reopens" invariant holds for ZIL projects with extra files.
  - The share toast includes the extra sentence only when extra files exist.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run the gates**, plus generate + postgenerate.
- [ ] **Step 4: Commit** `feat(package): ZIL projects carry all their .zil files`

---

**Deferred, not in this plan:**
- M2c library-clash warnings.
- A bundled multi-file ZIL sample (Architect's Legacy split into files would make a good one later).
- Deleting `public/zilf/r5262550/` (next release).
- Desktop folders (M3).

# Milestone 2a — The `.frotzsmith` Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the `.frotzsmith` package format (an open spec modeled on Drafter's) and let the website **Download project** and **Open project** with it, safely and losslessly.

**Architecture:** A framework-free module `app/project-package/` (paths, zip container, manifest, project mapping) that the desktop app will reuse in milestone 3. The website adds one composable that snapshots/applies the IDE's existing state (source, uploaded `.h` files, enabled extensions, test scripts, Skein, settings) plus an IndexedDB store for package files the web IDE can't show, and two toolbar entry points.

**Tech Stack:** Nuxt 4 SPA, Vue 3, @nuxt/ui 4, `fflate` (already a dependency), Web Crypto `crypto.subtle` (SHA-256), IndexedDB, Vitest 2.

**Spec:** `docs/superpowers/specs/2026-11-04-desktop-app-design.md` §5.5, §6 (and §5.3 for layout names). Milestone 2 was split (author-approved order): **2a this plan** → 2b multi-file ZIL → 2c library-name clash warnings. **Canonical model:** Drafter's `docs/spec/drafter-package.md` — read it in full before Task 1 (`gh api repos/cschweda/drafter/contents/docs/spec/drafter-package.md -q .content | base64 -d`).

## Global Constraints

- Container (verbatim from Drafter §2, adapted): ZIP; first entry `mimetype`, **stored**, content exactly `application/vnd.frotzsmith.package+zip`, no line ending; entries stored (0) or deflated (8) only; UTF-8 paths with `/` separators; refuse `..`, `.`, empty segments, leading `/`, backslash, drive letters (`C:`), NUL / C0 / C1 controls, segments > 255 bytes or paths > 1024 bytes, case-insensitive duplicates, symlinks, directory entries with data, size/CRC mismatches.
- File extension `.frotzsmith`; manifest file `frotzsmith.json` (UTF-8 JSON, no BOM, ≤ 1 MiB); `format: "frotzsmith-package"`, `version: "0.1"`.
- **Source only:** compiled stories (`.z3 .z4 .z5 .z8 .ulx .blb .zblorb`) are never written and are ignored on read (§6).
- **Nothing runs automatically:** opening a package only loads text — no compile, Play, replay, Skein run (§6).
- Read limits (Drafter §12, scaled for source projects): archive ≤ 32 MiB; ≤ 2,000 entries; each entry ≤ 8 MiB uncompressed; total ≤ 32 MiB uncompressed; compression ratio per entry ≤ 200:1 — all checked **before** inflating.
- Refuse the **whole** package on any rule violation, with one sentence saying why; never partially apply.
- **Never lose anything:** unknown files and unknown manifest fields round-trip (§5.5; Drafter §1.1.4).
- Spec licence CC0 1.0, RFC 2119 keywords, as Drafter's.

## Review Focus

1. **Hostile archives** (lying sizes, bomb ratio, `../x`, symlink, `A.h`+`a.h`, a plain `.zip` renamed) → refused before inflating, nothing changed. Tests in Task 2.
2. **Round trip loses nothing** — download → open → download keeps every opaque file, unknown manifest field, script, Skein node, and setting. Test in Task 3 (pure) and Task 4 (through the composable).
3. **Opening over real work** → asks first; Cancel changes nothing. Test in Task 4.
4. **A package for the other language** (ZIL package on `/`) → refused with "This is a ZIL project — open it from the ZIL editor." and nothing changed. Test in Task 4.
5. **A package whose includes exceed the browser's uploaded-extension budget** (`EXTENSIONS_TOTAL_MAX_BYTES`, 4 MiB) → refused whole with a sentence (no half-applied project). Test in Task 4.

---

### Task 1: The format spec

**Files:**
- Create: `docs/spec/frotzsmith-package.md`
- Modify: `README.md` (one line linking the spec)

- [ ] **Step 1: Write the spec** section-for-section after Drafter's (`1 Purpose` … `15 Feedback`; no appendix), adapted:
  - §1 Purpose: moving and keeping an IF project (Inform 6 or ZIL); **not** the working format (the working format is a folder; desktop app, milestone 3).
  - §3 Layout: `mimetype`; `frotzsmith.json`; `<main>` (`.inf` or `.zil`); include files (`*.h` for I6) at any path; `tests/*.txt` (one test script per file, file name = script name slug); `<stem>.skein` (the existing `.skein` JSON: `{v:1, lang, storyKey, tree}`); anything else MUST be kept by readers. Compiled stories MUST NOT be written and readers MUST ignore them.
  - §4 Manifest fields: `format`*, `version`*, `main`*, `language`* (`"i6"` | `"zil"`), `generator`, `created`, `modified`, `title`, `author`, `target` (`"auto"` | `"z3"` | `"z4"` | `"z5"` | `"z8"`), `library` (I6 only: `"auto"` | `"std"` | `"puny"`), `extensions` (array of enabled include names, bundled or packaged), `tests` (array of `{ name, path }`, order = display order), `skein` (path), `files` (path → `"sha256:<hex>"`, SHOULD). Unknown fields MUST be ignored and kept; extensions use reverse-domain names. (`libraryOverrides` is reserved for milestone 2c — list it as reserved.)
  - §12 Security: the Global Constraints limits and rules; "opening never compiles, plays, or runs anything".
  - §11 Versioning as Drafter's (refuse a higher major with a clear message).
- [ ] **Step 2: README** — under the features list, one line: "Projects travel as `.frotzsmith` packages — an open format: [spec](docs/spec/frotzsmith-package.md)."
- [ ] **Step 3: Commit** `docs(spec): the .frotzsmith package format, v0.1 (CC0)`.

### Task 2: Paths and the zip container (pure)

**Files:**
- Create: `app/project-package/paths.ts`, `app/project-package/container.ts`, `app/project-package/errors.ts`, and tests `app/project-package/paths.test.ts`, `app/project-package/container.test.ts`

**Interfaces:**
- Produces: `class PackageError extends Error` (message is the one user-facing sentence); `pathProblem(path: string): string | null`; `MIMETYPE = 'application/vnd.frotzsmith.package+zip'`; `LIMITS = { archiveBytes: 32 MiB, entries: 2000, entryBytes: 8 MiB, totalBytes: 32 MiB, ratio: 200 }`; `writeContainer(entries: { path: string; bytes: Uint8Array }[]): Uint8Array` (writes `mimetype` first, stored; deflates the rest; refuses invalid paths with `PackageError`); `readContainer(bytes: Uint8Array): Map<string, Uint8Array>` (all rules; throws `PackageError`; excludes `mimetype`).

- [ ] **Step 1: Write failing tests.** `pathProblem`: `null` for `story.inf`, `tests/walk.txt`; a reason string for each of `../x.h`, `a/../b`, `/abs.h`, `a\\b.h`, `C:/x`, `a//b`, `./a`, `a\u0000b`, `a\u0085b`, a 256-byte segment, a 1025-byte path. `readContainer`: round-trips `writeContainer` output; refuses (each a `PackageError`) — a zip whose first entry isn't `mimetype`; `mimetype` deflated; wrong mimetype text; `A.h` + `a.h`; an entry with external attributes marking a symlink (`(attrs >>> 16 & 0o170000) === 0o120000`); a directory entry with data; compression method 12; > 2,000 entries; an entry declaring > 8 MiB; total > 32 MiB; ratio > 200; an entry whose declared uncompressed size is smaller than its real inflated size (lying header); bytes > 32 MiB; a plain zip with no `mimetype` → message `That file isn't a Frotzsmith project (.frotzsmith).`
- [ ] **Step 2: Run** `npx vitest run app/project-package` — FAIL.
- [ ] **Step 3: Implement.** `readContainer` first scans the **central directory** itself (EOCD → entries: name, method, sizes, external attributes, local-header offset) to enforce every rule and limit **before** any inflation, then inflates with fflate per entry and verifies the inflated length equals the declared size (fflate's `unzipSync` doesn't expose external attributes or enforce declared sizes). Build test fixtures with a tiny raw-zip writer helper in the test file so hostile archives can be crafted.
- [ ] **Step 4: Run** — PASS. **Step 5: Commit** `feat(package): strict .frotzsmith container reader/writer`.

### Task 3: Manifest and project mapping (pure)

**Files:**
- Create: `app/project-package/manifest.ts`, `app/project-package/project.ts`, tests `app/project-package/manifest.test.ts`, `app/project-package/project.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces:
  ```ts
  interface ProjectSnapshot {
    language: 'i6' | 'zil'
    main: { name: string; text: string }          // e.g. 'haunted-house.inf'
    includes: { path: string; text: string }[]     // I6 .h files (uploaded extensions)
    extensions: string[]                           // enabled include names (bundled or packaged)
    tests: { name: string; text: string }[]
    skein: SkeinTree | null                        // from ~/composables/skein-tree
    settings: { target: 'auto' | 'z3' | 'z4' | 'z5' | 'z8'; library?: 'auto' | 'std' | 'puny' }
    title?: string
    opaque: { path: string; bytes: Uint8Array }[]  // kept, never shown
    manifestExtra: Record<string, unknown>         // unknown manifest fields, kept
    created?: string
  }
  async function writeProjectPackage(p: ProjectSnapshot, o: { generator: string; now: Date }): Promise<Uint8Array>
  async function readProjectPackage(bytes: Uint8Array): Promise<{ project: ProjectSnapshot; ignored: string[]; hashMismatches: string[] }>
  ```
- Mapping (writer): main at its name; includes at their paths; each test at `tests/<slug>.txt` (slug via existing `slugify`, `-2`, `-3` on collision), recorded in `manifest.tests` with its display name; Skein at `<main stem>.skein` using the existing export shape; opaque at their paths; `files` = SHA-256 of every written entry except `mimetype` and `frotzsmith.json`; `created` kept if present, `modified = now`.
- Mapping (reader): every path the manifest names (`main`, each `tests[].path`, `skein`) must pass `pathProblem` and exist in the package, else `PackageError` (`The project's manifest points at a file that isn't in it: <path>.`); the manifest is data only — no field is ever executed or fetched. Manifest required, `format` must be `frotzsmith-package`, major version `0` (a higher major → `This project was made by a newer Frotzsmith (format <v>). Update Frotzsmith to open it.`); `main` must exist and end `.inf` (i6) or `.zil` (zil); text entries must be valid UTF-8 (`TextDecoder('utf-8', { fatal: true })`) with no NUL; `.h` → includes (I6); `tests/` per manifest (files under `tests/` not in the manifest are still opened as tests, name = file stem); the Skein entry must pass `isValidTree` (else it is kept as opaque and reported in `ignored`); compiled stories → `ignored`, not kept; everything else → `opaque`; hash mismatches are **reported, not refused** (Drafter §4).

- [ ] **Step 1: Failing tests** — a full snapshot round-trips (`readProjectPackage(await writeProjectPackage(p))` deep-equals `p` apart from `modified`) including two opaque files, an unknown manifest field `"com.example.color": "teal"`, three tests with colliding names, and a Skein (**Review Focus 2**); a `.z5` inside → listed in `ignored`, absent from `opaque`; missing manifest / wrong `format` / missing main / main `.zil` with `language: "i6"` / invalid UTF-8 main / version `"1.0"` → `PackageError` with the exact sentences above (write the others as one clear sentence each); a tampered entry → `hashMismatches` names it.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS. **Step 5: Commit** `feat(package): manifest + project mapping (lossless round trip)`.

### Task 4: Website integration (composable + opaque store)

**Files:**
- Create: `app/composables/useProjectPackage.ts`, `app/composables/project-extras-store.ts`, tests `app/composables/useProjectPackage.nuxt.test.ts`
- Modify: `app/composables/useSkein.ts` (expose `replaceTree(tree: SkeinTree)` used by import; keep `importSkein` using it), `app/composables/useTestScripts.ts` (expose `replaceAll(scripts: { name: string; text: string }[])` for the active bucket), `app/composables/useExtensions.ts` (expose `replaceUploaded(files: { path: string; text: string }[], enabledNames: string[])` that validates the total against `EXTENSIONS_TOTAL_MAX_BYTES` **before** changing anything and throws `ZipLimitError` otherwise)

**Interfaces:**
- Consumes: Tasks 2–3; `useIde()` (`source`, `storyTitle`, `storyBase`, `loadSource(text)`, `profileMode`, `targetMode`, `setProfileMode`, `setTargetMode`), `useLanguage()`, `useExtensions()`, `useTestScripts()`, `useSkein()`, `useShareLink`'s pristine rule (move `isPristine(text)` to `app/utils/pristine.ts` and import it in both).
- Produces: `useProjectPackage(): { buildPackage(): Promise<{ bytes: Uint8Array; filename: string }>; inspect(file: File): Promise<PendingOpen>; apply(p: PendingOpen): Promise<void>; needsConfirm(): boolean }` where `PendingOpen = { project: ProjectSnapshot; ignored: string[]; hashMismatches: string[]; hiddenCount: number }`. `filename` = `${storyBase}.frotzsmith`. `project-extras-store.ts`: IndexedDB database `frotzsmith-extras`, store `opaque`, key `${lang}:${storyKey}` → `{ entries: {path, bytes}[], manifestExtra, created }` with an in-memory fallback (mirror `skein-store.ts`).
- Rules: `inspect` does all reading/validation and the language check (refuses the other language with `This is a ZIL project — open it from the ZIL editor.` / `… an Inform 6 project — open it from the Inform 6 editor.`) and the extensions budget check — so `apply` cannot fail half-way. `apply` = `loadSource(main.text)` (which resets ephemeral state and sets the story key) → settings → extensions → tests → Skein → extras store. **No compile, Play, or replay is started** (assert in a test that `useCompiler().compile` and replay are never called). `needsConfirm()` = the current source is not pristine.

- [ ] **Step 1: Failing tests** — build → inspect → apply → build round-trips all content (**RF 2**); other-language package refused by `inspect`, state untouched (**RF 4**); includes over 4 MiB refused by `inspect`, state untouched (**RF 5**); `needsConfirm()` false on the demo seed, true after an edit (**RF 3** — the UI's Cancel path is Task 5); apply starts no compile/replay; hidden files survive a page reload (extras store) and are written back by the next `buildPackage`.
- [ ] **Step 2–4:** run (FAIL), implement, run (PASS); then `yarn test` and `yarn typecheck`.
- [ ] **Step 5: Commit** `feat(package): Download/Open project on the website — atomic apply, nothing runs`.

### Task 5: Toolbar, confirmation, verification, docs

**Files:**
- Modify: `app/components/ide/SourceToolbar.vue`, `CHANGELOG.md`, `docs/06-security.md`
- Create: `app/components/ide/OpenProjectModal.vue`

- [ ] **Step 1: UI.** The existing **Open** accepts `.frotzsmith` too (`accept` adds `.frotzsmith`); a `.frotzsmith` file goes to `inspect`, others keep today's behavior. Add a **Download project** button (`i-lucide-package`, label "Download project", title "Download this project as a .frotzsmith file — source, includes, test scripts and Skein"). `OpenProjectModal.vue` (UModal) appears when `needsConfirm()`: "Replace the project in the editor?" with the package's title/main name, **Replace** and **Cancel** (Cancel changes nothing — **RF 3**); when not needed, apply directly. After apply, a success toast; if `hiddenCount > 0`, its description says "N files in this project aren't shown here — they're kept and included when you download it."; `ignored` compiled stories → "Compiled story files in the package were ignored — compile to rebuild them."; hash mismatches → a warning toast naming them. Refusals (`PackageError`/`ZipLimitError`) → an error toast with the sentence.
- [ ] **Step 2: Verify** `yarn typecheck`, `yarn test`, `yarn generate`; axe (axecap MCP, AA + best practices) on `/` and `/zil/` with the modal open and closed — 0 violations.
- [ ] **Step 3: Browser pass** (chrome-devtools MCP, `npx http-server .output/public -p 8081 -s -c-1`): on `/`, edit the demo, add a test script, Skein node, upload a `.h`; Download project; reload; Open project → confirm → everything restored, nothing compiles; open the same file on `/zil/` → refused with the sentence; open a renamed `.zip` → refused.
- [ ] **Step 4: Docs** — CHANGELOG `### Added — <date> .frotzsmith projects`; `docs/06-security.md` gains a "Project packages" subsection (untrusted input, limits, source-only, nothing runs, refusal is whole).
- [ ] **Step 5: Commit** `feat(package): Open/Download project in the toolbar; docs`.

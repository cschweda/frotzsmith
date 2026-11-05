# Frotzsmith desktop app, `.frotzsmith` packages, versioning & offline web — design

**Date:** 2026-11-04 · **Status:** draft for approval · **Owner:** Chris Schweda (personal project)

## 1. Intent — why this exists

Frotzsmith (https://frotzsmith.com) is a browser IDE for Inform 6 and ZIL. Today it needs the
network to load, and a project lives only in browser storage (localStorage + IndexedDB) as a
single source buffer plus uploaded `.h` files.

The author wants to **work offline with real files on disk** — on a laptop, when wifi is flaky —
with a game kept as an ordinary **folder** (main source, includes, I6 extensions, test scripts),
and to **double-click a `.inf` or `.zil`** to open it.

**Drafter is the canonical model.** The author's own Drafter (https://github.com/cschweda/drafter)
already ships this machinery: an Electron desktop app (`apps/desktop`), a package format
(`docs/spec/drafter-package.md`), one version number shared by web and desktop, a website
service worker with update offers (`apps/web/app/update/*`), and a release workflow
(`.github/workflows/desktop.yml`). The author's rule: **if Drafter does it, Frotzsmith should
too.** Where this design deviates, it says why. Builders should read Drafter's code for each
area before writing Frotzsmith's.

## 2. Goals

1. **Desktop app** (Electron) running the same IDE fully offline, from its own files.
2. **Projects are folders on disk**, edited in place; double-clicking a source file opens its
   whole folder as the project.
3. **`.frotzsmith` package** — a zipped project for moving/keeping — that opens and saves in
   **both** the website and the desktop app.
4. **Native menus** in the desktop app.
5. **One version number**, an About view, and **update checks** on web and desktop.
6. **Offline-capable website** via a service worker, Drafter-style.
7. **Published releases** (GitHub Releases) with auto-update, matching Drafter's *current*
   distribution state (see §7).

## 3. Non-goals (v1)

- Signed/notarized macOS builds and a public Mac download (held back; §7).
- Windows code signing (unsigned, like Drafter today; slots in later).
- Restructuring the repo into Drafter's `apps/web` + `apps/desktop` workspace.
- Hosted storage, accounts, sync, or publish mode (still deferred).
- Glulx, or any change to the compilers or interpreter themselves. (The ZILF **export
  wrapper** does change — §5.3a — but ZILF/ZAPF are untouched.)

## 4. Anti-goals (would be a failure even if it "works")

- **Anything running automatically from an opened file.** Opening a `.frotzsmith`, a folder, or
  a source file must never compile, play, replay, or execute anything (author's explicit
  requirement, "like Drafter"). See §6.
- Locking source inside an opaque container: the working format is plain files.
- Silent data loss: on package round-trips, on file changes from outside, or on update reloads.
- Changing how the operating system treats files it already owns (Windows `.inf`; §5.4).

## 5. What gets built

### 5.1 Repository layout (builder's call, approved by the author)

A new top-level **`desktop/`** folder beside the existing root Nuxt app — not a workspace
restructure (moving the web app would ripple through Netlify, CI, `tools/inject-preloads.mjs`
and the versioned `/zilf/r…/` paths for no user benefit). `desktop/` holds the Electron main
process, preload, the `app://` file server, packaging config, and its own tests. A
`build-web` step (Drafter: `apps/desktop/scripts/build-web.mjs`) builds the web app with a
desktop flag and copies `.output/public` into `desktop/web/`, swapping folders atomically.

Package manager stays **yarn 1** for the root app; `desktop/` may use yarn too (Drafter uses
pnpm — not worth switching for).

### 5.2 The desktop shell (mirror Drafter `apps/desktop/src`)

- Serves the static web build from a privileged custom scheme **`app://frotzsmith/`**
  (standard, secure, fetch-capable, CORS) — Drafter `protocol.ts` (path resolution that refuses
  `..`, encoded separators, NUL, drive letters, Windows reserved names; content types by
  extension incl. `.wasm` → `application/wasm`; CSP on pages and scripts).
- Directory URLs map to `index.html` (`/zil/` → `zil/index.html`); unknown paths fall back to
  the SPA shell (Nuxt `200.html`/`404.html` as generated).
- **CSP** = the policy in `netlify.toml` (it already needs `'unsafe-eval'` for the ZVM's runtime
  code generation and `'wasm-unsafe-eval'` for the compilers), sent per response.
- Frotzsmith-specific checks the shell must pass (these are the real unknowns — spike first,
  §9):
  - module Web Workers (`new Worker(url, { type: 'module' })`) for the I6 compile, ZIL compile
    and replay workers load from `app://`;
  - **ZILF's .NET WASM runtime** (`/zilf/r…/_framework/dotnet.js`) boots inside its worker on
    `app://` (history: dotnet/runtime#114918 — never assign `self.onmessage` in that worker);
  - the Parchment play iframe (`/play/index.html?story=blob:…`) loads, and PlayPanel's
    `e.origin === window.location.origin` message check passes on `app://frotzsmith`.
- **Desktop build flag** (Drafter: `DRAFTER_DESKTOP=1`), e.g. `FROTZSMITH_DESKTOP=1`, removes:
  Plausible (`/pa/init.js`; the `/pa/*` proxy only exists on Netlify), the service worker, and
  web-only storage notices. Share links must build `https://frotzsmith.com/…` URLs, not
  `app://` (today `useShareLink` uses `window.location.origin`).
- Hardening as Drafter: `contextIsolation`, renderer `sandbox`, no `nodeIntegration`; a narrow
  preload IPC surface; file access only inside folders the user chose (Drafter `grants.ts`);
  the window can't navigate away; `shell.openExternal` only for `https:`; Electron **fuses**
  copied from Drafter's `electron-builder.config.cjs` (no run-as-node, no inspect/NODE_OPTIONS,
  ASAR integrity, only-load-from-ASAR); no source maps shipped.
- Single-instance lock; a second launch (double-click while open) hands its file to the running
  app (Drafter `instance.ts`, `open-files.ts`, `file-handlers.ts`).
- **One window** (as Drafter's desktop design §3: "one window per app and focuses it when a file
  is opened again"). Opening another project from the OS or File → Open **replaces** the
  current one in that window, asking first (Save / Don't Save / Cancel, a native dialog) when
  there are unsaved changes. Closing with unsaved changes asks the same way (Drafter §5).

### 5.3 Projects on disk (desktop)

- **A project is a folder.** It contains (names are guidance; the manifest is authoritative):

  ```
  haunted-house/
    frotzsmith.json          ← optional manifest (settings only)
    haunted-house.inf        ← main source
    rooms.h, lib/…           ← the author's includes
    extensions/ordinals.h    ← enabled extensions (I6)
    tests/*.txt              ← test scripts, one file each
    haunted-house.skein      ← the Skein (the existing .skein JSON export)
    build/haunted-house.z5   ← compiled output
  ```

- **Opening:** File → Open accepts a source file, a folder, or a `.frotzsmith` package.
  Double-clicking `foo.inf` / `foo.zil` opens **its folder** as the project with that file as
  main. A folder with several sources and no manifest uses the one opened.
- **Includes:** `.h` files in the folder that the source `Include`s appear in the explorer and
  are mounted for the compile exactly as uploaded extensions are today.
- **Manifest `frotzsmith.json`** — written only when the author changes a setting worth keeping
  (forced library, forced target, enabled extensions, main file). Settings only; see §6.
  Builder's call: field names modeled on Drafter's `drafter.json` (`format`, `version`,
  `generator`, `main`, `language` → for us the source language `i6`/`zil`, plus `target`,
  `library`, `extensions`), unknown fields preserved.
- **Saving:** ⌘S / Ctrl+S writes in place, atomically (temp file beside it, then rename —
  Drafter §3), keeping line endings. Save As writes elsewhere.
- **Nothing is written to the project folder without an explicit action** (builder's call,
  from §6's spirit): Save writes the source, dirty test scripts, the Skein, and the manifest (if
  a setting changed). **Compile writes nothing to disk** — the story stays in memory as on the
  web; it reaches disk only via Download/Save story file or Export playable HTML. So
  double-clicking a file in `~/Downloads` never litters that folder.
- **Folder access:** opening a file grants the app read/write within **its folder** (the
  author's "whole folder is the project"), via Drafter-style grants (`grants.ts`) extended from
  a file to a folder; nothing outside granted folders is reachable from the page.
- **Crash recovery** lives in the app's profile (Drafter §5: "a recovery copy no browser will
  clear"), **keyed per project folder path**, not per language as the web's is.
- **Outside changes** (another editor, `git pull`): Drafter's changed-elsewhere check — on open,
  on window focus, before Save, and while focused via `fs.watch` — comparing bytes and mtime.
  No unsaved edits → reload silently. Unsaved edits, or a recovery copy newer than the last
  Save while the file also changed on disk → **always ask**, never pick silently.
- Test scripts and the Skein read from / write to the folder instead of browser storage when a
  project folder is open.

### 5.3a Multi-file ZIL (author's decision: in v1)

> **Status: done for the web (M2b, 2026-11-04).** ZILF compiles a file set (bundle
> `r5262550-w2`), the explorer shows and edits extra `.zil` files, diagnostics open the file
> they name, and `.frotzsmith` packages carry them. Desktop folders follow in M3; the §5.3b
> zillib-clash warning in M2c.

- ZIL links files the way I6's `Include` does: the main file pulls others in with
  `<INSERT-FILE "rooms">`; ZILF resolves `rooms.zil` relative to the main file / include paths
  and reads it in at that point (order matters). A `.zil` nothing inserts isn't compiled.
- Today `ZilfExports.Compile(source, version)` (`tools/zilf-wasm/ZilfExports.cs`) puts one
  file, `/game.zil`, into an `InMemoryFileSystem`. Change it to accept **a set of files**
  (relative path → text) plus the main path, place each at its relative path, and compile the
  main — so ZILF resolves `INSERT-FILE` exactly as on disk. Rebuild the .NET bundle under a new
  versioned `/zilf/r<rev>/` path (immutable caching), update `useZilfWasm`/the worker protocol,
  and add golden tests for a multi-file game (one test that an un-inserted file is ignored).
- ZILF diagnostics name the file; clicking one opens that file's tab.
- Name clashes with `zillib` files follow §5.3b.
- The website gains the same: extra `.zil` files in a project (from a package, or uploaded)
  appear in the explorer and are passed to the compile, as `.h` files are for I6.
- In a `.frotzsmith` package the extra files sit at their relative paths; `main` names the
  root; nothing else records the links — the `INSERT-FILE` lines are the single source of
  truth.

### 5.3b Name clashes with canonical library files (author's decision; both languages)

A project file whose name matches a **canonical library file** — the I6 Standard Library or
PunyInform `.h` files (`parser.h`, `verblib.h`, `grammar.h`, `puny.h`, …) for the active
library, or a bundled `zillib` file for ZIL — compared **case-insensitively**, never silently
wins or loses.

- **When it's detected:** whenever such a file enters a project — added/uploaded, a folder
  opened, a `.frotzsmith` imported, or a file renamed to a clashing name — and again before a
  compile if a clash exists without a recorded choice (e.g. after switching I6 library).
- **The warning** names the file and the library file it clashes with and offers:
  1. **Rename mine** (default; suggests a free name such as `parser-custom.h`) — the project
     file is renamed and the library's version is used;
  2. **Use mine instead of the library's** — for an advanced author who deliberately edited a
     library file: the project file **replaces** the library file of that name for this
     project's compiles. ("The user knows best.")
  3. Cancel (desktop/web open or import: the file isn't added; existing folder: nothing
     compiles until resolved).
- **The choice is recorded** in the manifest as data — e.g. `"libraryOverrides": ["parser.h"]`
  — and in the web project state, so the warning isn't repeated each compile. A package or
  folder carrying an override recorded by someone else still shows the warning once on import
  (the importing author confirms it), since a replaced library file changes what the game does.
- **While an override is active** it stays visible: the explorer marks the file ("replaces
  library `parser.h`"), the read-only library tab of that name says it's overridden, and the
  Results output notes the override on each compile. Removing the override (or the file)
  restores the library's version.
- Mechanism (builder): for I6, the compile mounts the overriding file in place of the library
  file of that name; for ZIL, place it so ZILF's `INSERT-FILE` resolution picks it over the
  embedded `zillib` copy (or, if ZILF can't be made to, report before building on). Golden
  tests cover both: override on → the author's file is compiled; off → the library's.

### 5.4 File associations (electron-builder `fileAssociations`, as Drafter)

| Extension | macOS | Windows | Linux |
|---|---|---|---|
| `.frotzsmith` | Default (own UTI) | Default | Default |
| `.zil` | Default | Default | Default |
| `.inf` | Default | **"Open with" only — never default** | Default |
| `.h` | Alternate | "Open with" only | Alternate |

Windows uses `.inf` for driver *Setup Information* files (right-click → Install); claiming it
would change how the OS treats them. On macOS declare imported UTIs for `.inf`/`.zil`
conforming to `public.plain-text` (Drafter does this for `.fountain`).

### 5.5 The `.frotzsmith` package (web and desktop)

- **Purpose** (as Drafter's spec §1): one file for **moving and keeping** a project — email,
  backup, between machines, between website and desktop. **Not** the working format.
- **Write a spec** at `docs/spec/frotzsmith-package.md` modeled section-for-section on
  `docs/spec/drafter-package.md` (CC0, RFC-2119 language, container, layout, manifest,
  conformance, versioning, security considerations). Container rules copied from Drafter §2:
  ZIP, `mimetype` first & stored (`application/vnd.frotzsmith.package+zip`), UTF-8 paths, no
  `..`/absolute/backslash/drive/NUL/control chars, no case-colliding paths, no symlinks; readers
  ignore-but-keep unknown files and fields.
- **Contents: source only** — main file, includes, extensions, test scripts, Skein, manifest.
  Compiled story files are **not** written, and are **ignored** if present (§6).
- **One shared reader/writer module** used by both web and desktop (fflate is already a
  dependency; Drafter has its own `packages/archive` — check whether to port its zip
  writer/reader or use fflate; builder's call).
- **Website:** **Download project** (`.frotzsmith`) packs the current browser state (source,
  uploaded `.h` files, enabled extensions, test scripts for the active game, the Skein, profile
  settings). **Open project** loads one; over a non-empty editor it asks first (the
  share-link non-destructive rule). Includes in a package become uploaded files in the browser,
  and round-trip back out unchanged. **Entries the web IDE can't show** (other source files, a
  README, unknown folders, unknown manifest fields) are kept as hidden opaque entries in
  IndexedDB and written back on Download — Drafter's spec rule "never lose anything" (builder's
  call; the web shows a one-line note that the package holds N files it doesn't display).
- **Desktop:** Export packs the open folder; Import unpacks into a folder the author picks.
- Existing per-file opens (`.inf` Open, `.skein` import, `.h`/`.zip` extension upload) keep
  working.

### 5.6 Native menus (desktop)

Builder's draft, adjust to Drafter's `menu.ts` conventions:

- **File:** New Project · Open… (file, folder, or `.frotzsmith`) · Open Recent · Save · Save
  As… · Import `.frotzsmith`… · Export `.frotzsmith`… · Export playable HTML… · Close
- **Edit:** standard roles + Prettify
- **Build:** Compile (⌘B / Ctrl+B) · Play · Run test script · Run stale (Skein)
- **View:** right-pane tabs · file explorer · light/dark
- **Help:** Technical details · Report a bug · Check for updates · About Frotzsmith

macOS: the standard app menu; Windows/Linux: a window menu bar. The website keeps its
in-page toolbar unchanged.

### 5.7 Versioning, About, update checks

As Drafter (`apps/web/scripts/version.mjs`, `apps/web/app/update/*`, `desktop/src/updates*.ts`):

- **One version**: `desktop/package.json` `version`. The web build reads it at build time
  (Nuxt define), with the build's commit hash and commit date. A release tag `vX.Y.Z` must equal
  it; a test asserts every copy agrees. Start at `0.1.0` (builder's call; the root
  `package.json` is `0.0.0` today).
- **About Frotzsmith** (web and desktop): version, commit, date, and **Check for updates**.
- **Desktop updates:** electron-updater against GitHub Releases on Windows/Linux; Help → Check
  for updates and an optional check-on-start setting; a found update offers **Restart**, never
  forced. macOS update checking stays off until the app is signed.
- **Website updates:** via the service worker (§5.8): a new deploy waits; the page offers
  **Reload**, flushing unsaved work first; never reloads by itself; "Later" hides the offer
  until next visit.

### 5.8 Website service worker (offline web)

Follow Drafter's service worker and update flow. Frotzsmith specifics (builder's calls — verify
against Drafter's strategy):

- Precache the app shell, the I6 compiler worker + `inform6.wasm`, and `/play/*` up front.
- Cache the **~13 MB ZILF runtime** (`/zilf/r…/_framework/*`) only after the visitor first uses
  ZIL — a visitor who never opens `/zil/` must not download it.
- Respect the existing cache layout in `netlify.toml` (`/_nuxt/builds/*` no-cache, immutable
  hashed assets, `/play/web/*` one-week cache).
- Disabled in the desktop build.

### 5.9 Releases & distribution (match Drafter's *current* state)

- A `v*` tag runs a release workflow publishing to **GitHub Releases** on `cschweda/frotzsmith`;
  tags are cut only when the author chooses.
- **Windows:** x64 NSIS installer, **unsigned**, published (SmartScreen warns until signed).
  Carry Drafter's check that `app-update.yml` matches the build's signature state.
- **Linux:** AppImage + `.deb`, published (builder's call: Drafter does; drop if unwanted).
- **macOS:** built and tested in CI on branch pushes, ad-hoc signed, **never published**.
  Signing/notarization steps written but disabled; they turn on when Apple Developer secrets
  are added (author plans to get the account in a few weeks).
- **README:** download links for Windows/Linux and a note that a **Mac download is
  forthcoming** once it can be signed and notarized — no date.

## 6. Security (author's requirement: nothing runs automatically, like Drafter)

- **Opening never executes.** Opening a package, folder, or source file only loads text. No
  compile, Play, replay, or Skein auto-run. (The Skein's auto-run already fires only after the
  author presses Compile — keep it that way.)
- **Packages carry source only.** A compiled story inside a package is ignored, never played —
  a crafted story file can't reach the interpreter by being opened. Export playable HTML, not
  the package, is how a playable game is shared.
- **Strict unpacking** (web and desktop): Drafter §2 path rules; caps on entry count and total
  uncompressed size (cf. the existing extension-zip caps, 200 entries / 5 MB — the package cap
  will need to be larger; builder's call); refuse the whole package on any violation, with a
  sentence saying why; only expected file types are written to disk on desktop import.
- **Manifest is data.** No field for commands, hooks, or URLs; every path must resolve inside
  the project; unknown fields ignored (and preserved).
- **Shell hardening** per §5.2; compilers and the interpreter stay in their existing workers.

## 7. Constraints

- Personal weekend project; no deadline ("not in a rush").
- Existing CI must stay green: tests, typecheck, `yarn generate` (whose `postgenerate` runs
  `inject-preloads` and the **replay-worker smoke test**), and the axe zero-violation gate.
- Netlify deploys the website from `yarn generate`; the desktop flag must never leak into a web
  deploy (Drafter deletes its build output after copying for this reason).
- GPLv3 (the project bundles GPLv3 ZILF).
- Known deploy facts: `netlify.toml` `[[redirects]]` are shadowed — custom rules go in
  `public/_redirects`; Plausible is first-party under `/pa/`.

## 8. Decided by the author

Desktop app like Drafter · offline + real files is the why · project = folder · double-click a
bare `.inf`/`.zil` opens its whole folder · **multi-file ZIL in v1** · library-name clashes warn, offering rename or a deliberate,
recorded override · `.frotzsmith` exists and works on **both** web and
desktop · nothing runs automatically from an opened file · `.frotzsmith` import/export and
native menus are in v1 · `desktop/` folder (not a workspace restructure) · publish like Drafter
with auto-updates, Mac held back with a README note · one version number with update checks on
web and desktop · website service worker like Drafter · Drafter is the canonical model.

## 9. Left to the builder

- **Spike first** (throwaway): Electron + `app://` serving `.output/public`; confirm the three
  workers, ZILF's .NET boot, and the play iframe. If ZILF can't boot, report before building on.
- Order of work — suggested milestones, each shippable:
  1. Versioning + About + service worker + update offers (website).
  2. `.frotzsmith` spec + shared reader/writer + website Download/Open project.
  3. Desktop: shell → project folders → associations → menus → packaging → release workflow.
- Exact manifest field names, package size caps, cache strategy details, menu wording, the
  Linux decision — within the rules above, checked against Drafter.

## 10. Builder's calls made during design (for the author to check)

- `desktop/` uses yarn, not pnpm.
- Manifest written lazily (only when a setting changes).
- Version starts at `0.1.0`.
- ZILF runtime cached by the service worker only after first ZIL use.
- Linux builds published.
- Browser: package includes become uploaded files; files it can't show are kept opaque.
- Compile writes nothing to disk; the folder changes only on Save / explicit exports.
- Crash recovery keyed per project folder; disk-vs-recovery conflicts always ask.
- One window; opening another project replaces the current one after asking.

# Frotzsmith — Security

**Document 06 of 13 · Security**

Frotzsmith is a static, client-only app: no backend, no accounts, no user data leaving the browser except via explicit downloads the author initiates. That eliminates whole categories of risk (no server to breach, no DB, no auth surface) but introduces a few specific to running a compiler and untrusted story files in-browser.

---

## 1. Threat model (honest and bounded)

| Asset | Threat | Mitigation |
|-------|--------|-----------|
| The author's source | Loss | localStorage autosave + explicit project export (Doc 05). |
| The browser tab | A malicious/buggy story file or pasted source hanging or abusing the page | WASM/interpreter sandboxing; Web Worker isolation for replay; teardown discipline. |
| The DOM | XSS via rendered game output or error text | Treat all interpreter output and compiler stderr as untrusted text; no `innerHTML` of unsanitized content. |
| Exported bundle recipients | A shared `.html` doing something unexpected | Bundle contains only pinned runtime + the author's story; no remote requests; self-contained. |
| Imported projects | Malicious project JSON | Strict validation, text-only treatment, never `eval`. |

There is no remote attacker surface (no server). The realistic risks are **self-inflicted** (a runaway game freezing the tab) and **XSS via untrusted text** (game output, error messages, pasted source).

## 2. WASM compiler sandboxing

- The `inform6` WASM module runs in the browser's WASM sandbox: no filesystem beyond MEMFS, no network. It cannot touch the host.
- **Single-threaded build** (no pthreads / `SharedArrayBuffer`) — chosen also to avoid needing COOP/COEP cross-origin-isolation headers, keeping the site "deploy anywhere static."
- **A fresh module instance is created per compile** (the I6 compiler isn't safe to run `main()` twice — Doc 01 §2.2), so each run starts from clean memory and a fresh MEMFS; no stale artifacts leak between runs.
- **Compile runs in a Web Worker** so a pathological source that makes the compiler spin doesn't freeze the UI, and a main-thread wall-clock timeout can `terminate()` it and report "Compile timed out." This is required, not optional: a synchronous compile on the main thread cannot be aborted (the timer can't fire until it returns).

## 3. Interpreter / story-file sandboxing

- Story files are untrusted by definition (the author may paste/import someone else's `.inf`, or compile experimental code).
- Interpreters (ZVM/Quixe via Parchment) run in the browser sandbox; the Z-machine/Glulx VMs cannot escape to the host.
- **Headless replay runs in a Web Worker** (one fresh worker per run, terminated afterwards), so an infinite game loop or huge output doesn't lock the main thread. Each run has a wall-clock budget of 15 s + 250 ms per command, capped at 2 minutes (`replayBudgetMs`); overruns terminate the worker and are reported cleanly. There is no separate turn cap — a run executes exactly the script's commands.
- Output volume is bounded: each turn's captured text is capped at 256 KB with a visible "output truncated" notice (`MAX_TURN_OUTPUT_CHARS` in `headless-glkote.ts`), so a game that prints forever can't grow the worker's memory until the timeout.

## 4. XSS / output handling

All three text streams are **untrusted** and must never be injected as HTML:
1. **Compiler stderr** (error/warning messages) — rendered as text content, not HTML.
2. **Game output** in the Play tab — Parchment/GlkOte handles rendering; Frotzsmith doesn't post-process it into the DOM as raw HTML.
3. **Game output** in the Transcript tab — rendered as text content; if any styling is applied, it's via safe DOM construction, never `innerHTML` of game text.

Where Frotzsmith itself renders any of this (Transcript, Results), it uses text nodes / framework text binding (Vue's default escaping), never `v-html` on untrusted content. (The markdown editor already established DOMPurify discipline for *its* HTML rendering; Frotzsmith's surfaces are plain text, so the rule is simply "no raw HTML from untrusted sources.")

## 5. Export hygiene

- **Filenames** sanitized on every download (path traversal, invalid chars, length) — reuse the markdown editor's util.
- **Playable bundle**: assembled from pinned local runtime + the author's story bytes only. No remote `<script src>`, no fetches → the artifact can't be a vector for pulling in remote code, and works offline.
- **Project export JSON**: plain data; no executable content.

## 6. Import validation

- Project import: parse JSON in a try/catch, validate required fields and types against the `ProjectExport` shape, reject unknown shapes with a clear message, treat `source`/`scripts` strictly as text. Never `eval`, never construct functions from imported strings.

### 6.1 Project packages (`.frotzsmith`)

A `.frotzsmith` file is untrusted input, read entirely in the browser.

- **Limits, checked before inflating:** archive <= 32 MiB; <= 2,000 entries; each entry <= 8 MiB and total <= 32 MiB uncompressed; compression ratio per entry <= 200:1. Sizes declared in the headers are verified against the actual bytes; CRC mismatches are refused.
- **Container rules:** first entry `mimetype` (stored, exact content); exactly one end-of-central-directory record, with **no archive comment** (another unzipper could find a second archive in it); entries stored or deflated only, and a deflate stream must end exactly where the entry's data does; extra fields must be well-formed and must not carry an Info-ZIP Unicode Path / Unicode Comment field (`0x7075` / `0x6375`, a second name other tools show). Unix file-type bits are checked **from any "made by" host**: symlinks, FIFOs and devices are refused, and so is a file that is also another entry's folder (`a` next to `a/b`). The manifest is <= 1 MiB JSON.
- **Path rules** (`app/project-package/paths.ts`, shared by reader, manifest and writer): UTF-8 `/`-separated paths with no `..`, `.`, empty segments, leading `/`, backslash, drive letters, control characters, DEL or lone surrogates; nothing Windows or macOS can't hold — `: < > | ? * "`, a trailing dot or space or a leading space in any segment, a Windows device name in any segment with any extension (`CON`, `nul.txt`, `COM0`–`COM9`, `COM¹²³`, `LPT` likewise, `CONIN$`, `CONOUT$`); no invisible or deceptive characters (Unicode Cf — bidi controls, zero-width characters, BOM, soft hyphen, tags —, Zl, Zp, private use, the Hangul fillers, and the slash/backslash look-alikes U+2044 U+2215 U+29F5 U+29F8 U+FF0F U+FF3C). Two paths collide when equal after NFKC + a full case fold (`ß`/`ss`, `ſ`/`s`, `ı`/`i`, `ﬀ`/`ff`). The writer refuses exactly what the reader refuses, so a download always reopens.
- **Library files can't be replaced:** an include whose Include name or file name matches a library file of any profile (Standard Library or PunyInform), ignoring case, refuses the whole package. A manual upload with such a name is refused unless the author explicitly overrides (the choice is recorded on the extension); and the compile writes extensions first and the library after them, so without that recorded choice the library always wins.
- **Extensions are named before they land:** a package that installs or enables any extension always asks first, naming each one (extensions are shared by every Inform 6 game in the browser); the "Project opened" toast names them too.
- **Hidden files are named:** files kept with a project that the IDE doesn't show are listed by name (display-safe, at most 5 + "and N more") in the open dialog, the opened toast and the download toast.
- **Names are shown safely:** every name or title quoted in a message goes through `displayPath` — controls, format, separator, private-use and unassigned characters and the Hangul fillers become U+FFFD, combining marks are capped at 2 per character, names are cut to 60 characters + "…" — and is quoted (“…”), so a file name can't pose as part of the sentence.
- **Test scripts are capped:** at most 200 per package and 1 MiB of script text in all (they live in localStorage); beyond either the package is refused, and the writer refuses the same. Test-script buckets are a prototype-free map, so a game titled "Constructor" works.
- **Source only:** everything read is treated as text. Compiled stories (`.z3 .z4 .z5 .z8 .ulx .blb .zblorb`) are ignored, never written.
- **Nothing runs:** opening loads text into the editor, extensions, test scripts and Skein. It does not compile, play, replay or run the Skein, and no imported string is evaluated.
- **Refusal is whole:** any violation (wrong language, over the uploaded-extension budget, a bad path, a manifest nested deeper than 64 levels, a plain `.zip`) refuses the entire package with one sentence; every check runs before the first write, so nothing is ever half-applied. Opening over existing work — edited source, different uploaded extensions, or test scripts / a Skein already saved for the game the package opens as — asks first, and the dialog names what would be replaced.
- **A Skein is rebuilt, never trusted:** every tree that is loaded — from a package, a `.skein` import, or an IndexedDB restore — goes through `sanitizeTree`, which rebuilds it into fresh objects holding only the known node fields (so a `__v_isRef`/`value` pair can't make Vue show and replay another command, and deep junk can't break saving or download) and refuses node ids outside `^[A-Za-z0-9_-]{1,64}$` or starting `__` (Vue's `__v_*` keys, `__proto__`). The live tree is held `markRaw`, not as a deep reactive proxy. A `.skein` document nested more than 64 levels deep is refused. A `.skein` import is capped at 8 MiB and asks before replacing a Skein that has nodes; opening a plain source file asks before replacing edited source.
- **A Skein that can't be opened is kept, not refused:** a Skein that doesn't parse, is nested too deeply, has a bad node id, isn't a single tree (cyclic, orphaned), or is over 10,000 nodes / 10,000 levels deep is not loaded; it is kept byte-for-byte as a hidden file, written back on the next download, and the user is told "The project's Skein couldn't be opened".

## 7. localStorage hygiene

- Namespaced keys (`frotzsmith:*`) to avoid collisions.
- Quota-exceeded handled gracefully (warn, continue in memory) — the markdown editor's pattern.
- No secrets are ever stored (there are none — no auth).

## 8. Dependency pinning

- `inform6.wasm`, the standard library, PunyInform, and the Parchment runtime are **pinned** in-repo (the swappable-bundle model lets them be updated deliberately, with review, not silently). This is both a reproducibility and a supply-chain measure.

## 9. Content Security Policy (deployment)

Even as a static site, ship a CSP via `netlify.toml` headers: restrict `script-src`/`connect-src` appropriately. WASM may require `'wasm-unsafe-eval'` (or `'unsafe-eval'` depending on instantiation path) in `script-src` — documented as the one necessary relaxation, scoped as tightly as the chosen instantiation allows. No `connect-src` to third parties (the app makes no API calls).

### 9.1 Service worker (offline website)

The website registers a Workbox service worker (`@vite-pwa/nuxt`, configured under `pwa` in `nuxt.config.ts`) so it works offline after the first visit. Its scope is deliberately small:

- **Precache: the app's own files only** — the pages, the `_nuxt/` chunks and workers (the Inform 6 compiler's wasm among them), the Parchment player under `play/`, the demo story, fonts and icons. Explicitly excluded: `zilf/**`, `pa/**`, `og-image.*`, `200.html`, `404.html`. Precached entries are revisioned by Workbox; outdated caches are cleaned up on activation.
- **One runtime cache: `frotzsmith-zilf`.** Requests whose path is `/zilf/r<rev>/_framework/*` (the ZILF .NET runtime, ~13 MB) are served **CacheFirst** and stored only on a **200** response — never a 404, an error or an opaque response, so a bad fetch can't poison the compiler for good. The path carries the ZILF revision, so CacheFirst can't serve a stale runtime after an upgrade. Nothing is downloaded until ZIL is used.
- **Never cached:** `/pa/` (the first-party Plausible proxy — pageviews stay live and offline visits simply aren't counted) and **any third-party response** — the app makes no cross-origin requests (CSP `connect-src 'self' blob:`, §9), and the one runtime route keeps only status 200, which an opaque cross-origin response never has.
- **Updates never apply without the author.** `registerType: 'prompt'`, `skipWaiting: false`: a new worker installs and waits. The page offers *"A new version of Frotzsmith is ready"* (**Reload** / **Later**); only the author's **Reload** tells the waiting worker to take over, and only that tab reloads, after its pending saves are written. Other tabs keep their offer. `sw.js` and `manifest.webmanifest` are served `no-cache` (`netlify.toml`), so a deploy is noticed, not stuck behind an HTTP cache.
- **Nuxt's own reloads are off.** Nuxt 4 by default polls `builds/latest.json` hourly and reloads the page on the next in-app navigation once a new build exists, and reloads on a chunk that fails to load — both without writing the pending saves. `nuxt.config.ts` sets `experimental.checkOutdatedBuildInterval: false` and `experimental.emitRouteChunkError: 'manual'`; a chunk error shows the update offer instead (`plugins/service-worker.client.ts`, `app:chunkError`). A long-lived tab still learns of a deploy: the plugin calls `registration.update()` hourly, which can only raise the offer.
- `tools/check-sw.mjs` (run by `postgenerate`) reads the built `sw.js` and fails the build if any excluded path is precached, the `/` app shell is missing, or the ZILF runtime route is missing or not a pathname-matched, 200-only `CacheFirst`.
- **Kill switch (removing the worker).** To remove the service worker from every visitor, deploy a build made with **`FROTZSMITH_SW_KILL=1`** (e.g. as a Netlify build environment variable, then trigger a deploy). That sets `pwa.selfDestroying: true`: the deployed `sw.js` installs at once, unregisters itself, deletes every cache Frotzsmith made, and reloads its open pages from the network. `check-sw` checks that shape in that mode. **A rollback alone does not remove the worker:** rolling back to a deploy from before the service worker makes `/sw.js` a 404, and an installed worker that gets a 404 on update simply stays, serving its precache indefinitely. So: deploy the kill build first, leave it up long enough for visitors to come back (open tabs pick it up within the hourly check), then roll back or redeploy normally. This is the **one path that reloads pages without the author pressing Reload**, by design; it does not wait for an open tab's pending (debounced) saves, so the last second of typing can be lost; work already saved in the browser's storage is untouched (only Cache Storage is cleared).
- The desktop build (`FROTZSMITH_DESKTOP=1`) ships no service worker, no manifest and no registration code.

## 10. Summary

The static, client-only architecture is the biggest security win — there's almost nothing to attack remotely. The real work is (a) sandboxing/timeouts so untrusted source and story files can't hang or exhaust the tab, and (b) treating all compiler and game text as untrusted plain text in the DOM. Both are well-understood and cheap to get right.

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

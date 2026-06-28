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
- **Headless replay runs in a Web Worker** where feasible, so an infinite game loop or huge output doesn't lock the main thread; enforce a per-run turn cap and wall-clock timeout (configurable), reported cleanly.
- Output volume is bounded (cap transcript length with a "truncated" notice) to prevent memory blowups from a game that prints forever.

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

## 10. Summary

The static, client-only architecture is the biggest security win — there's almost nothing to attack remotely. The real work is (a) sandboxing/timeouts so untrusted source and story files can't hang or exhaust the tab, and (b) treating all compiler and game text as untrusted plain text in the DOM. Both are well-understood and cheap to get right.

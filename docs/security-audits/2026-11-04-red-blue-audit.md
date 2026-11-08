# 2026-11-04 — Red/blue audit (`.frotzsmith` package, M2a)

> Permanent record. Written when the audit closed; not rewritten afterwards. Later audits revisit these findings in their own records — see [the index](./README.md).

**Scope:** the new `.frotzsmith` project package (strict ZIP reader/writer in `app/project-package/`, Open/Download in `useProjectPackage.ts`, the opaque-entry store), everything a package or share link can feed (Skein trees, test scripts, extensions, the compiler's include mount, the Play iframe and the headless replay worker), the vendored Z-machine interpreters, CSP and headers, analytics, the service worker, and the supply chain. Branch `feat/m2a-package`, base `0bba864`.

**Method:** a blue-team pass reviewed 57 controls (44 sound, 11 weak, 2 missing) against the code and docs. A red-team pass built attack files and probe scripts using the repo's own modules, its Vue 3.5 reactivity and its `inform6.wasm` compiler, then cross-checked them with macOS `unzip`, `bsdtar`, `ditto` and Python `zipfile`. The controller re-ran every red-team probe, then traced the interpreter's code generation by hand, which turned a June "potential" finding into a proven one. The fixes went in in three rounds, each followed by an independent code review, and then a browser check of the production build.

**Overall posture: strong, after fixes.** Two High findings, both now fixed and pinned by regression tests. One of them, a code-injection path in the interpreter, had been present since the project began.

## Findings and mitigations

| ID | Severity | Finding | Mitigation | Status |
|---|---|---|---|---|
| F1 | **High** | **A package could replace a library file for every later game.** A package include named `VerbLib.h` (or `Parser.h`, `Grammar.h`, `puny.h` …) was installed as an *uploaded extension*. Those apply to the whole language, persist in localStorage, and were written into `/lib/std` after the library, so they overwrote it. No prompt appeared. Reproduced with the real compiler. | A package whose include/extension name matches any library file (in any case or path form, across Standard Library and PunyInform) is refused whole. The library is now mounted after extensions, so it always wins. Every package that adds or enables an extension asks first and names each one. Library-named uploads saved before the fix are no longer used at compile, are kept in the browser, and get a one-time notice. | **Fixed** (`db729fc`, `b9f29fe`) |
| F2 | **High** | **JavaScript injection through the Z-machine JIT, plus outside code running without a click.** Both ZVM copies (Play's `public/play/web/zvm.js`; the replay worker's `ifvms` 1.1.6 `src/zvm/text.js`) compile abbreviated strings with `Function()`, using U+E000 as a placeholder that later becomes `"`. A story whose custom Unicode table maps a character to U+E000 (Inform 6: `Zcharacter table + '@{E000}';`) could break out of the string and run arbitrary JS on frotzsmith.com. **PoC confirmed:** a story compiled by our own compiler set a global in both unpatched copies. A share link or package plus one Compile was enough, because the Skein auto-run replays the story. This is the 2026-06-30 "potential" High, now proven; that audit's `blob:`-only gate never covered source the user compiles. | Both copies are patched: Unicode-table entries U+E000 and C0 controls become U+FFFD, and every JS line terminator is escaped. The vendored file is patched in place, with a checksum manifest. `ifvms` is patched by a build transform that fails the build if the code changes or the transform never runs, including in the `nuxt dev` pre-bundle. Regression tests prove both copies were exploitable before and are inert after. The built worker is smoke-tested on every deploy. As defence in depth, source from a package, a share link or a plain opened file is marked per language, and the Skein won't auto-run it until you press Play or Run. | **Fixed** (`2bf668c`, `819eb32`, `9464b3b`, `fa63f78`, `310d952`) |
| F3 | Medium | **Vue-reserved keys in a Skein.** A node id `__v_isReactive` crashed the Skein panel for that game, and the damage persisted in IndexedDB. A node with `__v_isRef` + `value` validated as `look` but showed and replayed `quit`. | Every load path (package, `.skein` import, IndexedDB restore) rebuilds the tree from known fields only. Node ids must match `^(?!__)[A-Za-z0-9_-]{1,64}$`. | **Fixed** (`7b14c22`) |
| F4 | Medium | **Deeply nested junk in Skein nodes.** It was accepted, and 20,000 levels made download, save and clone throw, so the user couldn't download their own project. | Unknown fields are dropped by F3's rebuild. A `.skein` nested more than 64 levels deep is not opened. | **Fixed** (`7b14c22`) |
| F5 | Medium | **Analytics script lacked integrity** (open since 2026-06-30). `/pa/script.js` was a live rewrite of plausible.io's script, running as `'self'`, and a code comment wrongly called it closed. | A reviewed copy is vendored (byte-identical to upstream at audit time; source, date and sha256 recorded). Only `/pa/event` is proxied, and the desktop build has no analytics. | **Fixed** (`9755a04`) |
| F6 | Low | **Zip parser differentials.** A fake ZIP in the end-of-archive comment, or a Unicode Path extra field, made `unzip`, `bsdtar` and Python see different files from frotzsmith, including `../../escape.txt`. | A non-empty archive comment is refused. A Unicode Path field is accepted only when it repeats the entry's own name exactly. | **Fixed** (`ff53700`, `fe23001`) |
| F7 | Low | **Prototype-named games broke Tests.** A game titled "Constructor" or "toString" made the test-script panel throw. Room names had the same flaw in the map. | Prototype-free records throughout. | **Fixed** (`20f5f0f`, `e5e5d22`) |
| F8 | Low | **Symlinks were checked only for Unix-made archives**, and a file `a` next to `a/b` was accepted. | Any non-regular file type is refused whatever the host, and file-vs-folder collisions are refused. | **Fixed** (`ff53700`) |
| F9 | Low | **Unportable or deceptive file names** were accepted: Windows device names, trailing dots and spaces, `:` and `<>|?*"`, bidi and zero-width characters, slash lookalikes, and case-fold twins such as ſ/s, ß/ss and ı/i. | The reader refuses them, using full case folding. The writer renames device-name stems (`con` → `con_`) so a download always reopens. | **Fixed** (`ff53700`, `fe23001`, `b9f29fe`) |
| F10 | Low | **Deceptive display names.** Invisible and format characters, and file names built to read as sentences in toasts ("Your project was modified by malware…"). | Display names are cleaned, capped at 60 characters, quoted, and listed at most 5 at a time. Emoji sequences stay intact. | **Fixed** (`e86b912`, `fe23001`) |
| F11 | Low | **Loose CSP with no regression test.** | `blob:` removed from script, worker, frame and child sources (verified in Chrome: no violations across compile, Play, replay and ZIL). A test pins every security header. The remaining `'unsafe-eval'`/`'unsafe-inline'` are documented in `docs/06-security.md` §9. | **Fixed / residual documented** (`c5fc196`) |
| F12 | Low | **`.skein` import and plain Open replaced work silently**, with no size cap. | They ask first, and `.skein` imports are capped at 8 MiB. | **Fixed** (`0bca50b`) |
| F13 | Low | **Unlimited test scripts in a package.** | Capped at 200 scripts and 1 MiB of text. | **Fixed** (`4ac224f`) |
| F14 | Low | **Bytes after a compressed stream's end were accepted.** | Refused. The check was validated against 38,720 fflate and zlib streams. | **Fixed** (`ff53700`) |
| F15 | Low | **Hidden files rode along into downloads**, shown only as a count. | They're named in the open dialog and the download message. | **Fixed** (`db729fc`) |
| F16 | Low | **Supply chain.** Vendored interpreter files had no provenance; Actions were pinned by tag; one CI tool was unpinned; the Netlify install wasn't frozen. | Checksum manifest + test; Actions pinned by commit SHA; `browser-driver-manager@2.0.1`; `YARN_FLAGS=--frozen-lockfile` on Netlify. | **Fixed** (`c42b4fd`, `310d952`) |
| F17 | Low | **Missing tests** for the encryption bits, the play-page story gate, the `postMessage` source, and the iframe sandbox. | Tests added. They found two real gaps, both fixed: encryption flags in a local header only, and the play page accepting any `blob:` origin. | **Fixed** (`272ee26`) |
| F18 | Info | **Extension `.zip` upload is not atomic** and has no total-size cap beyond the existing limits. The main-thread compile fallback has no timeout. | Deferred to the next milestone. | Open |

**Held up under attack (no change needed):** `__proto__`/`constructor` keys stay plain data, with no prototype pollution through clone and round trip. The reader refuses all of these:

- prefix and trailing data
- lying sizes
- zip bombs
- encryption and ZIP64
- traversal, absolute, backslash, drive-letter, empty-segment and control-character names
- case-duplicate names
- 65-deep manifests

Cyclic Skeins and duplicate-child Skeins are kept but not opened. A test and the Skein can't share one file. Nothing in a package runs on open.

**Residual risks (accepted, tracked):**

- **Same origin.** The interpreters still run same-origin: the Play iframe needs `allow-same-origin allow-scripts`, and the replay worker is same-origin. Another ZVM code-generation flaw would again run as the IDE. *Planned:* an opaque-origin sandbox for play and replay.
- **CSP browser coverage.** The tightened CSP was verified in Chrome only.
- **Second tab.** Pressing Play in a second tab trusts that language's outside source in every tab. That counts as a deliberate action.
- **Lockfile pin.** `browser-driver-manager` is pinned by version, not by lockfile.

**Docs:** 22 places where the docs didn't match the code were corrected, in `docs/06-security.md`, the package spec, code comments and the README.

**Verification:**

- 1,304 tests pass (up from 897), and typecheck is clean.
- `nuxt generate` passes, with the replay smoke test and the F2 injection story inert in the built worker.
- Each fix round was independently reviewed.
- Browser check of the production build: a package that adds an extension asks first and names it; a library-named package is refused with a one-sentence reason.

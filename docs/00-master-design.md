# Frotzsmith — Master Design Document

**Document 00 of 13 · Master Design**
**Project:** Frotzsmith — a browser-based Inform 6 IDE
**Owner:** Chris Schweda (personal project)
**Status:** Draft v1
**Stack:** Nuxt 4 (4.4.8) · Nuxt UI 4 (4.9.0) · CodeMirror 6 · TypeScript · Yarn 1.22 · Netlify (static)

---

## 1. One-paragraph thesis

Frotzsmith is a personal-first, browser-based IDE for **Inform 6** — not Inform 7 — that mirrors the working rhythm of the classic Inform 7 IDE: write source in a left pane, compile, and watch results appear in a right pane that becomes a live, playable game on success. It compiles entirely client-side (the `inform6` compiler built to WebAssembly), auto-imports the correct standard library so a plain `.inf` file "just works," plays the compiled story inline via **Parchment**, persists source to `localStorage` as you type, and exports both the raw `.z*` story file and a self-contained, offline-playable Parchment HTML bundle. A power-user testing layer runs arbitrarily long command scripts (`n. examine rock. lift rock.`) through a headless replay engine and shows the transcript — the linear spine from which a full branching Skein with blessed-output regression diffing later grows.

## 2. Why this exists

Inform 6 is the author's favorite IF language. The existing browser tooling is fragmented: interpreters (Parchment, Quixe, ZVM) run *finished* story files, and the I7 IDE is a desktop Electron app tied to Inform 7's natural-language layer. There is no clean, modern, browser-native place to **write I6, compile it, and immediately play it** with library auto-import and saved test scripts. Frotzsmith fills that gap, primarily for the author's own use, secondarily as a shareable open-source tool.

## 3. Primary user & use case (be honest about scope)

The primary user is the author: an experienced IF developer who writes Z-machine games in Inform 6 with the standard library, wants to paste source, hit compile, see clickable errors, play inline, and run long test-command scripts to exercise a section or a whole game. Every other capability (Glulx, PunyInform, full Skein) is real and specified, but the **standard-library → Z-machine → Parchment → test-script** loop is the spine that must feel effortless. Phase ordering reflects this: the flat script runner ships before the branching Skein.

## 4. Core design decisions (locked)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Two-pane I7-style shell.** Left = source editor. Right = stateful panel with tabs **Results / Play / Transcript**, auto-focusing by state. | Matches the I7 IDE's silhouette and the author's markdown-editor twin-pane instinct; avoids a third zone. |
| D2 | **Client-side compilation.** `inform6` → WASM (single-threaded build, no pthreads). | No backend; Netlify-static deployable; single-threaded build avoids COOP/COEP cross-origin-isolation headers. |
| D3 | **Z-machine only (`.z8` default).** Glulx is *not* built in v1 — the author has never used it — but the `StoryEngine` seam is present so it can drop in later without a retrofit. | Z-machine is the author's daily and only path; the seam is cheap insurance, a second engine is not. |
| D4 | **One replay interface** (`StoryEngine`) with `ZmachineEngine` (ZVM/ifvms) implemented in v1; `GlulxEngine` is a deferred stub behind the same `createEngine` factory. | The Skein and test runner never learn the VM difference; they call one `replay` primitive — and a future Glulx engine needs no refactor. |
| D5 | **Library profiles**, not "the library." A profile bundles: include set, default Z-version, default compiler switches, highlight keyword set, starter template. | PunyInform is a *replacement* library, not a superset; profiles let it coexist without contaminating standard-library projects. |
| D6 | **v1 ships two profiles:** Inform 6 Standard Library (default) and PunyInform. | Covers the author's standard-library work plus small/fast Z-machine experiments. |
| D7 | **Auto-import** = profile's `.h` files preloaded into the Emscripten virtual FS on the include path at compile time. | Source compiles without the user managing include paths. |
| D8 | **Compiler options panel** with profile defaults pre-filled + free-text switch override. | Sensible defaults, full escape hatch for exotic `$`-settings and switches. |
| D9 | **Play via Parchment**, and the *same* Parchment runtime powers the exported bundle. | "What you test is what you ship." |
| D10 | **`.inf` file is canonical source; localStorage is crash-recovery only** — a debounced snapshot of buffer + options, quota-graceful. Options/scripts also use localStorage as their working store, backed up via project `.json`. | The author's real artifact is the `.inf` they save and ship; the browser store is just a swap file against tab crashes. |
| D11 | **Two export artifacts:** raw `.z5`/`.z8` blob, and a single-file self-contained Parchment HTML bundle (offline-playable). | Author keeps the story file; non-technical players double-click an `.html`. |
| D12 | **Test scripts = command lists** run through the headless replay primitive → Transcript. Flat runner first; branching Skein + blessed-output diffing later, from the same primitive. | The author's real need (run a long script, watch it play) is the Skein's linear spine. |
| D13 | **CodeMirror 6 I6 syntax mode**, keyword set sourced from the active profile. | No polished official CM6 I6 mode exists; the grammar is small enough to write one. |
| D14 | **Repo conventions matched to the author's house style:** `app/`-rooted Nuxt 4, Yarn, Nuxt UI 4, composables-not-Pinia, portable `app/modules/inform6/`, axe-core a11y gate, JSDoc, Markdown-only design docs. | Consistency with the author's house style and CI gates. |
| D15 | **Dark mode by default**, with an accessible, persisted light/dark toggle; **fully responsive** (mobile → desktop) and **WCAG 2.1 AA** behind an axe-core zero-violation gate. | The author's preference; accessibility and responsiveness are non-negotiable house standards. |
| D16 | **Inform 6 extension catalog.** A browsable, curated catalog of I6 library extensions (`.h` contributions); link out to each one's source and pull one or more into a project's include set on demand. Bundled & pinned (offline), with a local `.h` import escape hatch; remote registry deferred. | The author occasionally needs community extensions; reuses Phase 2 auto-import so it's cheap, and stays offline/static. |

## 5. The compile→play→test loop (the whole product in one diagram)

```
            ┌────────────────────────────────────────────────┐
            │  LEFT PANE: CodeMirror 6 source editor          │
            │  (I6 highlighting, localStorage autosave)       │
            └───────────────┬────────────────────────────────┘
                            │  Compile (active profile + options)
                            ▼
        ┌───────────────────────────────────────────┐
        │  inform6.wasm  (single-threaded)           │
        │  • profile .h files preloaded in MEMFS     │
        │  • switches from options panel             │
        │  • emits .z5/.z8 (or .ulx if -G)           │
        │  • stderr → parsed errors/warnings         │
        └───────────────┬───────────────────────────┘
              success    │    errors
        ┌────────────────┘    └──────────────┐
        ▼                                     ▼
  RIGHT PANE: Play tab               RIGHT PANE: Results tab
  Parchment runs story file         clickable "line N: Error"
  via StoryEngine                   rows → jump left pane
        │
        │  Run test script
        ▼
  RIGHT PANE: Transcript tab
  headless replay of command list → transcript
  (later: Skein node = path from root; blessed-output diff)
```

## 6. What v1 is **not**

- Not an Inform 7 IDE. No natural-language layer, no I7 Index, no semantic problem messages.
- Not a multi-file project manager in v1 (single source buffer + profile library; `Include`-able user files is a stretch goal noted in Doc 10).
- Not a server-backed collaboration tool. No accounts, no cloud sync. localStorage + file export only.
- Not a debugger with breakpoints. The test-script transcript + I6 `-D` debug verbs are the debugging surface.
- Not a Glulx authoring path in v1. The `StoryEngine` seam is built so Glulx can be added later, but only the Z-machine engine ships — the author targets Z-machine exclusively.

## 7. Success criteria (personal-first)

1. Paste a standard-library `.inf`, hit Compile, get a clean `.z8` and an inline-playable game in under ~3 seconds on a warm WASM cache.
2. Introduce a syntax error → a clickable Results row jumps the cursor to the offending line.
3. Save a 40-command test script, run it, read the transcript, spot a regression by eye.
4. Export a single `.html` bundle, email it to someone with no IF tooling, they double-click and play.
5. Switch a project to PunyInform → different includes, different default Z-version, different highlight keywords, still one-click compile.

## 8. Document map (the 13-document suite)

| Doc | Title | Purpose |
|-----|-------|---------|
| 00 | Master Design | This document. |
| 01 | Phase 1 — Compiler core & editor shell | WASM compile, two-pane shell, I6 highlighting, autosave. |
| 02 | Phase 2 — Library profiles & auto-import | Standard Library + PunyInform profiles, options panel. |
| 03 | Phase 3 — Play via Parchment & StoryEngine | Inline play, Z-machine + Glulx engines behind one interface. |
| 04 | Phase 4 — Test scripts & headless replay | Flat command-script runner → Transcript. |
| 05 | Phase 5 — Export & playable bundles | Raw `.z*` + single-file Parchment HTML. |
| 06 | Security | Sandboxing untrusted story files, XSS, WASM, export hygiene. |
| 07 | LLM Build Prompt | Self-contained per-phase build prompts fed to Claude. |
| 08 | Differentiation | Why Frotzsmith vs. existing tools. |
| 09 | Monorepo / Website | Repo layout, deployment, docs site. |
| 10 | Revision / Gap Analysis | Known gaps, stretch goals, open questions. |
| 11 | Architecture Decisions | ADR log incl. the `StoryEngine` seam and profile model. |
| 12 | Use Cases | Concrete walkthroughs of real author workflows. |

## 9. Naming

The project is named **Frotzsmith** — "a smith of Frotz-things," fitting a tool that forges and plays Z-machine games. Name availability was checked: no existing project, npm package, GitHub/GitLab repo, or IF-archive tool uses "Frotzsmith" (searches as of June 2026 returned only the unrelated **Frotz** interpreter family and unrelated "Fritz Smith" results).

One deliberate note: the name leans on **Frotz**, the well-established GPL Z-machine interpreter (and on "frotz," older Infocom/MIT hacker slang that no one owns). This is intentional homage and reads as clearly distinct, with no namespace or trademark collision for a personal open-source tool. If full independence from the Frotz lineage were ever wanted, that's the only consideration — otherwise the name stands.

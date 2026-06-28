# Frotzsmith — Repo Layout, Deployment & Docs Site

**Document 09 of 13 · Monorepo / Website**

Frotzsmith is a single Nuxt 4 app (not a monorepo — there's no separate backend or CLI sibling to warrant one), deployed static on Netlify, following the author's established Nuxt project structure.

---

## 1. Repository

Single repo: `frotzsmith`. **Not** a pnpm monorepo — this project has no server package, no CLI sibling. Yarn, single `package.json`, mirroring the markdown editor exactly.

> Contrast with the author's monorepo projects (ForgeCrawl, StrapiShift): those have `packages/app` + `packages/web` because they ship a backend/CLI. Frotzsmith is pure client-side, so a single-app repo is correct. Flag for the author: if a future "shared I6 library bundle" package emerges to feed multiple tools, *then* consider extracting `app/modules/inform6/` into a publishable `inform6-web` package (npm, author's own scope) — noted in Doc 10.

## 2. Project structure

```
frotzsmith/
├── app/
│   ├── components/
│   │   └── ide/
│   │       ├── IdeLayout.vue
│   │       ├── IdeToolbar.vue
│   │       ├── SourcePane.vue
│   │       ├── ResultsPanel.vue
│   │       ├── RightPaneTabs.vue
│   │       ├── PlayPanel.vue
│   │       ├── TranscriptPanel.vue
│   │       ├── OptionsPanel.vue
│   │       ├── ExtensionsPanel.vue
│   │       └── ExportMenu.vue
│   ├── composables/
│   │   ├── useCompilerWasm.ts
│   │   ├── useCompiler.ts
│   │   ├── useSourceDocument.ts
│   │   ├── useIdeLayout.ts
│   │   ├── useProfiles.ts
│   │   ├── useCompilerOptions.ts
│   │   ├── useProject.ts
│   │   ├── useExtensions.ts
│   │   ├── usePlay.ts
│   │   ├── useReplay.ts
│   │   ├── useTestScripts.ts
│   │   ├── useTranscript.ts
│   │   ├── useExport.ts
│   │   └── useProjectTransfer.ts
│   ├── modules/
│   │   └── inform6/                  # portable, self-contained (like the tour module)
│   │       ├── README.md             # incl. Emscripten build command for inform6.wasm
│   │       ├── index.ts
│   │       ├── wasm/
│   │       │   ├── inform6.mjs
│   │       │   ├── inform6.wasm
│   │       │   └── README.md         # exact build invocation, pinned source rev
│   │       ├── lib/
│   │       │   ├── std/              # standard library .h files (pinned)
│   │       │   └── puny/             # PunyInform .h files (pinned)
│   │       ├── editor/
│   │       │   ├── i6-language.ts    # CM6 StreamLanguage mode
│   │       │   └── i6-theme.ts
│   │       ├── engine/
│   │       │   ├── StoryEngine.ts
│   │       │   ├── ZmachineEngine.ts
│   │       │   ├── GlulxEngine.ts        # deferred stub — throws (ADR-002)
│   │       │   └── normalizeTurnOutput.ts
│   │       ├── parchment/            # pinned Parchment runtime for play + bundle export
│   │       ├── profiles/
│   │       │   ├── std.ts
│   │       │   └── puny.ts
│   │       └── extensions/           # curated, pinned I6 extension catalog (.h + metadata)
│   ├── pages/
│   │   └── index.vue
│   └── utils/
│       ├── parse-diagnostics.ts      # I6 stderr → Diagnostic[]
│       ├── parse-script.ts           # lenient command-list parser
│       └── sanitize-filename.ts      # reused from markdown editor
├── docs/                              # this 13-doc suite (Markdown)
├── public/
│   └── og-image.png
├── tests/
│   ├── unit/                         # vitest: diagnostics parser, script parser, switch computation
│   └── a11y/                         # axe-core + Playwright
├── netlify.toml
├── nuxt.config.ts
├── app.config.ts
├── package.json
└── README.md
```

## 3. The `app/modules/inform6/` module (portable by design)

Like the markdown editor's `app/modules/tour/`, the entire I6 toolchain lives in one self-contained folder: WASM compiler, library bundles, editor mode, engines, Parchment runtime, profiles. This makes it copyable into another Nuxt project and is the natural seam if it's ever extracted into a published npm package.

## 4. Deployment

- **Netlify static** via `yarn generate` (`nuxt generate` with `ssr: false`) → **`.output/public`** (the Nuxt 4 output path — `dist` was Nuxt 2).
- **SSR not required** — the app is a client-side tool; static generation is correct, and it keeps the offline/deploy-anywhere promise.
- `netlify.toml`: build command `yarn generate`, **publish `.output/public`**, plus CSP headers (Doc 06 §9). **No COOP/COEP** needed (single-threaded WASM) — preserving "deploy anywhere static."
- **Domain & repo:** `frotzsmith.com` is registered; source lives at `github.com/cschweda/frotzsmith`. POC topology: serve the proof-of-concept directly at the apex `frotzsmith.com`. Intended production topology: apex `frotzsmith.com` as a landing/about page, with the IDE itself at **`app.frotzsmith.com`** once it's past POC. The split (marketing apex / `app.` subdomain for the tool) is noted now so the eventual move doesn't require rearchitecting; for the POC, everything lives at the apex.

## 5. WASM asset handling

- `inform6.wasm` and the Parchment runtime are a few MB; configure Nuxt/Nitro to serve them with long-cache headers and to **lazy-load** (dynamic import) so they don't bloat first paint. The compiler loads on first Compile, not on page load.
- `nuxt.config.ts`: ensure `.wasm` is treated as an asset (not parsed), and that the module is excluded from SSR bundling (client-only).

## 6. Docs site

Reuse the markdown editor's documentation conventions: a `docs/` folder (this suite), plus a README with badges (Nuxt 4, TypeScript, WCAG 2.1 AA, Netlify status, MIT), a live-demo link, a feature list, a tech-stack table, getting-started, and a project-structure section. Optionally a `/docs` route rendering the Markdown (the author already has a markdown rendering stack to lean on).

## 7. Tooling parity with the markdown editor

- `.nvmrc` (Node 22), `packageManager: yarn@1.22.x` (Corepack-pinned), `vitest.config.ts`, `tsconfig.json`, JSDoc throughout, axe-core gate in CI, CHANGELOG.md, MIT LICENSE (© 2026 Christopher Schweda).
- **Pinned versions:** Nuxt **4.4.8**, `@nuxt/ui` **4.9.0** (latest as of June 2026).
- **Third-party attribution:** the bundled `inform6` compiler and standard library ship under the **Artistic License 2.0** (PunyInform under its own license); include their `LICENSE`/attribution files alongside the app's MIT license.

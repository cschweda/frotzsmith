# Frotzsmith

> A personal, browser-based IDE for **Inform 6** — write source, compile to a Z-machine story file entirely client-side, play it inline, and run long test scripts against it. No backend, no accounts, offline-capable.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Nuxt](https://img.shields.io/badge/Nuxt-4-00DC82.svg)](https://nuxt.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)](https://www.typescriptlang.org)
[![WCAG 2.1 AA](https://img.shields.io/badge/a11y-WCAG%202.1%20AA-success.svg)](https://www.w3.org/WAI/WCAG21/quickref/)
[![Status](https://img.shields.io/badge/status-design%20stage-orange.svg)](./docs/00-master-design.md)

> **Status — design stage.** This repository currently holds the design & specification suite in [`docs/`](./docs). Implementation has not started; nothing here runs yet. The docs are the source of truth for what Frotzsmith will be.

## What it is

Frotzsmith mirrors the working rhythm of the classic Inform 7 IDE — source on the left, compile, watch results appear on the right where a successful build becomes a live, playable game — but for **Inform 6**, not Inform 7. It compiles entirely in the browser (the `inform6` compiler built to WebAssembly), auto-imports the correct standard library so a plain `.inf` "just works," plays the compiled story inline with [Parchment](https://github.com/curiousdannii/parchment), and exports both the raw `.z8` story file and a self-contained, offline-playable HTML bundle.

A power-user testing layer runs arbitrarily long command scripts (`n. examine rock. lift rock.`) through a headless replay engine and shows the transcript — the linear spine from which a full branching Skein with blessed-output regression diffing later grows.

## Why

Inform 6 is the author's favourite IF language, but browser tooling is fragmented: interpreters play *finished* story files, and the Inform 7 IDE is a desktop app tied to I7's natural-language layer. There is no clean, modern, browser-native place to **write I6, compile it, and immediately play it** with library auto-import and saved test scripts. Frotzsmith fills that gap — primarily for the author's own use, secondarily as a shareable open-source tool.

[Borogove](https://borogove.app) is the nearest neighbour and is excellent; Frotzsmith is narrower by design — Inform 6 only, profile-driven, fully static/offline, account-free, with a closer Inform 7-IDE feel and a script→Skein testing spine.

## The loop

```
write I6  ──▶  compile (inform6.wasm, client-side)  ──▶  play inline (Parchment)
   ▲                       │                                      │
   └─ clickable errors ────┘                                      └─▶ run test script ──▶ transcript
      jump to the bad line
```

## Tech stack

| Area | Choice |
|------|--------|
| Framework | Nuxt 4 (static, `ssr: false`) |
| UI | Nuxt UI 4 |
| Editor | CodeMirror 6 (custom Inform 6 mode) |
| Compiler | `inform6` → WebAssembly (Emscripten, single-threaded) |
| Interpreter | Parchment / ZVM (Z-machine) |
| Language | TypeScript |
| State | Vue composables (no Pinia) |
| Theme | Dark by default, accessible light/dark toggle |
| Accessibility | WCAG 2.1 AA, axe-core zero-violation gate, fully responsive |
| Package manager | Yarn 1.22 |
| Runtime | Node 22 |
| Hosting | Netlify (static, `.output/public`) |

## Roadmap

| Phase | Deliverable |
|-------|-------------|
| 1 | Compiler core & two-pane editor shell — client-side compile, clickable errors, autosave |
| 2 | Library profiles & auto-import — Standard Library + PunyInform |
| 3 | Inline play via Parchment behind a `StoryEngine` seam |
| 4 | Test scripts & headless replay → Transcript |
| 5 | Export — raw story file + offline-playable HTML bundle |
| later | Full branching Skein with blessed-output regression diffing |

## Documentation

The complete design suite lives in [`docs/`](./docs):

- [`00-master-design.md`](./docs/00-master-design.md) — thesis, locked decisions, success criteria
- `01`–`05` — phase specs (compiler core → export bundles)
- [`06-security.md`](./docs/06-security.md) · [`07-llm-build-prompts.md`](./docs/07-llm-build-prompts.md) · [`08-differentiation.md`](./docs/08-differentiation.md)
- [`09-monorepo-website.md`](./docs/09-monorepo-website.md) · [`10-revision-gap-analysis.md`](./docs/10-revision-gap-analysis.md)
- [`11-architecture-decisions.md`](./docs/11-architecture-decisions.md) — the ADR log
- [`12-use-cases.md`](./docs/12-use-cases.md) — concrete author workflows

## Development

> Prerequisites once implementation begins: **Node 22** (see `.nvmrc`) and **Yarn 1.22**.

```bash
yarn install
yarn dev        # local dev server
yarn generate   # static build → .output/public
yarn preview    # preview the static build
```

These scripts will exist once Phase 1 lands; the repository is spec-only today.

## License & attribution

Frotzsmith is licensed under the [MIT License](./LICENSE) — © 2026 Christopher Schweda.

Bundled third-party components keep their own licenses:

- **Inform 6 compiler** and **standard library** — Artistic License 2.0 ([DavidKinder/Inform6](https://github.com/DavidKinder/Inform6))
- **PunyInform** — its own license
- **Parchment** / **ZVM** — their own licenses

A personal, weekend project — unaffiliated with any employer or organization.

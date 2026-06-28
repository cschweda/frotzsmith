# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

> Design stage — no released software yet.

### Added
- Design & specification suite: the 13-document set in `docs/` (master design,
  five phase specs, security, LLM build prompts, differentiation,
  repo/deployment, gap analysis, architecture decisions, use cases).
- Repository scaffolding: `LICENSE` (MIT), `README.md`, `.gitignore`,
  `.nvmrc` (Node 22), and this changelog.
- Inline Play: a clean compile runs in-browser in the right pane via the bundled
  Parchment interpreter (pure-JS ZVM engine; MIT). The compiled story is passed
  to the player iframe as a blob URL tagged with its version — fully client-side,
  no server round-trip. Attribution in `public/play/web/README.md`.

### Decided (see `docs/11-architecture-decisions.md`)
- Client-side `inform6` → WebAssembly compilation. Feasibility verified against
  Borogove (compiles I6 client-side in production) and upstream
  DavidKinder/Inform6 v6.44 (Artistic License 2.0). — ADR-001
- Z-machine only in v1; the `StoryEngine` seam + `createEngine` factory ship so
  Glulx can be added later without a refactor. The author does not use Glulx. — ADR-002
- The `.inf` file is the canonical source; localStorage is crash-recovery only,
  with options/scripts as its working store and a project `.json` backup. — ADR-010
- Static deployment via `nuxt generate` (`ssr: false`) to `.output/public`. — ADR-011
- Inform 6 extension catalog: bundled/pinned + local `.h` import (offline);
  remote registry deferred. — ADR-012
- Dark mode by default with an accessible light/dark toggle; WCAG 2.1 AA,
  axe-core zero-violation gate, fully responsive.

[Unreleased]: https://github.com/cschweda/frotzsmith

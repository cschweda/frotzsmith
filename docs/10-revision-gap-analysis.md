# Frotzsmith — Revision & Gap Analysis

**Document 10 of 13 · Revision / Gap Analysis**

Known gaps, deferred features, stretch goals, and open questions. The headline deferred item is the **full branching Skein** — designed-for from day one, built later.

---

## 1. The full Skein (headline stretch goal)

v1 ships the **linear spine**: a script is a command list, run via `replay()` → transcript (Phase 4). The full I7-style Skein is deferred but **architecturally pre-paid**.

### 1.1 What the full Skein adds

- **Branching tree.** Each node is a command; each root-to-node path is a playthrough. Siblings represent alternative commands at the same game state.
- **Blessed output + regression diffing.** "Bless" a node's output as correct; after a recompile, re-run and **diff** current vs blessed, flagging changed nodes red/green. This is the regression-testing payoff.
- **Knot/thread navigation** like the I7 Skein: collapse/expand, label threads, jump to a node and "Play from here."

### 1.2 Why it drops in without a refactor

Every Skein operation is **`replay()` along a path from root** — the exact primitive built in Phase 4, already VM-agnostic and using the shared `normalizeTurnOutput` (so blessed text is engine-portable; no false regressions between Z-machine and Glulx). The data model is a tree of command nodes + optional blessed output per node:

```ts
interface SkeinNode {
  id: string;
  command: string;
  parentId: string | null;
  blessedOutput?: string;     // normalized
  lastOutput?: string;        // from most recent run
  status?: 'unblessed' | 'match' | 'diff';
}
```

Running a node = `replay(story, target, pathCommands(nodeId))`; diff = compare `lastOutput` vs `blessedOutput`. Persistence: per-project Skein record in **IndexedDB** (the tree can outgrow localStorage), with `.skein` JSON export — autosave-to-IndexedDB + explicit file export, mirroring the project-transfer duality.

### 1.3 `snapshot()`/`restore()` optimization (already in the interface)

`StoryEngine` exposes `snapshot()`/`restore()` precisely so the Skein can **fast-forward** to a shared ancestor state instead of replaying from root every time — a performance win for deep trees. The hooks exist in v1; the Skein uses them later.

> Estimated as its own phase (call it Phase 6) with a ~13-doc-style sub-spec when the author's ready. It's the natural "v2 headline."

## 2. Deferred / stretch features

| Item | Why deferred | Notes |
|------|--------------|-------|
| Multi-file projects (user `Include` files) | v1 is single-buffer + profile library | Add a virtual file tree in MEMFS; `Include "myfile"` resolves against user files. Project export becomes a `.zip`. |
| Glulx engine (`GlulxEngine`) | Author has never used Glulx (ADR-002) | Seam + `createEngine` factory already in v1; implement `GlulxEngine` (Quixe/Emglken) behind the existing interface + a Glulx-aware bundle builder. No refactor. |
| Remote extension registry | v1 catalog is bundled/offline (ADR-012) | Fetch I6 extensions from the IF Archive on demand; needs a CSP `connect-src` relaxation + a hosted manifest. Local `.h` import covers off-catalog needs meanwhile. |
| Extension-aware highlighting | StreamLanguage uses profile keywords | Merge pulled-in extensions' identifiers into the CM6 keyword set so they highlight. |
| Multiple projects / project switcher | v1 = one active project | localStorage keying already namespaced; add a project index. |
| PunyInform config-constant UI | Those are I6-source `Constant`s, not switches | A guided panel that inserts/edits the pre-include config constants PunyInform expects. |
| Full Lezer grammar for I6 | StreamLanguage covers highlighting | Lezer enables folding, structural selection, better error recovery in the editor. |
| "Restart vs resume" on recompile | v1 always fresh-boots | Offer to preserve a save across recompiles. |
| Debug verbs / `-D` integration surfacing | I6 has infix/debug | Surface `-D`/`-X` debugging affordances in the UI. |
| Web Worker for the **compiler** (not just replay) | v1 may compile on main thread | If large games block the UI, move compile to a worker with the same timeout pattern as replay. |
| Extract `inform6-web` npm package | Only if reused by another tool | The `app/modules/inform6/` folder is already shaped for this. |
| `/docs` in-app route | README + `docs/` suffices for v1 | Render the Markdown suite in-app later. |

## 3. Open questions

Most of these are now resolved (kept as a decision record); only PunyInform versioning remains genuinely open.

1. **Status-line text in diffs — RESOLVED.** Excluded from diffable output by default, with a per-script opt-in toggle (ADR-006). Status lines churn every turn → false regressions.
2. **Web Worker use — RESOLVED.** Both replay *and* compile run in a Web Worker, because a main-thread synchronous compile/replay can't be aborted by a timeout (Doc 01 §2.2, Doc 06). Message-passing only, so still no COOP/COEP.
3. **PunyInform library versioning (open).** Pin a specific PunyInform release; who/when bumps it? *Recommendation: pin in `lib/puny/`, document the rev, bump deliberately.*
4. **Glulx — RESOLVED (cut from v1).** The author has never used Glulx, so v1 ships the `StoryEngine` seam + `createEngine` factory but only `ZmachineEngine`; `GlulxEngine` is a deferred stub (ADR-002). Adding it later needs no refactor.

## 4. Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Emscripten build of `inform6` is fiddly | Low–Medium | Proven in production: Borogove compiles I6 client-side; upstream is clean portable C (DavidKinder/Inform6 v6.44, Artistic 2.0). Build single-threaded per Doc 01 §2, re-instantiate per compile, document the invocation. Still Phase 1's first task, but no longer a research unknown. |
| Output normalization mismatch causes false regressions | Medium | Single shared `normalizeTurnOutput` used by both engines; lock its behavior with unit tests before the Skein. |
| WASM/runtime asset weight hurts first load | Low | Lazy-load on first compile; long-cache headers; not on critical path. |
| PunyInform/std confusion (incompatible source) | Low | Profile model + explicit switch-warning; starter templates encode correct boilerplate. |
| Large bundle `.html` size (base64 + Glulx runtime) | Low | Acceptable within browser limits; pick runtime by target; documented. |

## 5. Explicitly out of scope (v1 and likely beyond)

- Inform 7 support of any kind.
- Cloud sync, accounts, collaboration.
- A graphical/map editor.
- TADS, Dialog, or other IF languages (Borogove's territory).

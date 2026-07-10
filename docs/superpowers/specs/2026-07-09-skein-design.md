# The Skein — Design (v1: real tree, outline UI, auto-run)

**Date:** 2026-07-09
**Status:** Approved — implementation follows immediately
**Decisions locked with author:** real tree data model with a lean collapsible
outline (no drawn graph in v1) · auto-rerun blessed threads on successful
compile (toggleable) · IndexedDB persistence + `.skein` export (per Doc 10)

## Goal

The v2 headline from Doc 10 §1: a branching tree of commands where each
root-to-node path is a playthrough, with **blessed-output regression
diffing** — bless a node's output as correct; after a recompile the tree
re-runs and flags every divergence red. The existing linear test scripts and
the play transcript are the spine it grows from.

## What already exists (and is reused unchanged)

- `replay()` through the `StoryEngine` seam in a Web Worker — fresh engine per
  run, wall-clock budget, cancel (ADR-002/D4/D12).
- `normalizeTurnOutput`, unit-locked, so blessed text is VM-agnostic and
  diff-stable (Doc 10 §4 risk table demanded exactly this before the Skein).
- `TurnRecord { command, output, status? }` with the boot banner as turn 0 —
  aligns one-to-one with a skein path.
- Per-game keying: `stateKey` (language) + `activeStoryKey` (game bucket), the
  same scheme test scripts use.
- Live-play command capture (postMessage, pinned origin/source) and
  Send-to-Play for "Play to here".

## Data model — `app/composables/skein-tree.ts` (pure, sibling-tested)

```ts
type SkeinStatus = 'unblessed' | 'match' | 'diff' | 'stale' | 'error'
interface SkeinNode {
  id: string            // random
  command: string
  parentId: string | null
  childIds: string[]    // sibling order = creation order
  blessedOutput?: string // normalized turn output
  lastOutput?: string    // from the most recent run
  status: SkeinStatus
}
interface SkeinTree {
  root: string          // synthetic root node; command '' = boot banner
  nodes: Record<string, SkeinNode>
}
```

Pure operations (no Vue, no storage, no engine):

- `createTree()` — synthetic root representing the boot banner (command `''`).
- `addPath(tree, commands[]) → { tree, leafId }` — walks from root; an
  existing child with the same command is reused (dedupe → branching happens
  exactly where commands diverge; siblings are alternatives, I7 semantics).
- `pathCommands(tree, nodeId)` — root→node command list (excludes the root's
  empty command; feeds `replay()` and Send-to-Play directly).
- `applyRun(tree, nodeId, turns: TurnRecord[])` — writes `lastOutput` down the
  path (turn 0 → root, turn i → path node i) and recomputes statuses:
  blessed+equal → `match`, blessed+different → `diff`, else `unblessed`. A
  short run (VM quit early) marks unreached blessed nodes `error`.
- `blessThread(tree, nodeId)` — for every node on the root path with a
  `lastOutput`, copy it to `blessedOutput`, status → `match`.
- `unblessSubtree`, `removeSubtree`, `markAllStale` (blessed nodes → `stale`),
  `blessedLeaves(tree)` — the run-set for auto-rerun (deepest blessed node of
  each blessed path; covers ancestors for free).

Diffing is exact string equality of normalized outputs. The visual diff uses a
small pure LCS line-diff (`app/utils/line-diff.ts`, tested) — presentation
only; equality is what decides status.

## Sources of tree structure

1. **Import the active test script as a thread** — one button;
   `addPath(parseScript(text))`. The linear spine, literally.
2. **Live play extends the tree** — each captured play command extends a
   cursor path from root (session starts at root on every fresh Play boot,
   matching the game actually restarting). Branching happens the first time a
   different command is tried at the same point.

Outputs NEVER come from play capture — only from headless reruns — so blessed
text stays normalized and deterministic.

## Runs and the compile hook — `useSkein()`

- `runToNode(nodeId)`: `replay(story, pathCommands(nodeId))` in the worker →
  `applyRun`. Sequential queue for batches; progress + cancel reuse the
  replay patterns.
- On a successful compile (watch on the shared compile result, the useMap
  pattern): `markAllStale()`, then — if the persisted **auto-run** toggle is
  on (default on) — run `blessedLeaves()` sequentially; statuses resolve
  green/red as results stream in. Toggle off → the header shows **Run stale**.
- No `snapshot()/restore()` fast-forward in v1: every run replays from root
  (Doc 10 reserves the hooks; tree sizes make this a non-issue for now).

## UI — `SkeinPanel.vue`, a new `skein` right-pane tab

Collapsible outline in the file-explorer idiom, real `role="tree"` /
`treeitem` / `aria-expanded` semantics with keyboard navigation (the axe CI
gate applies):

- Row = status dot (grey unblessed · green match · red diff · amber stale ·
  ring error) + command text; expand/collapse children.
- Node actions: **Bless to here**, **Run to here**, **Play to here** (path →
  existing Send-to-Play), **Add command** (inline input → child), **Delete
  branch**.
- Selecting a `diff` node shows blessed vs current output as a line diff.
- Header: Run stale / Run all, auto-run toggle, Import script, Export /
  Import `.skein`, per-game node count. Empty state explains the two feeds.
- The drawn I7-style graph is a later skin over the same model (explicitly
  out of v1).

## Persistence — IndexedDB + `.skein` export (Doc 10's call, honored)

Blessed outputs × nodes is exactly what outgrows the 5–10 MB origin
localStorage quota this project just fenced. Storage goes behind a seam:

- `SkeinStore { load(key), save(key, tree) }`; key = `${stateKey}:${storyKey}`.
- IDB impl: one `skeins` object store in a `frotzsmith` database via a ~60-line
  promise wrapper (`app/utils/idb-kv.ts`, no dependency). Debounced autosave
  on mutation; failures surface through the existing storage-notice toast.
- In-memory impl for unit tests; the IDB impl itself tested with
  `fake-indexeddb` (devDependency).
- `.skein` file = pretty JSON of `SkeinTree` (+ `{v, lang, storyKey}` header);
  export/import buttons. Export is the canonical backup, mirroring the
  ".inf is canonical, browser storage is a swap file" doctrine (D10).

## Correction of record

The language-profile seam consolidation (scattered `profile.id === 'zil'`
branches) is **not** a Skein prerequisite — the Skein consumes only
`activeStoryKey`, compile results, and the replay seam. That cleanup remains
on the backlog for Glulx/third-language work.

## Testing

- `skein-tree.test.ts`: addPath dedupe/branching, pathCommands, applyRun
  alignment (banner as turn 0), bless/unbless, stale transitions, short-run
  `error` marking, blessedLeaves selection.
- `line-diff.test.ts`: equal/insert/delete/replace hunks.
- `useSkein.nuxt.test.ts`: compile-result watch → stale → auto-run via a
  stubbed replay; toggle off → no auto-run; play-capture feed extends the
  cursor path; per-game bucket switching.
- `idb-kv.test.ts` with fake-indexeddb; store round-trip.
- Suite + typecheck + generate + axe gate in CI as usual; browser smoke:
  import script → bless → break the game in source → recompile → watch red.

## Out of scope (v1)

Drawn graph, snapshot fast-forward, thread labels, mid-state replays,
`.skein` merge semantics (import replaces the current game's tree after a
confirm), Skein-aware CI.

Estimate: 2–4 focused days, TDD throughout.

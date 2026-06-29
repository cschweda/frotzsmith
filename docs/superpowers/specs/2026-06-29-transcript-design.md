# Frotzsmith — Test Scripts & Transcript (Phase 4), atop the headless StoryEngine seam (Phase 3 completion)

**Date:** 2026-06-29
**Status:** Design approved; implementation pending plan
**Builds on:** [`docs/03-phase-3-play-parchment.md`](../../03-phase-3-play-parchment.md), [`docs/04-phase-4-test-scripts.md`](../../04-phase-4-test-scripts.md), ADR-002 / 003 / 006 / 007 / 008 / 010 / 011.

## 1. Context & problem

Interactive Play shipped, but via a Parchment `<iframe>` (`PlayPanel.vue` → `/play/index.html?story=<blobUrl>`). The Phase 3 `StoryEngine` seam (ADR-002) — `createEngine`, `ZmachineEngine`, `normalizeTurnOutput` — was **never built**, so the app has no programmatic handle on the VM. The Transcript tab is a stub.

The author's daily need (doc 04) is to paste a long command list, run it, and read the per-command playthrough as a **transcript**. That requires a headless `replay(story, commands) → TurnRecord[]`, which requires the engine seam. So this work **finishes Phase 3** (headless engine) and **delivers Phase 4** (scripts + transcript).

## 2. Decisions (locked)

- **D1 — Real `StoryEngine` seam, not iframe-scraping.** Add the `ifvms` package (the pure-JS ZVM Parchment already uses); build `ZmachineEngine` + a headless Glk shim + `normalizeTurnOutput` behind `createEngine`. Honors ADR-002/006/007; the future Skein reuses `replay()` unchanged. Interactive Play (the iframe) is left untouched.
- **D2 — Replay runs in a Web Worker (ADR-003).** A wall-clock timeout or user cancel calls `worker.terminate()` to kill a runaway game — impossible to abort on a synchronous main-thread loop.
- **D3 — Core scope.** Lenient script parser, named-script CRUD + persistence, headless run, transcript render, run/cancel + elapsed/live status. **Defer** Send-to-Play and blessed/diff (Phase 6). Glulx stays a stub (ADR-002).

## 3. Architecture

### 3.1 Engine seam (Phase 3, pure JS, no DOM) — `app/modules/inform6/engine/`

**`StoryEngine.ts`** — interface + factory (ADR-002):

```ts
export type EngineTarget = 'zmachine' | 'glulx'
export interface EngineState { /* opaque VM snapshot (Quetzal bytes); declared, unused in v1 */ }
export interface TurnRecord { command: string; output: string; status?: string }
export interface StoryEngine {
  readonly target: EngineTarget
  boot(story: Uint8Array): Promise<string>   // load + run to first input; returns turn-0 (banner) text
  send(command: string): Promise<TurnRecord> // one turn → normalized output
  snapshot(): EngineState                     // declared; implementation deferred (Send-to-Play / Skein)
  restore(state: EngineState): void           // declared; implementation deferred
  reset(): Promise<string>                    // re-boot fresh from the same story
}
export function createEngine(target: EngineTarget): StoryEngine
```

Factory: `zmachine → ZmachineEngine`; `glulx → GlulxEngine` (throws).

**`ZmachineEngine.ts`** — wraps the `ifvms` ZVM with a **headless Glk** (no DOM). The Glk:
- captures buffer-window text (the diffable body) and grid/status-window text **separately**,
- on a line-input request, supplies the next queued command and resumes the VM,
- exposes the accumulated text for the current turn.

`boot(story)` runs to the first input request and collects the banner via `normalizeTurnOutput`. `send(cmd)` feeds the command, runs to the next input request, collects the new buffer text → `normalizeTurnOutput(raw, 'zmachine')` → `TurnRecord` (status captured but excluded by default, ADR-006). `snapshot`/`restore` use ZVM's Quetzal save/restore — declared now, built when their consumers land.

**`GlulxEngine.ts`** — every method throws `"Glulx not yet supported"` (ADR-002 seam; the target stays visible, marked "coming later").

**`normalizeTurnOutput.ts`** (ADR-006):

```ts
export function normalizeTurnOutput(
  raw: string, target: EngineTarget, opts?: { includeStatus?: boolean },
): string
```

Canonicalize/strip the trailing command prompt, normalize whitespace/newlines, and **drop status/grid-window text unless `includeStatus`** (status lines churn every turn → false regressions). VM-agnostic signature; only the `zmachine` path is built. Behavior is load-bearing → unit-tested.

**`replayCore.ts`** (pure, **Node-testable** — the heart of the test strategy):

```ts
export interface ReplayResult { turns: TurnRecord[]; ms: number }
export async function runReplay(
  story: Uint8Array, target: EngineTarget, commands: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<ReplayResult>
```

`createEngine(target)` → `boot` (push turn 0) → loop `send` (push each `TurnRecord`, call `onProgress`) → return. No worker, no DOM here, so vitest drives it directly.

**`parseScript.ts`** (pure, doc 04 §2.1):

```ts
export function parseScript(text: string): string[]
```

Split on newlines **and/or** `.`; drop `!`-comment lines and blank lines; strip a leading `> ` (so a pasted transcript round-trips). Length unbounded.

### 3.2 Worker transport — `app/modules/inform6/engine/replay.worker.ts`

Module worker, no DOM. `onmessage({ story, target, commands })` → `runReplay(..., (done,total) => postMessage({type:'progress', done, total}))` → `postMessage({type:'result', turns, ms})`; on throw, `postMessage({type:'error', message})`.

### 3.3 Composables — `app/composables/` (ADR-008)

**`useReplay.ts`** (client-only) — the single `replay()` primitive (ADR-007):

```ts
function replay(
  story: Uint8Array, target: EngineTarget, commands: string[],
  opts?: { onProgress?: (done: number, total: number) => void; timeoutMs?: number },
): { promise: Promise<ReplayResult>; cancel(): void }
```

Spawns **one worker per run** via `new Worker(new URL('../modules/inform6/engine/replay.worker.ts', import.meta.url), { type: 'module' })`. Resolves on `result`, rejects on `error`; `cancel()` and the timeout both `terminate()` and reject with a typed `CancelledError`.

**`useTestScripts.ts`** — `TestScript = { id; name; text }`. CRUD (add / rename / delete / updateText), active-script selection, `localStorage` persistence (`frotzsmith:scripts`), restore + reconcile. Raw `text` is stored so `!` comments round-trip; parsing happens at run time. Singleton state via `useState`; mirrors `useProjectFiles` / `project-files.ts`. (ADR-008/010)

**`useTranscript.ts`** — state `{ turns; running; ms; progress }`. `run(commands)` guards on `canPlay`, sets `activeTab = 'transcript'` (stateful right pane), calls `useReplay.replay`, streams progress, and fills `turns`; `cancel()` aborts.

### 3.4 UI — `app/components/ide/`

**`TranscriptPanel.vue`** replaces the stub:
- **Script bar** — named-script `UDropdownMenu` (select / New / Rename / Delete) + Run/Cancel + elapsed ms + live status.
- **Script editor** — a CodeMirror 6 instance (plain text, light highlight of `!` comments), bound to the active script's `text`.
- **Transcript** — a scrollable region; each `TurnRecord` renders the command (styled like a `>` prompt) then its output (turn 0 has no command).

**Config** — add `scripts: 'frotzsmith:scripts'` to `frotzsmith.config.ts` `storageKeys`; wire `useTestScripts.restore()` into `useIde.restore()`.

## 4. Data flow

Compile (storyFile ready) → edit/pick a script → **Run** → `parseScript(text)` → `useReplay.replay(storyFile, 'zmachine', commands)` → worker boots the ZVM and loops `send` (normalized output, progress streamed) → `TurnRecord[]` back → rendered in the Transcript tab. Cancel/timeout → `terminate()`.

## 5. Error handling

- Run is disabled until `status === 'success'` with a story file (mirror `canPlay`).
- A worker/engine error surfaces as a transcript error banner, not a crash.
- Timeout → "Stopped after N turns (time limit)".
- Glulx target → factory throws (won't reach the UI; play/replay are gated to z-targets).
- `localStorage` quota → graceful try/catch (ADR-010).
- `@random`-driven games differ run-to-run — a documented caveat; seed control / blessed-diff is Phase 6.

## 6. Testing (vitest, Node)

- **`parseScript`** — separators (newline / period / both), `!` comments, blank lines, leading `> `.
- **`normalizeTurnOutput`** — prompt strip, whitespace, status include/exclude toggle.
- **`useTestScripts`** — persistence / restore / reconcile (model on `project-files.test.ts`).
- **Golden engine test** — `runReplay(demo.z5, 'zmachine', [...])`: assert the turn-0 banner contains the demo's title/known room and that a sent command yields expected text. Proves the headless ZVM + Glk works end-to-end in Node, without the worker or a browser.

## 7. Accessibility

Transcript is a labelled, keyboard-focusable scrollable region with proper headings; Run/Cancel are labelled buttons; an `aria-live="polite"` region announces "Running 12 of 40…" / "Done — 40 turns". The script editor inherits the existing CM6 a11y work. axe-core clean (matches the repo baseline).

## 8. Out of scope (v1)

Send-to-Play; blessed transcript + diff (Phase 6); the Glulx engine; multi-project script namespaces; and re-plumbing interactive Play onto the in-app engine — the iframe works, is accessible, and earns nothing by being rebuilt now. In v1 the `StoryEngine` seam is exercised solely by the headless replay worker.

## 9. Risks

- **Vite worker bundling under `nuxt generate`** (static, `ssr: false`) with the `ifvms` import. `new Worker(new URL(...), { type: 'module' })` is the supported Vite idiom, but prove it with a thin spike (boot `demo.z5` in the worker, post one turn back) **before** building the full engine.
- **`ifvms` headless API shape** — the Glk handshake must be confirmed against the package source (the vendored bundle is the older jQuery-Parchment build; the npm `ifvms` ZVM is the clean import). `replayCore`'s golden test de-risks it. Fallback: vendor the relevant `ifvms` source if the npm package is awkward to import for a worker.

## 10. Done = (doc 04 exit criteria)

Write a ~40-command script for a compiled game → **Run** → the Transcript tab fills with the per-command playthrough. Edit the game, recompile, re-run the same script → the transcript reflects the new behavior. Multiple named scripts persist across reloads. Runs are cancellable. All built on a `replay()` primitive the future Skein inherits unchanged.

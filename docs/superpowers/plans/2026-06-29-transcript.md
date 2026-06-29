# Transcript (Phase 4) + headless StoryEngine seam (Phase 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the author paste a long command list, run it through a headless Z-machine, and read the per-command playthrough in the Transcript tab.

**Architecture:** Finish the never-built Phase 3 `StoryEngine` seam as a *headless* engine — the `ifvms` ZVM driven through a custom output-capturing GlkOte over the glkapi (Glk) layer — exposed as a thin `replay()` primitive that runs in a Web Worker (so a runaway game can be `terminate()`d). Interactive Play (the Parchment iframe) is left untouched. The Phase 4 UI (script CRUD + Transcript tab) sits on `replay()`.

**Tech Stack:** Nuxt 4 (client-only, `ssr: false`), Vue 3 `<script setup>`, Nuxt UI 4, TypeScript (strict), Vitest (`node` env), `ifvms` (ZVM) + `glkote-term`'s `Glk` (glkapi), Web Workers (Vite `new Worker(new URL(...))`).

## Global Constraints

- **No SSR.** Every interpreter/worker path is client-only — guard with `import.meta.client`; never import `ifvms`/`glkote-term` into a module that loads during SSR. (ADR-011)
- **House style: composables, not Pinia.** Shared state via module-scoped `useState`. Pure logic lives in a framework-free `.ts` file; the `use*` composable wraps it; tests target the pure file. (ADR-008, mirrors `project-files.ts` / `useProjectFiles.ts` / `project-files.test.ts`)
- **Persistence.** localStorage only, namespaced `frotzsmith:*`, wrapped in try/catch (quota-graceful). The `.inf` is canonical; scripts are working state. (ADR-010)
- **One `replay()` primitive.** Flat runner and the future Skein both call it; keep it minimal and VM-agnostic. (ADR-007)
- **`StoryEngine` seam.** `boot/send/snapshot/restore/reset/target` + `createEngine(target)`; ZVM only, Glulx throws. `snapshot/restore` are declared but their bodies are deferred (no v1 consumer). (ADR-002)
- **Status line excluded by default.** Buffer-window text is the diffable `output`; grid/status-window text is captured separately into `TurnRecord.status` and not shown unless explicitly toggled. (ADR-006)
- **Tests:** `app/**/*.{test,spec}.ts`, `environment: 'node'`. Run `yarn test`. Typecheck with `yarn typecheck` (ignore the pre-existing `vue-router/volar/sfc-route-blocks` plugin warning — it is not a type error).
- **Commits:** no `Co-Authored-By` / AI-attribution trailer (repo rule). Conventional-commit subjects.

**Script editor:** built with CodeMirror 6 (per the spec) — a focused `ScriptEditor.vue` mirroring `SourcePane.vue`'s CM6 setup, with light `!`-comment highlighting via a `StreamLanguage`. Kept as its own component so `TranscriptPanel.vue` stays focused on the script bar + transcript.

---

## File structure

**Engine (`app/modules/inform6/engine/`)** — pure TS, no Vue/Nuxt auto-imports, Node- and worker-safe:
- `StoryEngine.ts` — types (`EngineTarget`, `TurnRecord`, `ReplayResult`, `EngineState`, `StoryEngine`) + `createEngine(target)` factory.
- `glk.ts` — single import seam for the Glk (glkapi) layer (`export { Glk } from 'glkote-term'`), so the source can swap to a vendored file in one place.
- `headless-glkote.ts` — `HeadlessGlkOte`: implements the GlkOte interface, captures buffer/grid text, and exposes a promise-based per-turn loop.
- `headless-dialog.ts` — `HeadlessDialog`: in-memory no-op Dialog stub (no file I/O).
- `ZmachineEngine.ts` — wraps `ifvms` ZVM + `Glk` + `HeadlessGlkOte`; implements `StoryEngine`.
- `GlulxEngine.ts` — stub; every method throws "Glulx not yet supported."
- `normalizeTurnOutput.ts` — VM-agnostic prompt/whitespace normalizer.
- `parseScript.ts` — lenient script-text → `string[]` parser.
- `replayCore.ts` — `runReplay(...)`; the Node-testable heart driven by the golden test.
- `replay.worker.ts` — Web Worker transport around `runReplay`.

**Composables (`app/composables/`)**:
- `test-scripts.ts` — pure CRUD helpers over `TestScript[]`.
- `useTestScripts.ts` — composable: reactive scripts + localStorage.
- `useReplay.ts` — client-only `replay()` primitive over the worker (cancel/timeout).
- `useTranscript.ts` — transcript run/cancel/progress state.

**UI / wiring**:
- `app/components/ide/ScriptEditor.vue` — CodeMirror 6 script editor (new).
- `app/components/ide/TranscriptPanel.vue` — the Transcript tab: script bar + `<ScriptEditor />` + transcript output (new).
- `app/components/ide/RightPaneTabs.vue` — replace the inline stub with `<TranscriptPanel />`.
- `app/composables/useIde.ts` — call `useTestScripts().restore()` in `restore()`.
- `frotzsmith.config.ts` — add `scripts: "frotzsmith:scripts"` storage key.

**Tests**: `engine/replay.golden.test.ts`, `engine/normalizeTurnOutput.test.ts`, `engine/parseScript.test.ts`, `engine/createEngine.test.ts`, `composables/test-scripts.test.ts`, `composables/replay-controller.test.ts`.

**Docs**: `CHANGELOG.md`, `ROADMAP.md`.

---

## Task 1: Headless ZVM engine — boot + send (vertical slice / spike)

This is the riskiest task and de-risks everything: prove the `ifvms` ZVM can be booted headlessly and driven command-by-command in Node (vitest), with output captured. The golden test against the real `demo.z5` is the success oracle. Once green, the rest is conventional.

**Files:**
- Modify: `package.json` (add `ifvms`, `glkote-term`)
- Create: `app/modules/inform6/engine/StoryEngine.ts`
- Create: `app/modules/inform6/engine/glk.ts`
- Create: `app/modules/inform6/engine/headless-dialog.ts`
- Create: `app/modules/inform6/engine/headless-glkote.ts`
- Create: `app/modules/inform6/engine/normalizeTurnOutput.ts` (minimal; hardened in Task 2)
- Create: `app/modules/inform6/engine/ZmachineEngine.ts`
- Create: `app/modules/inform6/engine/replayCore.ts`
- Test: `app/modules/inform6/engine/replay.golden.test.ts`

**Interfaces:**
- Produces:
  - `type EngineTarget = 'zmachine' | 'glulx'`
  - `interface TurnRecord { command: string; output: string; status?: string }`
  - `interface ReplayResult { turns: TurnRecord[]; ms: number }`
  - `interface EngineState { data: Uint8Array }` (opaque; unused in v1)
  - `interface StoryEngine { readonly target: EngineTarget; boot(story: Uint8Array): Promise<string>; send(command: string): Promise<TurnRecord>; snapshot(): EngineState; restore(state: EngineState): void; reset(): Promise<string> }`
  - `class ZmachineEngine implements StoryEngine`
  - `async function runReplay(story: Uint8Array, target: EngineTarget, commands: string[], onProgress?: (done: number, total: number) => void): Promise<ReplayResult>`

- [ ] **Step 1: Install the engine dependencies**

```bash
yarn add ifvms glkote-term
```

Record the resolved versions (printed by yarn, or `yarn why ifvms`) and pin them in `package.json`. Note them in the commit body — later tasks and the worker build depend on these exact versions.

- [ ] **Step 2: Write the failing golden test**

`app/modules/inform6/engine/replay.golden.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runReplay } from './replayCore'

// The bundled demo, compiled from samples/demo.inf:
//   Constant Story "FROTZSMITH DEMO"; Initialise prints a welcome; start room
//   Cottage, north → Meadow. Stable golden text for an end-to-end engine check.
const demo = new Uint8Array(
  readFileSync(fileURLToPath(new URL('../../../../public/play/demo.z5', import.meta.url))),
)

describe('runReplay (headless ZVM, demo.z5)', () => {
  it('captures the boot banner as turn 0', async () => {
    const { turns } = await runReplay(demo, 'zmachine', [])
    expect(turns).toHaveLength(1)
    expect(turns[0]!.command).toBe('')
    expect(turns[0]!.output).toContain('Welcome to the Frotzsmith demo!')
    expect(turns[0]!.output).toContain('Cottage')
  })

  it('advances the world per command', async () => {
    const { turns } = await runReplay(demo, 'zmachine', ['north', 'south'])
    expect(turns).toHaveLength(3) // boot + 2 commands
    expect(turns[1]!.command).toBe('north')
    expect(turns[1]!.output).toContain('Meadow')
    expect(turns[2]!.command).toBe('south')
    expect(turns[2]!.output).toContain('Cottage')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `yarn test app/modules/inform6/engine/replay.golden.test.ts`
Expected: FAIL — cannot resolve `./replayCore` (not created yet).

- [ ] **Step 4: Create the engine types + Glk seam + Dialog stub**

`app/modules/inform6/engine/StoryEngine.ts`:

```ts
export type EngineTarget = 'zmachine' | 'glulx'

export interface TurnRecord {
  /** The input for this turn; '' for the boot banner (turn 0). */
  command: string
  /** Normalized buffer-window text produced after this turn. */
  output: string
  /** Raw grid/status-window text (excluded from `output` by default — ADR-006). */
  status?: string
}

export interface ReplayResult {
  turns: TurnRecord[]
  ms: number
}

/** Opaque VM snapshot. Declared for the seam (ADR-002); unused in v1. */
export interface EngineState {
  data: Uint8Array
}

export interface StoryEngine {
  readonly target: EngineTarget
  /** Load + run to the first input request; returns the boot banner text. */
  boot(story: Uint8Array): Promise<string>
  /** Feed one command; run to the next input request; return its turn record. */
  send(command: string): Promise<TurnRecord>
  /** Capture VM state (deferred body in v1). */
  snapshot(): EngineState
  /** Restore captured state (deferred body in v1). */
  restore(state: EngineState): void
  /** Re-boot fresh from the same story; returns the boot banner. */
  reset(): Promise<string>
}

// createEngine() is added in Task 4 once GlulxEngine exists.
```

`app/modules/inform6/engine/glk.ts`:

```ts
// Single import seam for the Glk (glkapi) layer. Kept here so the source — the
// npm `glkote-term` Glk vs a vendored glkapi.js — can change in one place if the
// worker build (Task 5) needs a browser-only variant.
// @ts-expect-error — glkote-term ships no types.
export { Glk } from 'glkote-term'
```

`app/modules/inform6/engine/headless-dialog.ts`:

```ts
/**
 * Minimal in-memory Dialog. Headless replay performs no real file I/O, so save /
 * restore / `script on` are not honored — the GlkOte answers any fileref prompt
 * with "cancelled", which games tolerate. Enough to satisfy `Glk.init`.
 */
export class HeadlessDialog {
  streaming = false
  // glkapi probes a handful of methods; these no-ops keep it happy. The spike
  // (Step 7) adds any further method glkapi calls (it throws with the name).
  init() {}
  open() {}
  file_clean_fixed_name(filename: string) {
    return filename
  }
  file_construct_ref() {
    return null
  }
  file_ref_exists() {
    return false
  }
  file_remove_ref() {}
  file_write() {}
  file_read() {
    return null
  }
}
```

- [ ] **Step 5: Create the HeadlessGlkOte (output capture + per-turn loop)**

`app/modules/inform6/engine/headless-glkote.ts`:

```ts
/**
 * A GlkOte implementation with no display. glkapi drives it the same way it
 * drives the web/terminal GlkOte: it calls `init(iface)` once (we kick off the
 * VM with an `init` event), then `update(arg)` whenever the VM produces output
 * and/or requests input. We accumulate buffer-window text (the transcript body)
 * and grid-window text (the status line) separately, and resolve one "turn"
 * each time the VM asks for line input — at which point the caller can read the
 * captured text and feed the next command via `sendLine`.
 *
 * The protocol shapes (update.content / update.input / the accept event) follow
 * the GlkOte spec (eblong.com/zarf/glk/glkote/docs.html).
 */
type Accept = (event: unknown) => void

interface Turn {
  buffer: string
  grid: string
  /** false once the VM has exited (quit) rather than asked for more input. */
  wantsLine: boolean
}

export class HeadlessGlkOte {
  private accept: Accept | null = null
  private gen = 0
  private buffer = ''
  private grid = ''
  private lineWindow: number | null = null
  private pending: ((turn: Turn) => void) | null = null
  private exited = false

  // ── GlkOte interface (called by glkapi) ──────────────────────────────────
  init(iface: { accept: Accept }) {
    this.accept = iface.accept
    // Kick the VM off. Metrics are nominal; nothing renders.
    this.accept({
      type: 'init',
      gen: 0,
      support: [],
      metrics: { width: 80, height: 50 },
    })
  }

  update(arg: {
    gen: number
    content?: Array<{ id: number; text?: Array<{ content?: unknown[] }>; lines?: Array<{ content?: unknown[] }> }>
    input?: Array<{ id: number; type: string; gen: number }>
    specialinput?: { type: string }
  }) {
    this.gen = arg.gen
    if (arg.content) this.absorbContent(arg.content)

    // A fileref prompt (save / restore / script) — answer "cancelled".
    if (arg.specialinput) {
      this.accept?.({ type: 'specialresponse', gen: this.gen, response: 'fileref_prompt', value: null })
      return
    }

    const line = arg.input?.find(i => i.type === 'line')
    if (line) {
      this.lineWindow = line.id
      this.resolveTurn(true)
    }
  }

  warning() {}
  log() {}
  error(msg: string) {
    throw new Error(`GlkOte error: ${msg}`)
  }
  exit() {
    this.exited = true
    this.resolveTurn(false)
  }
  // NOTE (spike): run the golden test; if glkapi throws "GlkOte.X is not a
  // function", add a no-op `X()` here. Likely candidates: getlibrary, setlog,
  // set_autosave, getdomid, getinterface, save_allstate.

  // ── Driver API (called by ZmachineEngine) ────────────────────────────────
  /** Resolves at the next line-input request (or VM exit). */
  nextTurn(): Promise<Turn> {
    if (this.exited) return Promise.resolve({ buffer: this.takeBuffer(), grid: this.grid, wantsLine: false })
    return new Promise<Turn>(resolve => {
      this.pending = resolve
    })
  }

  /** Send a command line to the VM; the VM runs until its next update. */
  sendLine(value: string) {
    if (this.lineWindow == null || !this.accept) throw new Error('No line input pending')
    const window = this.lineWindow
    this.lineWindow = null
    this.accept({ type: 'line', gen: this.gen, window, value })
  }

  // ── internals ─────────────────────────────────────────────────────────────
  private resolveTurn(wantsLine: boolean) {
    const turn: Turn = { buffer: this.takeBuffer(), grid: this.grid, wantsLine }
    const p = this.pending
    this.pending = null
    p?.(turn)
  }

  private takeBuffer(): string {
    const b = this.buffer
    this.buffer = ''
    return b
  }

  private absorbContent(content: NonNullable<Parameters<HeadlessGlkOte['update']>[0]['content']>) {
    for (const win of content) {
      // Buffer window: paragraphs in `text[]`, each a run array of {text}.
      if (win.text) {
        for (const para of win.text) this.buffer += runText(para.content) + '\n'
      }
      // Grid window (status line): lines in `lines[]`.
      if (win.lines) {
        this.grid = win.lines.map(l => runText(l.content)).join('\n')
      }
    }
  }
}

/** Flatten a GlkOte line-data array (objects `{text}` or `[style, str, ...]`). */
function runText(runs: unknown[] | undefined): string {
  if (!runs) return ''
  let out = ''
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i]
    if (typeof r === 'object' && r && 'text' in r) out += String((r as { text: unknown }).text ?? '')
    else if (typeof r === 'string') out += r // [style, string, style, string, ...] form: strings are odd indices
  }
  return out
}
```

- [ ] **Step 6: Create the minimal normalizer + ZmachineEngine + runReplay**

`app/modules/inform6/engine/normalizeTurnOutput.ts` (minimal — hardened in Task 2):

```ts
import type { EngineTarget } from './StoryEngine'

/** Minimal v1: trim trailing whitespace per line, collapse 3+ blank lines, trim
 *  outer whitespace. Prompt handling lands in Task 2. */
export function normalizeTurnOutput(raw: string, _target: EngineTarget): string {
  return raw
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
```

`app/modules/inform6/engine/ZmachineEngine.ts`:

```ts
import type { EngineState, EngineTarget, StoryEngine, TurnRecord } from './StoryEngine'
import { Glk } from './glk'
import { HeadlessGlkOte } from './headless-glkote'
import { HeadlessDialog } from './headless-dialog'
import { normalizeTurnOutput } from './normalizeTurnOutput'
// @ts-expect-error — ifvms ships no types.
import ZVMm from 'ifvms'

const ZVM = (ZVMm as { ZVM: new () => unknown }).ZVM

export class ZmachineEngine implements StoryEngine {
  readonly target: EngineTarget = 'zmachine'
  private story!: Uint8Array
  private glkote!: HeadlessGlkOte

  async boot(story: Uint8Array): Promise<string> {
    this.story = story
    this.glkote = new HeadlessGlkOte()
    const vm = new ZVM() as { prepare(data: Uint8Array, opts: unknown): void }
    const options = { vm, Dialog: new HeadlessDialog(), Glk, GlkOte: this.glkote }
    vm.prepare(story, options)
    ;(Glk as { init(o: unknown): void }).init(options)
    const turn = await this.glkote.nextTurn()
    return normalizeTurnOutput(turn.buffer, this.target)
  }

  async send(command: string): Promise<TurnRecord> {
    this.glkote.sendLine(command)
    const turn = await this.glkote.nextTurn()
    return {
      command,
      output: normalizeTurnOutput(turn.buffer, this.target),
      status: turn.grid || undefined,
    }
  }

  snapshot(): EngineState {
    // Deferred (ADR-002): no v1 consumer. ZVM supports Quetzal save/restore.
    throw new Error('snapshot() not implemented in v1')
  }
  restore(_state: EngineState): void {
    throw new Error('restore() not implemented in v1')
  }
  async reset(): Promise<string> {
    return this.boot(this.story)
  }
}
```

`app/modules/inform6/engine/replayCore.ts`:

```ts
import type { EngineTarget, ReplayResult, TurnRecord } from './StoryEngine'
import { ZmachineEngine } from './ZmachineEngine'

/**
 * The one testing primitive (ADR-007). Boots the story, captures the banner as
 * turn 0, then sends each command capturing per-turn output. Pure/Node-safe —
 * no worker, no DOM — so the golden test drives it directly.
 */
export async function runReplay(
  story: Uint8Array,
  target: EngineTarget,
  commands: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<ReplayResult> {
  if (target !== 'zmachine') throw new Error('Glulx not yet supported')
  const started = Date.now()
  const engine = new ZmachineEngine()
  const turns: TurnRecord[] = []

  const banner = await engine.boot(story)
  turns.push({ command: '', output: banner })

  for (let i = 0; i < commands.length; i++) {
    turns.push(await engine.send(commands[i]!))
    onProgress?.(i + 1, commands.length)
  }
  return { turns, ms: Date.now() - started }
}
```

- [ ] **Step 7: Run the golden test; iterate until green (the spike)**

Run: `yarn test app/modules/inform6/engine/replay.golden.test.ts`

Expected end state: PASS. Likely iterations while getting there:
- **Missing GlkOte method:** glkapi throws `GlkOte.<name> is not a function`. Add a no-op `<name>()` to `HeadlessGlkOte` (Step 5 note) and re-run.
- **Missing Dialog method:** same for `HeadlessDialog`. Add a no-op and re-run.
- **`ifvms` import shape:** if `ZVMm.ZVM` is undefined, try `import { ZVM } from 'ifvms'` or `(ZVMm as any).default.ZVM`. Adjust the two lines in `ZmachineEngine.ts`.
- **Content shape:** if `turns[0].output` is empty, `console.log(JSON.stringify(arg))` inside `update()` once to confirm the real `content`/`text`/`content-run` field names against this `ifvms` version, then adjust `absorbContent`/`runText`. The protocol is per the GlkOte spec but field nesting can vary by version.

Do not proceed until both golden tests pass. Record (in the commit body) the final GlkOte/Dialog method set and the `ifvms` import form — Task 5 (worker) reuses them.

- [ ] **Step 8: Commit**

```bash
git add package.json yarn.lock app/modules/inform6/engine
git commit -m 'feat(engine): headless ZVM replay (boot + send) behind StoryEngine'
```

---

## Task 2: Harden normalizeTurnOutput (prompt + status separation)

**Files:**
- Modify: `app/modules/inform6/engine/normalizeTurnOutput.ts`
- Test: `app/modules/inform6/engine/normalizeTurnOutput.test.ts`

**Interfaces:**
- Consumes: `EngineTarget` from `./StoryEngine`.
- Produces: `normalizeTurnOutput(raw: string, target: EngineTarget): string` (signature unchanged; behavior hardened).

- [ ] **Step 1: Write the failing tests**

`app/modules/inform6/engine/normalizeTurnOutput.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeTurnOutput } from './normalizeTurnOutput'

describe('normalizeTurnOutput (zmachine)', () => {
  it('strips a trailing command prompt line', () => {
    expect(normalizeTurnOutput('You see a lamp here.\n\n>', 'zmachine')).toBe('You see a lamp here.')
  })

  it('strips a trailing prompt with a space', () => {
    expect(normalizeTurnOutput('Taken.\n> ', 'zmachine')).toBe('Taken.')
  })

  it('trims trailing whitespace on each line', () => {
    expect(normalizeTurnOutput('A   \nB\t\n', 'zmachine')).toBe('A\nB')
  })

  it('collapses 3+ blank lines to one blank line', () => {
    expect(normalizeTurnOutput('A\n\n\n\nB', 'zmachine')).toBe('A\n\nB')
  })

  it('returns empty string for prompt-only output', () => {
    expect(normalizeTurnOutput('\n>', 'zmachine')).toBe('')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test app/modules/inform6/engine/normalizeTurnOutput.test.ts`
Expected: FAIL — the prompt-stripping cases fail (minimal version leaves the `>`).

- [ ] **Step 3: Implement the hardened normalizer**

```ts
import type { EngineTarget } from './StoryEngine'

/**
 * VM-agnostic per-turn normalizer (ADR-006). Canonicalizes the trailing command
 * prompt away, trims trailing whitespace, and collapses runs of blank lines, so
 * transcripts are stable and diff-ready. Status/grid text is handled separately
 * by the engine (kept in `TurnRecord.status`), so it never reaches here.
 */
export function normalizeTurnOutput(raw: string, _target: EngineTarget): string {
  return raw
    .replace(/[ \t]+$/gm, '') // trailing whitespace per line
    .replace(/\n{3,}/g, '\n\n') // 3+ blank lines → one
    .replace(/\n*>[ \t]*$/, '') // a trailing prompt ('>' or '> ') and the blank lines before it
    .trim()
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn test app/modules/inform6/engine/normalizeTurnOutput.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Re-run the golden test (no regression)**

Run: `yarn test app/modules/inform6/engine`
Expected: PASS — `replay.golden.test.ts` still green (its assertions use `toContain`, unaffected by prompt trimming).

- [ ] **Step 6: Commit**

```bash
git add app/modules/inform6/engine/normalizeTurnOutput.ts app/modules/inform6/engine/normalizeTurnOutput.test.ts
git commit -m 'feat(engine): canonicalize trailing prompt in normalizeTurnOutput'
```

---

## Task 3: parseScript (lenient command parser)

**Files:**
- Create: `app/modules/inform6/engine/parseScript.ts`
- Test: `app/modules/inform6/engine/parseScript.test.ts`

**Interfaces:**
- Produces: `parseScript(text: string): string[]`

- [ ] **Step 1: Write the failing tests**

`app/modules/inform6/engine/parseScript.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseScript } from './parseScript'

describe('parseScript', () => {
  it('splits on newlines', () => {
    expect(parseScript('north\nlook\nsouth')).toEqual(['north', 'look', 'south'])
  })

  it('splits on periods', () => {
    expect(parseScript('n. examine rock. lift rock')).toEqual(['n', 'examine rock', 'lift rock'])
  })

  it('splits on a mix of newlines and periods', () => {
    expect(parseScript('n. examine rock\nlift rock\ns')).toEqual(['n', 'examine rock', 'lift rock', 's'])
  })

  it('ignores blank lines and empty segments', () => {
    expect(parseScript('n\n\n.\nlook')).toEqual(['n', 'look'])
  })

  it('drops `!` comment lines but keeps commands', () => {
    expect(parseScript('! walkthrough\nnorth\n! get the lamp\ntake lamp')).toEqual(['north', 'take lamp'])
  })

  it('strips a leading "> " so pasted transcripts work', () => {
    expect(parseScript('> north\n>look')).toEqual(['north', 'look'])
  })

  it('returns an empty array for empty / whitespace input', () => {
    expect(parseScript('   \n\n')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test app/modules/inform6/engine/parseScript.test.ts`
Expected: FAIL — cannot resolve `./parseScript`.

- [ ] **Step 3: Implement parseScript**

```ts
/**
 * Parse author script text into a command list (doc 04 §2.1). Lenient on
 * purpose so a long test reads naturally:
 *  - newline- and/or period-separated,
 *  - `!` lines are comments (kept in the editor, ignored here),
 *  - blank/empty segments ignored,
 *  - a leading `> ` is stripped (so a pasted transcript round-trips).
 */
export function parseScript(text: string): string[] {
  const out: string[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('!')) continue
    for (const seg of line.split('.')) {
      const cmd = seg.trim().replace(/^>\s*/, '').trim()
      if (cmd) out.push(cmd)
    }
  }
  return out
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn test app/modules/inform6/engine/parseScript.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add app/modules/inform6/engine/parseScript.ts app/modules/inform6/engine/parseScript.test.ts
git commit -m 'feat(engine): lenient parseScript command parser'
```

---

## Task 4: GlulxEngine stub + createEngine factory

**Files:**
- Create: `app/modules/inform6/engine/GlulxEngine.ts`
- Modify: `app/modules/inform6/engine/StoryEngine.ts` (append `createEngine`)
- Test: `app/modules/inform6/engine/createEngine.test.ts`

**Interfaces:**
- Consumes: `StoryEngine`, `EngineTarget` from `./StoryEngine`; `ZmachineEngine` from `./ZmachineEngine`.
- Produces: `createEngine(target: EngineTarget): StoryEngine`; `class GlulxEngine implements StoryEngine`.

- [ ] **Step 1: Write the failing test**

`app/modules/inform6/engine/createEngine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createEngine } from './StoryEngine'
import { ZmachineEngine } from './ZmachineEngine'

describe('createEngine', () => {
  it('returns a ZmachineEngine for the zmachine target', () => {
    expect(createEngine('zmachine')).toBeInstanceOf(ZmachineEngine)
  })

  it('throws for the (deferred) glulx target', () => {
    expect(() => createEngine('glulx')).toThrow(/Glulx not yet supported/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test app/modules/inform6/engine/createEngine.test.ts`
Expected: FAIL — `createEngine` is not exported.

- [ ] **Step 3: Create the GlulxEngine stub**

`app/modules/inform6/engine/GlulxEngine.ts`:

```ts
import type { EngineState, EngineTarget, StoryEngine, TurnRecord } from './StoryEngine'

const NOPE = 'Glulx not yet supported'

/** Deferred stub (ADR-002): the seam exists; the engine lands later behind it. */
export class GlulxEngine implements StoryEngine {
  readonly target: EngineTarget = 'glulx'
  boot(_story: Uint8Array): Promise<string> {
    throw new Error(NOPE)
  }
  send(_command: string): Promise<TurnRecord> {
    throw new Error(NOPE)
  }
  snapshot(): EngineState {
    throw new Error(NOPE)
  }
  restore(_state: EngineState): void {
    throw new Error(NOPE)
  }
  reset(): Promise<string> {
    throw new Error(NOPE)
  }
}
```

- [ ] **Step 4: Append `createEngine` to `StoryEngine.ts`**

Add to the bottom of `app/modules/inform6/engine/StoryEngine.ts`:

```ts
import { ZmachineEngine } from './ZmachineEngine'
import { GlulxEngine } from './GlulxEngine'

/** The interpreter is chosen by the compiled target; nothing downstream branches
 *  on VM type (ADR-002). `.z3/.z5/.z8 → zmachine`; `.ulx → glulx` (throws). */
export function createEngine(target: EngineTarget): StoryEngine {
  if (target === 'glulx') return new GlulxEngine()
  return new ZmachineEngine()
}
```

(Move the `import` lines to the top of the file alongside any existing imports to satisfy lint.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `yarn test app/modules/inform6/engine/createEngine.test.ts`
Expected: PASS (2 tests). Note: instantiating `GlulxEngine` does not import `ifvms`, so this test stays fast/Node-clean.

- [ ] **Step 6: Commit**

```bash
git add app/modules/inform6/engine/GlulxEngine.ts app/modules/inform6/engine/StoryEngine.ts app/modules/inform6/engine/createEngine.test.ts
git commit -m 'feat(engine): GlulxEngine stub + createEngine factory'
```

---

## Task 5: Replay worker + `useReplay` primitive (cancel/timeout)

Run `runReplay` in a Web Worker so a runaway game can be `terminate()`d (ADR-003). The worker is a thin transport; its logic (`runReplay`) is already Node-tested. The cancel/timeout controller is extracted as a pure, testable function driven by an injectable worker-like object.

**Files:**
- Create: `app/modules/inform6/engine/replay.worker.ts`
- Create: `app/composables/useReplay.ts`
- Test: `app/composables/replay-controller.test.ts`

**Interfaces:**
- Consumes: `runReplay` from `~/modules/inform6/engine/replayCore`; `EngineTarget`, `ReplayResult`, `TurnRecord` from `~/modules/inform6/engine/StoryEngine`.
- Produces:
  - Worker messages — in: `{ story: Uint8Array; target: EngineTarget; commands: string[] }`; out: `{ type: 'progress'; done: number; total: number } | { type: 'result'; turns: TurnRecord[]; ms: number } | { type: 'error'; message: string }`.
  - `interface WorkerLike { postMessage(m: unknown): void; terminate(): void; onmessage: ((e: { data: unknown }) => void) | null; onerror: ((e: unknown) => void) | null }`
  - `function runReplayController(spawn: () => WorkerLike, req, opts?: { onProgress?: (done: number, total: number) => void; timeoutMs?: number }): { promise: Promise<ReplayResult>; cancel: () => void }`
  - `class ReplayCancelledError extends Error`
  - `function useReplay(): { replay(story: Uint8Array, target: EngineTarget, commands: string[], opts?: { onProgress?: (done: number, total: number) => void; timeoutMs?: number }): { promise: Promise<ReplayResult>; cancel: () => void } }`

- [ ] **Step 1: Create the worker**

`app/modules/inform6/engine/replay.worker.ts`:

```ts
/// <reference lib="webworker" />
import { runReplay } from './replayCore'
import type { EngineTarget } from './StoryEngine'

interface ReplayRequest {
  story: Uint8Array
  target: EngineTarget
  commands: string[]
}

self.onmessage = async (e: MessageEvent<ReplayRequest>) => {
  const { story, target, commands } = e.data
  try {
    const result = await runReplay(story, target, commands, (done, total) =>
      self.postMessage({ type: 'progress', done, total }),
    )
    self.postMessage({ type: 'result', turns: result.turns, ms: result.ms })
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
```

- [ ] **Step 2: Write the failing controller tests**

`app/composables/replay-controller.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { runReplayController, ReplayCancelledError, type WorkerLike } from './useReplay'

function fakeWorker() {
  const w: WorkerLike & { terminated: boolean; emit: (data: unknown) => void } = {
    terminated: false,
    onmessage: null,
    onerror: null,
    postMessage: () => {},
    terminate() {
      this.terminated = true
    },
    emit(data: unknown) {
      this.onmessage?.({ data })
    },
  }
  return w
}

describe('runReplayController', () => {
  it('resolves with the result message and reports progress', async () => {
    const w = fakeWorker()
    const onProgress = vi.fn()
    const { promise } = runReplayController(() => w, { story: new Uint8Array(), target: 'zmachine', commands: ['n'] }, { onProgress })
    w.emit({ type: 'progress', done: 1, total: 1 })
    w.emit({ type: 'result', turns: [{ command: '', output: 'hi' }], ms: 5 })
    await expect(promise).resolves.toEqual({ turns: [{ command: '', output: 'hi' }], ms: 5 })
    expect(onProgress).toHaveBeenCalledWith(1, 1)
    expect(w.terminated).toBe(true)
  })

  it('rejects with the error message', async () => {
    const w = fakeWorker()
    const { promise } = runReplayController(() => w, { story: new Uint8Array(), target: 'zmachine', commands: [] })
    w.emit({ type: 'error', message: 'bad story' })
    await expect(promise).rejects.toThrow('bad story')
    expect(w.terminated).toBe(true)
  })

  it('cancel() terminates the worker and rejects with ReplayCancelledError', async () => {
    const w = fakeWorker()
    const { promise, cancel } = runReplayController(() => w, { story: new Uint8Array(), target: 'zmachine', commands: [] })
    cancel()
    await expect(promise).rejects.toBeInstanceOf(ReplayCancelledError)
    expect(w.terminated).toBe(true)
  })

  it('times out, terminating the worker', async () => {
    vi.useFakeTimers()
    const w = fakeWorker()
    const { promise } = runReplayController(() => w, { story: new Uint8Array(), target: 'zmachine', commands: [] }, { timeoutMs: 1000 })
    const assertion = expect(promise).rejects.toBeInstanceOf(ReplayCancelledError)
    vi.advanceTimersByTime(1000)
    await assertion
    expect(w.terminated).toBe(true)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `yarn test app/composables/replay-controller.test.ts`
Expected: FAIL — cannot resolve exports from `./useReplay`.

- [ ] **Step 4: Implement `useReplay` (controller + composable)**

`app/composables/useReplay.ts`:

```ts
import type { EngineTarget, ReplayResult, TurnRecord } from '~/modules/inform6/engine/StoryEngine'

export interface WorkerLike {
  postMessage(m: unknown): void
  terminate(): void
  onmessage: ((e: { data: unknown }) => void) | null
  onerror: ((e: unknown) => void) | null
}

interface ReplayRequest {
  story: Uint8Array
  target: EngineTarget
  commands: string[]
}

type WorkerOut =
  | { type: 'progress'; done: number; total: number }
  | { type: 'result'; turns: TurnRecord[]; ms: number }
  | { type: 'error'; message: string }

export class ReplayCancelledError extends Error {
  constructor() {
    super('Replay cancelled')
    this.name = 'ReplayCancelledError'
  }
}

/**
 * Pure transport controller: drives a worker-like object to a ReplayResult, with
 * cancel() and an optional timeout — both `terminate()` the worker (ADR-003).
 * Injectable `spawn` makes it unit-testable without a real Worker.
 */
export function runReplayController(
  spawn: () => WorkerLike,
  req: ReplayRequest,
  opts: { onProgress?: (done: number, total: number) => void; timeoutMs?: number } = {},
): { promise: Promise<ReplayResult>; cancel: () => void } {
  const worker = spawn()
  let timer: ReturnType<typeof setTimeout> | null = null
  let settled = false
  let reject: (e: unknown) => void = () => {}

  const cleanup = () => {
    if (timer) clearTimeout(timer)
    timer = null
    worker.terminate()
  }
  const fail = (e: unknown) => {
    if (settled) return
    settled = true
    cleanup()
    reject(e)
  }

  const promise = new Promise<ReplayResult>((resolve, rej) => {
    reject = rej
    worker.onmessage = (e: { data: unknown }) => {
      const msg = e.data as WorkerOut
      if (msg.type === 'progress') {
        opts.onProgress?.(msg.done, msg.total)
      } else if (msg.type === 'result') {
        if (settled) return
        settled = true
        cleanup()
        resolve({ turns: msg.turns, ms: msg.ms })
      } else if (msg.type === 'error') {
        fail(new Error(msg.message))
      }
    }
    worker.onerror = (err: unknown) => fail(err instanceof Error ? err : new Error('Worker error'))
    if (opts.timeoutMs != null) timer = setTimeout(() => fail(new ReplayCancelledError()), opts.timeoutMs)
    // Start the worker only after the handlers above are wired.
    worker.postMessage(req)
  })

  const cancel = () => fail(new ReplayCancelledError())

  return { promise, cancel }
}

/** Client-only composable: spawns the real module worker per run. */
export function useReplay() {
  function replay(
    story: Uint8Array,
    target: EngineTarget,
    commands: string[],
    opts: { onProgress?: (done: number, total: number) => void; timeoutMs?: number } = {},
  ) {
    const spawn = (): WorkerLike =>
      new Worker(new URL('../modules/inform6/engine/replay.worker.ts', import.meta.url), {
        type: 'module',
      }) as unknown as WorkerLike
    return runReplayController(spawn, { story, target, commands }, opts)
  }
  return { replay }
}
```

The controller posts `req` only after `onmessage`/`onerror` are wired (so no message is missed); `cancel()`, the timeout, and a worker error all route through `fail()`, which `terminate()`s the worker and rejects the single promise. The worker URL is a relative specifier — the most reliable form for Vite's `new URL(..., import.meta.url)` worker detection.

- [ ] **Step 5: Run the controller tests to verify they pass**

Run: `yarn test app/composables/replay-controller.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Verify the worker builds in the dev app**

Run: `yarn dev`, open the app, and in the browser console:

```js
const w = new Worker(new URL('/_nuxt/app/modules/inform6/engine/replay.worker.ts', location.origin), { type: 'module' })
```

Expected: no bundling error in the Nuxt/Vite terminal for `replay.worker.ts` (the worker chunk emits). If Vite cannot resolve `~/...` inside `new URL`, change the worker URL in `useReplay` to a relative specifier: `new URL('../modules/inform6/engine/replay.worker.ts', import.meta.url)`. Stop `yarn dev`.

> If `glkote-term` fails to bundle for the worker (pulls Node builtins like `fs`/`readline`), switch `engine/glk.ts` to a vendored browser-safe `glkapi.js` (download the MIT glkapi.js from the `glkote-term`/`glkote` source into `engine/vendor/glkapi.js` and `export { Glk } from './vendor/glkapi.js'`). This is the Path-B fallback noted in the spec's risks; only `glk.ts` changes.

- [ ] **Step 7: Commit**

```bash
git add app/modules/inform6/engine/replay.worker.ts app/composables/useReplay.ts app/composables/replay-controller.test.ts
git commit -m 'feat(engine): replay Web Worker + useReplay (cancel/timeout)'
```

---

## Task 6: Test-script model + persistence

**Files:**
- Create: `app/composables/test-scripts.ts` (pure)
- Test: `app/composables/test-scripts.test.ts`
- Create: `app/composables/useTestScripts.ts` (composable)
- Modify: `frotzsmith.config.ts` (add `scripts` storage key)

**Interfaces:**
- Produces (pure):
  - `interface TestScript { id: string; name: string; text: string }`
  - `upsertScript(list: TestScript[], script: TestScript): TestScript[]`
  - `renameScript(list: TestScript[], id: string, name: string): TestScript[]`
  - `deleteScript(list: TestScript[], id: string): TestScript[]`
  - `setScriptText(list: TestScript[], id: string, text: string): TestScript[]`
  - `nextActiveId(list: TestScript[], currentActive: string): string`
- Produces (composable): `useTestScripts(): { scripts: Ref<TestScript[]>; activeId: Ref<string>; activeScript: ComputedRef<TestScript | undefined>; add(name?: string): void; rename(id: string, name: string): void; remove(id: string): void; updateText(id: string, text: string): void; select(id: string): void; restore(): void }`

- [ ] **Step 1: Write the failing pure-logic tests**

`app/composables/test-scripts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { upsertScript, renameScript, deleteScript, setScriptText, nextActiveId } from './test-scripts'

const s = (id: string, name = id, text = '') => ({ id, name, text })

describe('test-scripts pure helpers', () => {
  it('upsert adds a new script and replaces an existing one by id', () => {
    expect(upsertScript([s('a')], s('b'))).toEqual([s('a'), s('b')])
    expect(upsertScript([s('a', 'A')], s('a', 'A2'))).toEqual([s('a', 'A2')])
  })

  it('rename changes only the matching script name', () => {
    expect(renameScript([s('a', 'A'), s('b', 'B')], 'b', 'Bee')).toEqual([s('a', 'A'), s('b', 'Bee')])
  })

  it('delete removes the matching script', () => {
    expect(deleteScript([s('a'), s('b')], 'a')).toEqual([s('b')])
  })

  it('setScriptText updates only the matching script text', () => {
    expect(setScriptText([s('a', 'A', 'x')], 'a', 'y')).toEqual([s('a', 'A', 'y')])
  })

  it('nextActiveId keeps a still-valid active, else picks the first, else ""', () => {
    expect(nextActiveId([s('a'), s('b')], 'b')).toBe('b')
    expect(nextActiveId([s('a'), s('b')], 'gone')).toBe('a')
    expect(nextActiveId([], 'gone')).toBe('')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test app/composables/test-scripts.test.ts`
Expected: FAIL — cannot resolve `./test-scripts`.

- [ ] **Step 3: Implement the pure helpers**

`app/composables/test-scripts.ts`:

```ts
/**
 * Pure, framework-free logic for test scripts (mirrors project-files.ts). The
 * `useTestScripts` composable wraps these with reactive state + localStorage.
 */
export interface TestScript {
  id: string
  name: string
  text: string
}

export function upsertScript(list: TestScript[], script: TestScript): TestScript[] {
  const i = list.findIndex(s => s.id === script.id)
  if (i === -1) return [...list, script]
  const copy = list.slice()
  copy[i] = script
  return copy
}

export function renameScript(list: TestScript[], id: string, name: string): TestScript[] {
  return list.map(s => (s.id === id ? { ...s, name } : s))
}

export function deleteScript(list: TestScript[], id: string): TestScript[] {
  return list.filter(s => s.id !== id)
}

export function setScriptText(list: TestScript[], id: string, text: string): TestScript[] {
  return list.map(s => (s.id === id ? { ...s, text } : s))
}

/** Keep a still-valid active id; else the first script; else ''. */
export function nextActiveId(list: TestScript[], currentActive: string): string {
  if (list.some(s => s.id === currentActive)) return currentActive
  return list[0]?.id ?? ''
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn test app/composables/test-scripts.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Add the storage key**

In `frotzsmith.config.ts`, add to `storageKeys`:

```ts
  storageKeys: {
    recovery: "frotzsmith:recovery",
    profileMode: "frotzsmith:profile-mode",
    target: "frotzsmith:target",
    extensions: "frotzsmith:extensions",
    explorer: "frotzsmith:explorer",
    scripts: "frotzsmith:scripts",
  },
```

- [ ] **Step 6: Implement the composable**

`app/composables/useTestScripts.ts`:

```ts
import { frotzsmith } from '~~/frotzsmith.config'
import {
  type TestScript,
  upsertScript,
  renameScript,
  deleteScript,
  setScriptText,
  nextActiveId,
} from './test-scripts'

const KEY = frotzsmith.storageKeys.scripts

interface Persisted {
  scripts: TestScript[]
  activeId: string
}

let watching = false

/**
 * Named test scripts for the working project. localStorage is the working store
 * (ADR-010); the `.inf` is canonical, scripts are working state. Single project
 * for now — multi-project namespacing is future work.
 */
export function useTestScripts() {
  const scripts = useState<TestScript[]>('frotz:scripts', () => [])
  const activeId = useState<string>('frotz:script-active', () => '')
  const activeScript = computed(() => scripts.value.find(s => s.id === activeId.value))

  function persist() {
    if (!import.meta.client) return
    try {
      const data: Persisted = { scripts: scripts.value, activeId: activeId.value }
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      // QuotaExceededError — keep working in memory
    }
  }

  function restore() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const data = JSON.parse(raw) as Persisted
        if (Array.isArray(data.scripts)) scripts.value = data.scripts
        if (typeof data.activeId === 'string') activeId.value = data.activeId
      }
    } catch {
      // corrupt — ignore, start empty
    }
    if (!activeScript.value && scripts.value.length === 0) seedFirst()
    activeId.value = nextActiveId(scripts.value, activeId.value)
  }

  function seedFirst() {
    const first: TestScript = {
      id: newId(),
      name: 'Script 1',
      text: '! One command per line, or separate with periods.\nlook\n',
    }
    scripts.value = [first]
    activeId.value = first.id
  }

  function add(name?: string) {
    const script: TestScript = { id: newId(), name: name || `Script ${scripts.value.length + 1}`, text: '' }
    scripts.value = upsertScript(scripts.value, script)
    activeId.value = script.id
    persist()
  }

  function rename(id: string, name: string) {
    scripts.value = renameScript(scripts.value, id, name)
    persist()
  }

  function remove(id: string) {
    scripts.value = deleteScript(scripts.value, id)
    activeId.value = nextActiveId(scripts.value, activeId.value)
    persist()
  }

  function updateText(id: string, text: string) {
    scripts.value = setScriptText(scripts.value, id, text)
    persist()
  }

  function select(id: string) {
    activeId.value = id
    persist()
  }

  if (import.meta.client && !watching) {
    watching = true
    watch([scripts, activeId], persist, { deep: true })
  }

  return { scripts, activeId, activeScript, add, rename, remove, updateText, select, restore }
}

function newId(): string {
  return import.meta.client && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s_${Math.random().toString(36).slice(2)}`
}
```

- [ ] **Step 7: Run the full suite (no regression)**

Run: `yarn test`
Expected: PASS — all engine + composable tests green.

- [ ] **Step 8: Commit**

```bash
git add app/composables/test-scripts.ts app/composables/test-scripts.test.ts app/composables/useTestScripts.ts frotzsmith.config.ts
git commit -m 'feat(scripts): TestScript model, persistence, useTestScripts'
```

---

## Task 7: `useTranscript` (run/cancel/progress) + restore wiring

**Files:**
- Create: `app/composables/useTranscript.ts`
- Modify: `app/composables/useIde.ts` (call `useTestScripts().restore()` in `restore()`)

**Interfaces:**
- Consumes: `useReplay` (`replay`), `useIde` (`activeTab`, `result`, `canPlay`), `parseScript`, `EngineTarget`, `TurnRecord`.
- Produces: `useTranscript(): { turns: Ref<TurnRecord[]>; running: Ref<boolean>; progress: Ref<{ done: number; total: number } | null>; ms: Ref<number | null>; error: Ref<string | null>; run(commands: string[]): Promise<void>; cancel(): void }`

- [ ] **Step 1: Implement `useTranscript`**

`app/composables/useTranscript.ts`:

```ts
import type { TurnRecord } from '~/modules/inform6/engine/StoryEngine'
import { ReplayCancelledError } from './useReplay'

const REPLAY_TIMEOUT_MS = 15_000

/** Owns the current transcript run: state, progress, cancellation. */
export function useTranscript() {
  const { result, activeTab, canPlay } = useIde()
  const { replay } = useReplay()

  const turns = useState<TurnRecord[]>('frotz:transcript-turns', () => [])
  const running = useState<boolean>('frotz:transcript-running', () => false)
  const progress = useState<{ done: number; total: number } | null>('frotz:transcript-progress', () => null)
  const ms = useState<number | null>('frotz:transcript-ms', () => null)
  const error = useState<string | null>('frotz:transcript-error', () => null)

  let cancelFn: (() => void) | null = null

  async function run(commands: string[]) {
    if (!canPlay.value || running.value) return
    const story = result.value?.storyFile
    if (!story) return

    activeTab.value = 'transcript' // stateful right pane focuses the run
    running.value = true
    error.value = null
    turns.value = []
    ms.value = null
    progress.value = { done: 0, total: commands.length }

    const ctrl = replay(new Uint8Array(story), 'zmachine', commands, {
      onProgress: (done, total) => (progress.value = { done, total }),
      timeoutMs: REPLAY_TIMEOUT_MS,
    })
    cancelFn = ctrl.cancel
    try {
      const res = await ctrl.promise
      turns.value = res.turns
      ms.value = res.ms
    } catch (e) {
      if (e instanceof ReplayCancelledError) error.value = `Stopped after ${progress.value?.done ?? 0} commands.`
      else error.value = e instanceof Error ? e.message : 'Replay failed.'
    } finally {
      running.value = false
      progress.value = null
      cancelFn = null
    }
  }

  function cancel() {
    cancelFn?.()
  }

  return { turns, running, progress, ms, error, run, cancel }
}
```

- [ ] **Step 2: Wire script restore into `useIde.restore()`**

In `app/composables/useIde.ts`, inside `restore()` (after `restoreProjectFiles()`), add `restoreScripts()`. At the top of `useIde()`, destructure it:

```ts
  const { restore: restoreScripts } = useTestScripts()
```

and in `restore()`:

```ts
    restoreSource()
    restoreProjectFiles()
    restoreScripts()
```

- [ ] **Step 3: Typecheck**

Run: `yarn typecheck`
Expected: no type errors (ignore the `vue-router/volar` plugin warning).

- [ ] **Step 4: Commit**

```bash
git add app/composables/useTranscript.ts app/composables/useIde.ts
git commit -m 'feat(transcript): useTranscript run/cancel state + restore wiring'
```

---

## Task 8: Transcript tab UI (CodeMirror script editor + transcript)

**Files:**
- Create: `app/components/ide/ScriptEditor.vue`
- Create: `app/components/ide/TranscriptPanel.vue`
- Modify: `app/components/ide/RightPaneTabs.vue` (replace inline stub with `<TranscriptPanel />`)

**Interfaces:**
- Consumes: `useTestScripts` (`activeScript`, `activeId`, `updateText`, plus CRUD/`select`/`restore`), `useTranscript`, `useIde` (`canPlay`), `parseScript`.

- [ ] **Step 1: Build ScriptEditor.vue (CodeMirror 6)**

Mirrors `SourcePane.vue`'s CM6 setup (theme compartment, keymap, write-back `updateListener`, focusable scroll region for axe) but single-doc, with a tiny `!`-comment `StreamLanguage` instead of the Inform 6 language. Write-back lives here, so the VM-facing `TranscriptPanel` never touches the doc.

`app/components/ide/ScriptEditor.vue`:

```vue
<script setup lang="ts">
import { EditorState, Compartment, type Extension } from '@codemirror/state'
import { EditorView, keymap, highlightActiveLine, drawSelection, placeholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

const { activeScript, activeId, updateText } = useTestScripts()
const colorMode = useColorMode()

const host = ref<HTMLElement | null>(null)
const themeComp = new Compartment()
let view: EditorView | null = null
const isDark = () => colorMode.value === 'dark'

// A script is a command list; only `!` lines are special (comments, like I6).
const scriptLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null
    if (stream.peek() === '!') {
      stream.skipToEnd()
      return 'comment'
    }
    stream.skipToEnd()
    return null
  },
})
const commentHighlight = syntaxHighlighting(
  HighlightStyle.define([{ tag: tags.comment, fontStyle: 'italic', opacity: '0.6' }]),
)

function theme(dark: boolean): Extension {
  return EditorView.theme(
    {
      '&': { fontSize: '13px', height: '100%' },
      '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
      '.cm-scroller': { overflow: 'auto' },
    },
    { dark },
  )
}

function makeState(text: string): EditorState {
  const exts: Extension[] = [
    history(),
    highlightActiveLine(),
    drawSelection(),
    EditorView.lineWrapping,
    scriptLanguage,
    commentHighlight,
    placeholder('north. examine lamp. take lamp. inventory…'),
    EditorView.contentAttributes.of({ 'aria-label': 'Test script commands' }),
    themeComp.of(theme(isDark())),
    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
    EditorView.updateListener.of(u => {
      if (u.docChanged && activeScript.value) updateText(activeScript.value.id, u.state.doc.toString())
    }),
  ]
  return EditorState.create({ doc: text, extensions: exts })
}

onMounted(() => {
  if (!host.value) return
  view = new EditorView({ parent: host.value, state: makeState(activeScript.value?.text ?? '') })
  // Keyboard-focusable scroll region (WCAG 2.1.1 / axe scrollable-region-focusable),
  // as in SourcePane — CodeMirror's contenteditable does not satisfy the rule.
  view.scrollDOM.setAttribute('tabindex', '0')
})

// Switch scripts → load the new doc. (Per-script undo resets on switch — fine for v1.)
watch(activeId, () => {
  if (view) view.setState(makeState(activeScript.value?.text ?? ''))
})

// Dark/light swap without tearing down the editor.
watch(
  () => colorMode.value,
  () => view?.dispatch({ effects: themeComp.reconfigure(theme(isDark())) }),
)

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})
</script>

<template>
  <div ref="host" class="h-full w-full overflow-hidden" />
</template>
```

- [ ] **Step 2: Build TranscriptPanel.vue**

`app/components/ide/TranscriptPanel.vue` (embeds `<ScriptEditor />`; Nuxt auto-imports components, so no explicit import):

```vue
<script setup lang="ts">
import { parseScript } from '~/modules/inform6/engine/parseScript'

const { scripts, activeId, activeScript, add, rename, remove, select, restore } = useTestScripts()
const { turns, running, progress, ms, error, run, cancel } = useTranscript()
const { canPlay } = useIde()

// First client mount: hydrate scripts (idempotent; useIde.restore also calls it).
onMounted(restore)

const scriptItems = computed(() => [
  scripts.value.map(s => ({
    label: s.name,
    icon: s.id === activeId.value ? 'i-lucide-check' : 'i-lucide-scroll-text',
    onSelect: () => select(s.id),
  })),
  [
    { label: 'New script', icon: 'i-lucide-plus', onSelect: () => add() },
    {
      label: 'Rename…',
      icon: 'i-lucide-pencil',
      onSelect: () => {
        const name = activeScript.value && window.prompt('Script name', activeScript.value.name)
        if (name && activeScript.value) rename(activeScript.value.id, name)
      },
    },
    {
      label: 'Delete',
      icon: 'i-lucide-trash-2',
      onSelect: () => activeScript.value && remove(activeScript.value.id),
    },
  ],
])

const liveStatus = computed(() => {
  if (running.value) return progress.value ? `Running ${progress.value.done} of ${progress.value.total}…` : 'Running…'
  if (error.value) return error.value
  if (turns.value.length) return `Done — ${turns.value.length - 1} commands${ms.value != null ? ` · ${ms.value} ms` : ''}`
  return ''
})

function onRun() {
  run(parseScript(activeScript.value?.text ?? ''))
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Script bar -->
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-default px-3 py-2">
      <UDropdownMenu :items="scriptItems">
        <UButton color="neutral" variant="subtle" size="sm" icon="i-lucide-scroll-text" trailing-icon="i-lucide-chevron-down">
          {{ activeScript?.name ?? 'No scripts' }}
        </UButton>
      </UDropdownMenu>

      <UButton
        v-if="!running"
        color="primary"
        size="sm"
        icon="i-lucide-play"
        :disabled="!canPlay || !activeScript"
        :title="canPlay ? 'Run this script headlessly' : 'Compile a clean build first'"
        @click="onRun"
      >
        Run
      </UButton>
      <UButton v-else color="error" size="sm" icon="i-lucide-square" @click="cancel">Cancel</UButton>

      <span role="status" aria-live="polite" class="text-muted ml-auto text-sm">{{ liveStatus }}</span>
    </div>

    <!-- Script editor (CodeMirror 6) -->
    <div class="bg-elevated/40 h-28 shrink-0 border-b border-default">
      <ScriptEditor />
    </div>

    <!-- Transcript -->
    <div class="min-h-0 flex-1 overflow-auto px-4 py-3" tabindex="0" role="region" aria-label="Transcript output">
      <div
        v-if="!turns.length && !running"
        class="frotz-grid flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <UIcon name="i-lucide-scroll-text" class="size-10 text-primary" />
        <p class="text-lg font-semibold">{{ canPlay ? 'Write a script and press Run' : 'Compile to run scripts' }}</p>
        <p class="text-muted max-w-sm text-sm">Commands run headlessly; the playthrough appears here.</p>
      </div>

      <div v-for="(t, i) in turns" :key="i" class="mb-3">
        <p v-if="t.command" class="text-primary font-mono text-sm font-semibold">&gt; {{ t.command }}</p>
        <pre class="whitespace-pre-wrap font-mono text-sm leading-relaxed">{{ t.output }}</pre>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Mount it in RightPaneTabs.vue**

In `app/components/ide/RightPaneTabs.vue`, replace the inline transcript stub:

```vue
      <ResultsPanel v-if="activeTab === 'results'" />
      <PlayPanel v-else-if="activeTab === 'play'" />
      <TranscriptPanel v-else-if="activeTab === 'transcript'" />
```

and delete the old `<div v-else …>Test transcripts are coming next…</div>` block.

- [ ] **Step 4: Run the app and exercise it end-to-end**

Run: `yarn dev`. In the app:
1. The default demo source is loaded — click **Compile** (⌘B); wait for "Ready".
2. Open the **Transcript** tab. A seeded "Script 1" exists.
3. In the CodeMirror script editor, replace the text with:

```
look
north
examine wildflowers
south
take lamp
examine lamp
inventory
```

4. Click **Run**. Expected: the tab fills with 8 turns (boot banner + 7 commands); the `north` turn shows the Meadow text, `take lamp` shows the lamp taken, `inventory` lists the lamp. Live status: "Done — 7 commands · N ms". Confirm `!` comment lines render dimmed/italic.
5. Reload the page → the script text persists; the Transcript tab restores.

Stop `yarn dev`.

- [ ] **Step 5: Commit**

```bash
git add app/components/ide/ScriptEditor.vue app/components/ide/TranscriptPanel.vue app/components/ide/RightPaneTabs.vue
git commit -m 'feat(transcript): Transcript tab UI (CodeMirror script editor + output)'
```

---

## Task 9: Verify (typecheck, tests, a11y) + docs

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `ROADMAP.md`

- [ ] **Step 1: Full typecheck + test suite**

Run: `yarn typecheck && yarn test`
Expected: no type errors; all suites pass (golden, normalize, parseScript, createEngine, replay-controller, test-scripts).

- [ ] **Step 2: Accessibility check**

With `yarn dev` running and the Transcript tab active (a completed run on screen), run the project's a11y audit against the IDE page (per the repo's axe baseline / the user's a11y tooling). Confirm: no new violations; the transcript region is keyboard-focusable; Run/Cancel have labels; the `role="status"` region announces run progress. Fix any violation before continuing.

- [ ] **Step 3: Production build smoke (worker bundles statically)**

Run: `yarn generate`
Expected: build succeeds; a `replay.worker` chunk is emitted under `.output/public/_nuxt/`. (Confirms the Web Worker bundles under static generation — the spec's primary risk.) If it fails, apply the Step-6/Task-5 fallbacks (relative worker URL; vendored `glkapi.js`).

- [ ] **Step 4: Update CHANGELOG.md**

Add an entry under the current/unreleased section describing: headless `StoryEngine` seam (`createEngine`/`ZmachineEngine`/`normalizeTurnOutput`), the `replay()` Web Worker primitive, and the Transcript tab (named scripts, persistence, run/cancel). Match the file's existing entry format.

- [ ] **Step 5: Update ROADMAP.md**

Move "Test scripts & a transcript pane" from **Next (v1)** to **Shipped (v1)**, noting it runs on the headless `StoryEngine`/`replay()` seam, with blessed-output diffing (the Skein) still ahead. (Leave the user's incidental trailing-newline edit out of scope — only change the roadmap text.)

- [ ] **Step 6: Commit**

```bash
git add CHANGELOG.md ROADMAP.md
git commit -m 'docs: changelog + roadmap for the transcript / replay seam'
```

---

## Self-review (against the spec)

**Spec coverage:** §3.1 engine seam → Tasks 1, 2, 4 (StoryEngine/ZmachineEngine/headless Glk/GlulxEngine/normalize/createEngine); `replayCore`/`parseScript` → Tasks 1, 3; §3.2 worker → Task 5; §3.3 composables → Tasks 5 (`useReplay`), 6 (`useTestScripts`), 7 (`useTranscript`); §3.4 UI + config + restore → Tasks 6 (storage key), 7 (restore), 8 (TranscriptPanel/RightPaneTabs). §4 data flow → Tasks 7–8. §5 error handling → Task 7 (canPlay gate, error state, timeout) + 8 (disabled Run). §6 testing → Tasks 1–6 tests + Task 9. §7 a11y → Task 8 markup + Task 9 audit. §9 risks → Task 1 (spike), Task 5 Step 6 + Task 9 Step 3 (worker bundling). Covered.

**Deferred per spec (no task, intentional):** Send-to-Play; blessed/diff; Glulx engine body (`snapshot`/`restore` throw).

**Type consistency:** `TurnRecord { command; output; status? }`, `ReplayResult { turns; ms }`, `EngineTarget`, `StoryEngine`, and the worker message union are defined once in `StoryEngine.ts` / `useReplay.ts` and consumed unchanged. `runReplay`, `runReplayController`, `useReplay().replay`, `useTranscript().run`, and the `TestScript` helpers keep consistent signatures across tasks.

**Note for the implementer:** Task 1 is a genuine integration spike — the exact `ifvms`/GlkOte/Dialog method surface is confirmed empirically there (the golden test is the oracle). Tasks 2–9 are conventional once Task 1 is green. Do not start Task 5's worker until Task 1's engine passes in Node.

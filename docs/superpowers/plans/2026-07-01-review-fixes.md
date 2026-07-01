# Review-Findings Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 2026-07-01 app-review findings: cross-language state leaks, dead session watchers, the orphaned headless replay (Run button), compiler robustness (-Cu, boot retry, trap surfacing), a11y gaps, map fit over-zoom, zip-bomb cap, per-route canonicals, and CI.

**Architecture:** All state stays in the existing composable pattern (pure logic + `use*` wrapper, shared `useState`). Fixes are surgical: detached `effectScope` for session-long watchers, an explicit language-switch reset in `useIde.restore()`, re-wiring the Test Script panel's Run to the existing (tested) headless engine, and small pure helpers (`fitViewBox`, `makeZipEntryFilter`, `replayBudgetMs`, `cachedAsync`) added where logic needs unit tests.

**Tech Stack:** Nuxt 4 (`ssr:false`), Vue 3 composables, Vitest (node + happy-dom via `environmentMatchGlobs`), Nuxt UI 4, fflate, GitHub Actions.

## Global Constraints

- Node 22, Yarn 1.22 (`yarn install --frozen-lockfile` in CI).
- TypeScript strict; `yarn typecheck` must stay exit-0.
- Commit messages: descriptive content only — **no `Co-Authored-By` or any AI attribution trailer** (user's global git preference).
- Work on branch `fix/review-findings` (created in Task 0); commit per task.
- Test idioms: `*.nuxt.test.ts` → happy-dom with `test/nuxt-setup.ts` window stubs; pure logic → node env. Module-level flags require `vi.resetModules()` + dynamic import per test (see `useZilfWasm.lazy.test.ts`).
- Don't restructure files beyond what a task states; match existing comment density/style.
- Run `yarn test` after every task; all 375 existing tests must stay green except the two intentionally reversed (noted in Tasks 1 and 3).

---

### Task 0: Branch + test-infra stub

**Files:**
- Modify: `test/nuxt-setup.ts`

**Interfaces:**
- Produces: global `effectScope` available to composables under test (used by Task 5).

- [ ] **Step 1: Create the working branch**

```bash
git checkout -b fix/review-findings
```

- [ ] **Step 2: Add `effectScope` to the test stubs**

In `test/nuxt-setup.ts`, extend the vue import and stub block:

```ts
import { ref, computed, watch, watchEffect, readonly, nextTick, effectScope } from 'vue'
```

and after `vi.stubGlobal('nextTick', nextTick)` add:

```ts
  vi.stubGlobal('effectScope', effectScope)
```

- [ ] **Step 3: Run tests to confirm no regressions**

Run: `yarn test`
Expected: 375 passed | 7 skipped (unchanged).

- [ ] **Step 4: Commit**

```bash
git add test/nuxt-setup.ts
git commit -m "test: stub effectScope global for composable tests"
```

---

### Task 1: Replay timeout identity + scaled budget + module-level cancel

**Files:**
- Modify: `app/composables/useReplay.ts`
- Modify: `app/composables/useTranscript.ts`
- Modify: `app/composables/replay-controller.test.ts` (line 52 expectation changes)
- Test: `app/composables/replay-budget.test.ts` (new, node env)

**Interfaces:**
- Produces: `ReplayTimeoutError` (exported from useReplay.ts, has `.timeoutMs: number`); `replayBudgetMs(commandCount: number): number` (exported from useTranscript.ts). Task 2 relies on `useTranscript().run/cancel` semantics being otherwise unchanged.

- [ ] **Step 1: Write the failing tests**

New file `app/composables/replay-budget.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { replayBudgetMs } from './useTranscript'

describe('replayBudgetMs', () => {
  it('gives short scripts the 15s base', () => {
    expect(replayBudgetMs(0)).toBe(15_000)
    expect(replayBudgetMs(10)).toBe(17_500)
  })
  it('scales 250ms per command', () => {
    expect(replayBudgetMs(100)).toBe(40_000)
  })
  it('caps at 120s for very long scripts', () => {
    expect(replayBudgetMs(10_000)).toBe(120_000)
  })
})
```

In `app/composables/replay-controller.test.ts`, change the timeout test (around line 51–52) to expect the new error and add an import:

```ts
import { runReplayController, ReplayCancelledError, ReplayTimeoutError, type WorkerLike } from './useReplay'
// …
const assertion = expect(promise).rejects.toBeInstanceOf(ReplayTimeoutError)
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn test replay`
Expected: FAIL — `replayBudgetMs` not exported; `ReplayTimeoutError` not exported.

- [ ] **Step 3: Implement**

`app/composables/useReplay.ts` — add below `ReplayCancelledError`:

```ts
export class ReplayTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Replay timed out after ${timeoutMs} ms`)
    this.name = 'ReplayTimeoutError'
  }
}
```

and change the timer line (currently `fail(new ReplayCancelledError())`):

```ts
    if (opts.timeoutMs != null) timer = setTimeout(() => fail(new ReplayTimeoutError(opts.timeoutMs!)), opts.timeoutMs)
```

`app/composables/useTranscript.ts` — full new header section:

```ts
import type { TurnRecord } from '~/modules/inform6/engine/StoryEngine'
import { ReplayCancelledError, ReplayTimeoutError } from './useReplay'

/** Wall-clock budget for a headless replay: 15s base + 250ms per command,
 *  capped at 2 minutes — "arbitrarily long" scripts shouldn't hit a flat 15s wall. */
export function replayBudgetMs(commandCount: number): number {
  return Math.min(15_000 + 250 * commandCount, 120_000)
}

// Module-level so Stop still works after the Test Script panel remounts
// (tab switches v-if the panel away mid-run; a per-closure fn went stale).
let cancelFn: (() => void) | null = null
```

Delete the `const REPLAY_TIMEOUT_MS = 15_000` line and the `let cancelFn…` line inside `useTranscript()`. In `run()`, change the replay options to `timeoutMs: replayBudgetMs(commands.length)`, and the catch block to:

```ts
    } catch (e) {
      if (e instanceof ReplayCancelledError) error.value = `Stopped after ${progress.value?.done ?? 0} commands.`
      else if (e instanceof ReplayTimeoutError)
        error.value = `Timed out after ${progress.value?.done ?? 0} of ${progress.value?.total ?? 0} commands (${Math.round(e.timeoutMs / 1000)}s limit).`
      else error.value = e instanceof Error ? e.message : 'Replay failed.'
    } finally {
```

- [ ] **Step 4: Run tests**

Run: `yarn test replay && yarn test transcript`
Expected: PASS (including the updated controller test).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useReplay.ts app/composables/useTranscript.ts app/composables/replay-controller.test.ts app/composables/replay-budget.test.ts
git commit -m "fix(replay): distinguish timeout from cancel, scale budget with script length, module-level cancel"
```

---

### Task 2: Run = headless replay; Send to Play becomes its own button

**Files:**
- Modify: `app/components/ide/TestScriptPanel.vue`

**Interfaces:**
- Consumes: `useTranscript().run(commands: string[])` (switches activeTab to 'testscript' and fills `turns`), `useIde().sendToPlay(commands: string[])`.

No unit test (component wiring; the repo has no component tests) — verified end-to-end in Task 19.

- [ ] **Step 1: Rewire the handlers**

In `app/components/ide/TestScriptPanel.vue` replace `onRun` (lines 39–41) with:

```ts
function onRun() {
  run(parseScript(activeScript.value?.text ?? ''))
}

function onSendToPlay() {
  sendToPlay(parseScript(activeScript.value?.text ?? ''))
}
```

- [ ] **Step 2: Update the buttons**

Replace the Run/Cancel button pair (lines 77–88) with:

```html
      <UButton
        v-if="!running"
        color="primary"
        size="sm"
        icon="i-lucide-play"
        :disabled="!canPlay || !activeScript"
        :title="canPlay ? 'Replay the script headlessly — each turn\'s output appears below' : 'Compile a clean build first'"
        @click="onRun"
      >
        Run
      </UButton>
      <UButton v-else color="error" size="sm" icon="i-lucide-square" @click="cancel">Cancel</UButton>

      <UButton
        color="neutral" variant="subtle" size="sm" icon="i-lucide-gamepad-2"
        :disabled="!canPlay || !activeScript || running"
        title="Play this script in the live game (the Play tab)"
        @click="onSendToPlay"
      >
        Send to Play
      </UButton>
```

- [ ] **Step 3: Update the empty-state copy**

Replace line 115 (`<p class="text-muted max-w-sm text-sm">Run plays the script…`) with:

```html
        <p class="text-muted max-w-sm text-sm">Run replays the script headlessly and shows each turn's output here. Send to Play runs it in the live game.</p>
```

- [ ] **Step 4: Run tests + typecheck**

Run: `yarn test && yarn typecheck`
Expected: PASS / exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/components/ide/TestScriptPanel.vue
git commit -m "fix(testscript): Run drives the headless replay engine again; Send to Play is a separate action"
```

---

### Task 3: Stop blanking the active script on compile; clear queued Send-to-Play on reset

**Files:**
- Modify: `app/composables/useIde.ts` (resetEphemeral, lines 116–122)
- Modify: `app/composables/useIde.nuxt.test.ts` (reverse the test at lines 273–287)

**Interfaces:**
- Produces: `resetEphemeral()` no longer calls `useTestScripts().select('')`; clears `pendingScript`. Task 4 calls `resetForNewSource()` which builds on this.

- [ ] **Step 1: Reverse the test**

In `app/composables/useIde.nuxt.test.ts` replace the test `'runCompile deselects the active test script (select(""))'` (lines 273–287) with:

```ts
  it('runCompile preserves the active test-script selection', async () => {
    // Regression: resetEphemeral used to select('') on every compile, which
    // persisted activeId='' — after a reload the panel reverted to "Script 1".
    const { add, scripts, select } = useTestScripts()
    add('My Script')
    select(scripts.value[0]!.id)
    const selected = useTestScripts().activeId.value
    expect(selected).not.toBe('')

    const { runCompile } = useIde()
    await runCompile()

    expect(useTestScripts().activeId.value).toBe(selected)
  })

  it('runCompile clears any queued Send-to-Play script', async () => {
    const ide = useIde()
    ide.pendingScript.value = ['look']
    await ide.runCompile()
    expect(ide.pendingScript.value).toBeNull()
  })
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `yarn test useIde`
Expected: FAIL — activeId becomes `''`; pendingScript survives.

- [ ] **Step 3: Implement**

In `app/composables/useIde.ts` replace `resetEphemeral` (lines 112–122) with:

```ts
  /** Blank every ephemeral run artifact: the captured play transcript, the last
   *  script-run output, any queued Send-to-Play commands, the auto-map, and the
   *  Parchment autosave. Shared by a fresh compile and by loading a new source so
   *  nothing from the previous game lingers. Saved scripts — including which one
   *  is selected — are kept: they're per-game (bucketed by activeStoryKey), and
   *  blanking the selection here persisted activeId='' and lost it on reload. */
  function resetEphemeral() {
    usePlayTranscript().reset()
    useTranscript().reset()
    useMap().reset()
    pendingScript.value = null
    clearPlayAutosave()
  }
```

(Note: `pendingScript` is declared at line 88, after the current `resetEphemeral` — move the `resetEphemeral`/`resetForNewSource` function definitions BELOW the `pendingScript` declaration, or rely on function hoisting within the closure; function declarations hoist, so no move is required.)

- [ ] **Step 4: Run tests**

Run: `yarn test useIde && yarn test useTestScripts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useIde.ts app/composables/useIde.nuxt.test.ts
git commit -m "fix(scripts): keep the active test-script selection across compiles; clear queued send-to-play on reset"
```

---

### Task 4: Reset run artifacts on language switch

**Files:**
- Modify: `app/composables/useIde.ts` (restore, lines 90–110; add `lastLang` state)
- Modify: `app/composables/useIde.nuxt.test.ts` (new describe block)

**Interfaces:**
- Consumes: `resetForNewSource()` (Task 3 shape), `useLanguage().profile`.
- Produces: `useState('frotz:last-lang')` tracking the last-mounted language.

- [ ] **Step 1: Write the failing test**

Append to `app/composables/useIde.nuxt.test.ts`:

```ts
describe('useIde — language-switch artifact reset (restore)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useLanguage().setLanguage('i6')
  })

  it('same-language remount keeps compile artifacts (/technical round-trip)', () => {
    const ide = useIde()
    ide.restore()
    setupSuccessResult()
    ide.activeTab.value = 'play'
    ide.restore() // remount, same language
    expect(ide.status.value).toBe('success')
    expect(ide.result.value).not.toBeNull()
  })

  it('switching languages blanks status, result, tab, and queued script', () => {
    const ide = useIde()
    ide.restore() // i6 mount
    setupSuccessResult()
    ide.activeTab.value = 'play'
    ide.pendingScript.value = ['look']

    useLanguage().setLanguage('zil')
    ide.restore() // zil mount

    expect(ide.status.value).toBe('idle')
    expect(ide.result.value).toBeNull()
    expect(ide.activeTab.value).toBe('results')
    expect(ide.pendingScript.value).toBeNull()
  })

  it('switching languages resets an unforced profile/target to auto', () => {
    const ide = useIde()
    ide.restore()
    ide.targetMode.value = 'z4' // in-memory only; nothing persisted for zil
    useLanguage().setLanguage('zil')
    ide.restore()
    expect(ide.targetMode.value).toBe('auto')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn test useIde`
Expected: FAIL — status stays 'success' after switch; targetMode stays 'z4'.

- [ ] **Step 3: Implement**

In `app/composables/useIde.ts`, add with the other `useState` declarations (near line 85):

```ts
  /** Language of the most recent IdeLayout mount — restore() compares against it
   *  so a language switch (and only a language switch) blanks run artifacts. */
  const lastLang = useState<string | null>('frotz:last-lang', () => null)
```

Replace `restore()` (lines 90–110) with:

```ts
  /** Restore the persisted profile mode, then the source recovery snapshot. */
  function restore() {
    if (import.meta.client) {
      // Language switched since the last mount → the compile result, status,
      // right-pane tab, queued script, transcripts, and map all belong to the
      // other language (the shared useState keys are language-agnostic). Blank
      // them BEFORE restoring; same-language remounts (e.g. a /technical
      // round-trip) keep the working state.
      if (lastLang.value !== null && lastLang.value !== profile.value.id) {
        resetForNewSource()
        usedProfile.value = null
      }
      lastLang.value = profile.value.id

      const profileModeKey = buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.profileMode)
      const targetKey = buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.target)
      // No persisted value → 'auto', so the other language's in-memory choice
      // (e.g. a forced z4) doesn't leak into this language's toolbar.
      const saved = localStorage.getItem(profileModeKey)
      profileMode.value = saved === 'auto' || saved === 'std' || saved === 'puny' ? saved : 'auto'
      const t = localStorage.getItem(targetKey)
      targetMode.value =
        t !== null && (t === 'auto' || (profile.value.versionTargets as string[]).includes(t))
          ? (t as 'auto' | StoryExt)
          : 'auto'
    }
    restoreExtensions()
    // Restore source before project files so tab reconciliation runs against the
    // restored source's library profile (not the demo's), keeping library tabs.
    restoreSource()
    restoreProjectFiles()
    // Set the stable story key AFTER source is restored so scripts restore under
    // the right per-game bucket.
    activeStoryKey.value = storyKey.value
    restoreScripts()
  }
```

- [ ] **Step 4: Run tests**

Run: `yarn test useIde`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useIde.ts app/composables/useIde.nuxt.test.ts
git commit -m "fix(state): blank compile artifacts when the IDE language switches (stale I6 game no longer boots inside /zil)"
```

---

### Task 5: Session watchers survive navigation (detached effect scope)

**Files:**
- Modify: `app/composables/useSourceDocument.ts:80-83`
- Modify: `app/composables/useTestScripts.ts:152-158`
- Modify: `app/composables/useMap.ts:105-108`
- Modify: `app/composables/usePlayTranscript.ts:29-35`
- Test: `app/composables/useSourceDocument.watch.nuxt.test.ts` (new)

**Interfaces:**
- Consumes: global `effectScope` (Nuxt auto-import in app code; test stub from Task 0).

- [ ] **Step 1: Write the failing test**

New file `app/composables/useSourceDocument.watch.nuxt.test.ts`:

```ts
/**
 * Autosave-watcher lifetime — the watcher must survive the unmount of the
 * component that first called useSourceDocument() (IdeLayout unmounts on every
 * navigation, e.g. / → /technical). Module state (the `watching` flag) is reset
 * per test via vi.resetModules() + dynamic import.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope } from 'vue'

describe('useSourceDocument — autosave watcher survives component unmount', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('still autosaves after the registering scope is stopped', async () => {
    const { useLanguage } = await import('./useLanguage')
    vi.stubGlobal('useLanguage', useLanguage)
    const { useSourceDocument } = await import('./useSourceDocument')

    // First call happens inside a component-like effect scope…
    const scope = effectScope()
    let source!: ReturnType<typeof useSourceDocument>['source']
    scope.run(() => {
      source = useSourceDocument().source
    })
    // …which is then disposed (component unmounted on navigation).
    scope.stop()

    source.value = 'Constant Story "After Nav";'
    const { nextTick } = await import('vue')
    await nextTick() // let the (pre-flush) watcher callback run
    vi.advanceTimersByTime(1100) // debounce

    const raw = localStorage.getItem('frotzsmith:i6:recovery')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).source).toContain('After Nav')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn test useSourceDocument.watch`
Expected: FAIL — `raw` is null (watcher died with the scope).

- [ ] **Step 3: Implement in all four composables**

`app/composables/useSourceDocument.ts` (lines 80–83):

```ts
  if (import.meta.client && !watching) {
    watching = true
    // Detached scope: the first caller is a component (IdeLayout), and a bare
    // watch() would bind to its effect scope and die on unmount (any navigation)
    // while `watching` stays true — silently killing autosave for the session.
    effectScope(true).run(() => watch(source, scheduleSave))
  }
```

`app/composables/useTestScripts.ts` (lines 152–158):

```ts
  if (import.meta.client && !watching) {
    watching = true
    // Detached scope so these session-long watchers survive component unmount
    // (see useSourceDocument for the failure mode).
    effectScope(true).run(() => {
      watch(buckets, persist, { deep: true })
      watch(activeStoryKey, newKey => {
        ensureBucket(newKey)
      })
    })
  }
```

`app/composables/useMap.ts` (lines 105–108) — keep the existing comment block, change the registration:

```ts
  if (import.meta.client && !mapWatchRegistered) {
    mapWatchRegistered = true
    // Detached scope so the watcher survives component unmount (session-long).
    effectScope(true).run(() => watch(activeStoryKey, reset))
  }
```

`app/composables/usePlayTranscript.ts` (lines 29–35):

```ts
  if (import.meta.client && !playTranscriptWatchRegistered) {
    playTranscriptWatchRegistered = true
    // Detached scope so the watcher survives component unmount (session-long).
    effectScope(true).run(() => {
      const { activeStoryKey } = useIde()
      watch(activeStoryKey, () => {
        commands.value = []
      })
    })
  }
```

- [ ] **Step 4: Run the full suite**

Run: `yarn test`
Expected: PASS (new test + all existing).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useSourceDocument.ts app/composables/useTestScripts.ts app/composables/useMap.ts app/composables/usePlayTranscript.ts app/composables/useSourceDocument.watch.nuxt.test.ts
git commit -m "fix(state): register session watchers in detached effect scopes so navigation can't kill autosave/bucket/map resets"
```

---

### Task 6: Symmetric i6 seed on restore (zil → i6 navigation)

**Files:**
- Modify: `app/composables/useSourceDocument.ts:38-61`
- Modify: `app/composables/useSourceDocument.nuxt.test.ts` (new case)

- [ ] **Step 1: Write the failing test**

Append to the describe block in `app/composables/useSourceDocument.nuxt.test.ts`:

```ts
  it('seeds the I6 demo via restore() when navigating from zil to i6', () => {
    // Session starts on /zil/ (shared link): factory seeds the ZIL skeleton.
    useLanguage().setLanguage('zil')
    const zil = useSourceDocument()
    expect(zil.source.value).toContain('WEST-OF-HOUSE')

    // Navigate to / — IdeLayout remounts and calls restore() with no i6 snapshot.
    useLanguage().setLanguage('i6')
    const { source, restore } = useSourceDocument()
    restore()
    expect(source.value).toContain('Constant Story')
    expect(source.value).not.toContain('WEST-OF-HOUSE')
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn test useSourceDocument.nuxt`
Expected: FAIL — source still contains WEST-OF-HOUSE.

- [ ] **Step 3: Implement**

In `app/composables/useSourceDocument.ts`, replace the `restore()` else-branch (lines 48–57) with a symmetric seed:

```ts
      } else {
        // No snapshot for this language: seed its starter. The useState factory
        // only runs once per session, so after navigating between /zil/ and /
        // `source` still holds the OTHER language's text — both directions need
        // the explicit reseed (a zil-only branch here once leaked the ZIL
        // skeleton into the I6 editor, where autosave then persisted it).
        source.value = profile.value.id === 'zil' ? zilSkeletonSource : demoSource
        savedAt.value = null
      }
```

- [ ] **Step 4: Run tests**

Run: `yarn test useSourceDocument`
Expected: PASS (all cases, including the pre-existing i6→zil one).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useSourceDocument.ts app/composables/useSourceDocument.nuxt.test.ts
git commit -m "fix(state): reseed the language default on restore in BOTH directions (zil source no longer leaks into the I6 editor)"
```

---

### Task 7: Empty-storage restore must reset, not inherit, cross-language state

**Files:**
- Modify: `app/composables/useTestScripts.ts:89-103`
- Modify: `app/composables/useExtensions.ts:34-52`
- Modify: `app/composables/useProjectFiles.ts:119-137`
- Test: `app/composables/useCrossLanguageRestore.nuxt.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

New file `app/composables/useCrossLanguageRestore.nuxt.test.ts`:

```ts
/**
 * restore() with EMPTY storage for the target language must reset in-memory
 * state to that language's defaults — not keep (and then persist) the previous
 * language's scripts / uploads / open tabs under the new language's keys.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLanguage } from './useLanguage'
import { useSourceDocument } from './useSourceDocument'
import { useExtensions } from './useExtensions'
import { useTestScripts } from './useTestScripts'
import { useProjectFiles } from './useProjectFiles'

vi.stubGlobal('useLanguage', useLanguage)
vi.stubGlobal('useSourceDocument', useSourceDocument)
vi.stubGlobal('useExtensions', useExtensions)

describe('cross-language restore with empty storage', () => {
  beforeEach(() => {
    localStorage.clear()
    useLanguage().setLanguage('i6')
  })

  it('scripts: zil restore does not inherit i6 buckets', () => {
    const i6 = useTestScripts()
    i6.restore()
    i6.addFromText('Playthrough 1', 'look\nnorth\n')
    expect(i6.scripts.value.some(s => s.name === 'Playthrough 1')).toBe(true)

    useLanguage().setLanguage('zil')
    const zil = useTestScripts()
    zil.restore()
    expect(zil.scripts.value.some(s => s.name === 'Playthrough 1')).toBe(false)
    // And nothing i6 was persisted under the zil key.
    const zilRaw = localStorage.getItem('frotzsmith:zil:scripts')
    expect(zilRaw ?? '').not.toContain('Playthrough 1')
  })

  it('extensions: zil restore does not inherit i6 uploads', () => {
    const i6 = useExtensions()
    i6.addUploaded('ordinals.h', '! ext')
    expect(i6.uploaded.value.length).toBe(1)

    useLanguage().setLanguage('zil')
    const zil = useExtensions()
    zil.restore()
    expect(zil.uploaded.value.length).toBe(0)
    expect(zil.enabledFiles.value.length).toBe(0)
  })

  it('project files: zil restore does not inherit i6 open tabs', () => {
    const i6 = useProjectFiles()
    i6.openFile('lib:Parser.h')
    expect(i6.openTabs.value.some(t => t.id === 'lib:Parser.h')).toBe(true)

    useLanguage().setLanguage('zil')
    const zil = useProjectFiles()
    zil.restore()
    expect(zil.openTabs.value.map(t => t.id)).toEqual(['source'])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn test useCrossLanguageRestore`
Expected: FAIL on all three (state inherited).

- [ ] **Step 3: Implement**

`app/composables/useTestScripts.ts` — replace `restore()` (lines 89–103):

```ts
  function restore() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(getKey())
      // No stored value for this language → start empty, so the previous
      // language's in-memory buckets don't leak into (and get persisted under)
      // this language's key on the next write.
      buckets.value = raw
        ? (migrateScriptStore(JSON.parse(raw) as unknown, activeStoryKey.value).buckets as Record<string, Bucket>)
        : {}
    } catch {
      // corrupt — ignore, start empty
      buckets.value = {}
    }
    ensureBucket(activeStoryKey.value)
  }
```

`app/composables/useExtensions.ts` — replace `restore()` (lines 34–52):

```ts
  function restore() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(getKey())
      if (!raw) {
        // No stored value for this language → reset, so the other language's
        // uploads/enabled set don't leak into this language (or its compiles).
        uploaded.value = []
        enabledIds.value = []
        return
      }
      const data = JSON.parse(raw) as { uploaded?: Extension[]; enabled?: string[] }
      uploaded.value = Array.isArray(data.uploaded)
        ? data.uploaded.map(u => ({
            ...u,
            description: 'Uploaded extension.',
            library: 'any' as const,
            origin: 'uploaded' as const,
          }))
        : []
      enabledIds.value = Array.isArray(data.enabled) ? data.enabled : []
    } catch {
      // corrupt — start clean
      uploaded.value = []
      enabledIds.value = []
    }
  }
```

`app/composables/useProjectFiles.ts` — replace `restore()` (lines 119–137):

```ts
  function restore() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(getKey())
      if (!raw) {
        // No stored value for this language → default tab state; the previous
        // language's open tabs reference files that don't exist here.
        tabs.value = { activeId: 'source', openTabs: ['source'] }
        return
      }
      const data = JSON.parse(raw) as { open?: boolean; activeId?: string; openTabs?: string[] }
      if (typeof data.open === 'boolean') panelOpen.value = data.open
      tabs.value = reconcileOpen(
        {
          activeId: data.activeId ?? 'source',
          openTabs: Array.isArray(data.openTabs) ? data.openTabs : ['source'],
        },
        validIds.value,
      )
    } catch {
      // corrupt — start clean
      tabs.value = { activeId: 'source', openTabs: ['source'] }
    }
  }
```

- [ ] **Step 4: Run the full suite**

Run: `yarn test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useTestScripts.ts app/composables/useExtensions.ts app/composables/useProjectFiles.ts app/composables/useCrossLanguageRestore.nuxt.test.ts
git commit -m "fix(state): empty-storage restore resets scripts/extensions/tabs instead of inheriting the other language's"
```

---

### Task 8: Failed lazy WASM boots retry instead of caching the rejection

**Files:**
- Create: `app/utils/cached-async.ts`
- Test: `app/utils/cached-async.test.ts`
- Modify: `app/composables/useCompilerWasm.ts:8-40`
- Modify: `app/composables/useZilfWasm.ts:224-265`
- Modify: `app/modules/zil/zilf.worker.ts` (bootPromise site)

**Interfaces:**
- Produces: `cachedAsync<T>(loader: () => Promise<T>): () => Promise<T>` — caches the in-flight/settled promise, clears the cache on rejection so the next call retries.

- [ ] **Step 1: Write the failing tests**

New file `app/utils/cached-async.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { cachedAsync } from './cached-async'

describe('cachedAsync', () => {
  it('caches a successful load (loader runs once)', async () => {
    const loader = vi.fn().mockResolvedValue('ok')
    const get = cachedAsync(loader)
    await expect(get()).resolves.toBe('ok')
    await expect(get()).resolves.toBe('ok')
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('shares one in-flight promise across concurrent callers', async () => {
    let resolveIt!: (v: string) => void
    const loader = vi.fn(() => new Promise<string>(r => (resolveIt = r)))
    const get = cachedAsync(loader)
    const a = get()
    const b = get()
    resolveIt('done')
    await expect(a).resolves.toBe('done')
    await expect(b).resolves.toBe('done')
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('clears the cache on rejection so the next call retries', async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce('recovered')
    const get = cachedAsync(loader)
    await expect(get()).rejects.toThrow('network blip')
    await expect(get()).resolves.toBe('recovered')
    expect(loader).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn test cached-async`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the util**

New file `app/utils/cached-async.ts`:

```ts
/**
 * Lazily run `loader` once and cache the promise — but clear the cache when it
 * rejects, so a transient failure (e.g. a network blip fetching a WASM bundle
 * on first compile) doesn't permanently brick every later call for the session.
 */
export function cachedAsync<T>(loader: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | null = null
  return () => {
    if (!cached) {
      cached = loader()
      // Side-branch handler: clears the cache without swallowing the rejection
      // for callers awaiting `cached` itself.
      cached.catch(() => {
        cached = null
      })
    }
    return cached
  }
}
```

- [ ] **Step 4: Adopt it in the three boot sites**

`app/composables/useCompilerWasm.ts` — replace lines 8–10 and `getFactory` (lines 29–40):

```ts
import { cachedAsync } from '~/utils/cached-async'

// The factory is loaded once (lazily) and cached; instances are created per
// compile. A failed load clears the cache so the next compile retries.
const getFactory = cachedAsync(() =>
  import('~/modules/inform6/wasm/inform6.mjs').then(
    m => m.default as (opts?: Record<string, unknown>) => Promise<Inform6Instance>,
  ),
)
```

and in `useCompilerWasm()` delete the old inner `getFactory` and keep `createInstance` calling the module-level `getFactory()`.

`app/composables/useZilfWasm.ts` — replace `_mainThreadBootPromise` and `getMainThreadExports` (lines 224–265) with:

```ts
import { cachedAsync } from '~/utils/cached-async'   // add to the file's imports

/**
 * Boot the .NET WASM ZILF runtime on the main thread (once) and return the
 * cached assembly exports. Mirror of the boot sequence in zilf.worker.ts.
 * cachedAsync clears the cache on a failed boot so the next compile retries.
 */
const getMainThreadExports = cachedAsync(async (): Promise<ZilfExportCache> => {
  // Bypass Vite's import-analysis URL rewriting (?import) so the external,
  // non-Vite dotnet.js loads unprocessed in dev AND prod.  The Function
  // constructor hides the import from Vite's static analyzer so it cannot
  // rewrite the URL.  The app's CSP already allows unsafe-eval (ZVM JIT).
  const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<unknown>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const mod = await dynamicImport('/zilf/_framework/dotnet.js')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const { dotnet } = mod as {
    dotnet: { withApplicationArguments(): { create(): Promise<unknown> } }
  }
  const runtime = await (
    dotnet.withApplicationArguments() as {
      create(): Promise<Record<string, unknown>>
    }
  ).create()
  const r = runtime as {
    getConfig(): { mainAssemblyName: string }
    getAssemblyExports(name: string): Promise<unknown>
  }
  const config = r.getConfig()
  return (await r.getAssemblyExports(config.mainAssemblyName)) as ZilfExportCache
})
```

Delete the now-unused `_mainThreadExports` variable (the promise cache subsumes it).

`app/modules/zil/zilf.worker.ts` — find the `bootPromise` cache (around line 38) and apply the same clear-on-reject pattern inline (the worker can't import app utils cheaply if its bundle is kept minimal — match whichever import style the file already uses; if it already imports from `~/`, use `cachedAsync` there too, otherwise):

```ts
    bootPromise.catch(() => {
      bootPromise = null
    })
```

immediately after the assignment that creates it.

- [ ] **Step 5: Run tests + typecheck**

Run: `yarn test && yarn typecheck`
Expected: PASS (including `useZilfWasm.lazy.test.ts`'s repeated-compile case, which exercises the failed main-thread boot twice — it now retries instead of re-throwing the cached rejection, still resolving `ok:false`).

- [ ] **Step 6: Commit**

```bash
git add app/utils/cached-async.ts app/utils/cached-async.test.ts app/composables/useCompilerWasm.ts app/composables/useZilfWasm.ts app/modules/zil/zilf.worker.ts
git commit -m "fix(compile): clear failed WASM boot caches so one network blip can't brick compiling for the session"
```

---

### Task 9: I6 source is UTF-8 (-Cu) and WASM traps surface as diagnostics

**Files:**
- Modify: `app/modules/languages/i6/profile.ts:69-101`
- Test: `app/modules/languages/i6/profile.crash.test.ts` (new, node env)
- Modify: `app/modules/inform6/compiler.golden.test.ts` (one new case)

- [ ] **Step 1: Write the failing tests**

New file `app/modules/languages/i6/profile.crash.test.ts`:

```ts
/**
 * A raw WASM trap (not Emscripten's ExitStatus) during callMain must surface as
 * a fatal diagnostic — previously it was swallowed and the compile failed with
 * zero diagnostics anywhere in the UI.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('~/composables/useCompilerWasm', () => ({
  useCompilerWasm: () => ({
    createInstance: async () => ({
      FS: {
        mkdir: () => {},
        writeFile: () => {},
        chdir: () => {},
        readFile: () => {
          throw new Error('no output')
        },
      },
      callMain: () => {
        const e = new Error('table index is out of bounds')
        e.name = 'RuntimeError' // WebAssembly trap, not ExitStatus
        throw e
      },
    }),
  }),
}))

describe('I6_PROFILE.compile — WASM trap surfacing', () => {
  it('reports the trap as a fatal diagnostic instead of failing silently', async () => {
    const { I6_PROFILE } = await import('./profile')
    const result = await I6_PROFILE.compile('Constant Story "X";', { profileId: 'std', ext: 'z5' })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some(d => d.severity === 'fatal' && d.message.includes('table index'))).toBe(true)
  })
})
```

In `app/modules/inform6/compiler.golden.test.ts`, add a case inside the existing describe (matching its compile-helper idiom — read the file's helper first and reuse it):

```ts
  it('compiles non-ASCII source cleanly (-Cu: editor text is UTF-8)', async () => {
    const source = 'Constant Story "Café";\nInclude "Parser";\nInclude "VerbLib";\n' +
      '[ Initialise; location = Cafe; print "café déjà vu^"; ];\n' +
      'Object Cafe "Café" with description "Um café.", has light;\n' +
      'Include "Grammar";\n'
    // (Accented Latin-1 chars only — no em-dash etc.; those need a Zcharacter
    // declaration in z5 and would fail the compile for an unrelated reason.)
    const result = await I6_PROFILE.compile(source, { profileId: 'std', ext: 'z5' })
    expect(result.ok).toBe(true)
    expect(result.rawStderr).not.toMatch(/unknown option|bad option/i)
  })
```

(Adapt the exact compile invocation to the file's existing helper if it wraps `I6_PROFILE.compile` differently.)

- [ ] **Step 2: Run to verify failure**

Run: `yarn test profile.crash`
Expected: FAIL — diagnostics array is empty.

- [ ] **Step 3: Implement**

In `app/modules/languages/i6/profile.ts`, replace lines 69–101 (`const outName` through the return) with:

```ts
    const outName = `story.${ext}`
    let crash: string | null = null
    try {
      m.callMain([
        `+include_path=${libProfile.includePath}`,
        '-s', // emit statistics (story size, memory use) for the stats bar
        // FS.writeFile encodes the editor string as UTF-8; without -Cu Inform
        // reads ISO-8859-1 and non-ASCII prose silently mojibakes in-game.
        '-Cu',
        VERSION_SWITCH[ext]!,
        'story.inf',
        outName,
      ])
    } catch (e) {
      // Emscripten throws ExitStatus for ordinary non-zero exits — the parsed
      // diagnostics carry that detail. Anything else is a real crash (e.g. a
      // WASM RuntimeError trap) and must not vanish.
      const name = (e as { name?: string } | null)?.name
      if (name !== 'ExitStatus') crash = String(e)
    }

    const raw = out.join('\n')
    const { diagnostics, errorCount } = parseDiagnostics(raw)
    if (crash) diagnostics.push({ severity: 'fatal', message: `Compiler crashed: ${crash}` })

    let storyFile: Uint8Array | undefined
    try {
      storyFile = m.FS.readFile(`/work/${outName}`)
    } catch {
      // no output produced
    }

    return {
      ok: errorCount === 0 && !crash && !!storyFile,
      storyFile,
      storyExt: ext,
      diagnostics,
      rawStderr: raw,
      ms: Math.round(performance.now() - started),
      byteLength: storyFile?.length ?? 0,
      stats: parseStats(raw),
    }
```

- [ ] **Step 4: Run tests**

Run: `yarn test profile && yarn test golden`
Expected: PASS (golden hashes unchanged for existing cases — `-Cu` does not alter ASCII-only compiles' output; if a golden hash DOES change, re-verify why before re-pinning).

- [ ] **Step 5: Commit**

```bash
git add app/modules/languages/i6/profile.ts app/modules/languages/i6/profile.crash.test.ts app/modules/inform6/compiler.golden.test.ts
git commit -m "fix(i6): compile source as UTF-8 (-Cu) and surface WASM traps as fatal diagnostics"
```

---

### Task 10: Compile paint guarantee + post-freeze click debounce + disabled buttons

**Files:**
- Modify: `app/composables/useIde.ts:135-157` (runCompile)
- Modify: `app/components/ide/TitleStrip.vue` and `app/components/ide/ResultsPanel.vue` (Compile buttons get `:disabled`)
- Modify: `app/composables/useIde.nuxt.test.ts` (debounce test)

- [ ] **Step 1: Write the failing test**

Append to the runCompile describe in `app/composables/useIde.nuxt.test.ts`:

```ts
  it('runCompile ignores a second call within 500ms of completion (queued freeze click)', async () => {
    const { runCompile } = useIde()
    await runCompile()
    expect(_compileMock).toHaveBeenCalledTimes(1)
    await runCompile() // dispatched immediately after — e.g. a click queued during a main-thread freeze
    expect(_compileMock).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn test useIde`
Expected: FAIL — compile called twice.

- [ ] **Step 3: Implement runCompile changes**

In `app/composables/useIde.ts`, add near `lastLang` (Task 4):

```ts
  /** performance.now() at the end of the last compile — debounces clicks that
   *  were queued during a main-thread compile freeze (they dispatch AFTER the
   *  freeze, when status is no longer 'compiling'). */
  const lastCompileEnd = useState<number>('frotz:last-compile-end', () => 0)
```

Add this helper above `runCompile`:

```ts
  /** Two rAFs = a guaranteed paint opportunity (setTimeout(0) is not), so
   *  "Compiling…" is actually on screen before a long synchronous main-thread
   *  compile (ZIL: ~5-9s) blocks the thread. */
  function nextPaint(): Promise<void> {
    return new Promise(resolve => {
      if (!import.meta.client || typeof requestAnimationFrame === 'undefined') return resolve()
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  }
```

Replace `runCompile` with:

```ts
  async function runCompile() {
    if (status.value === 'compiling') return
    if (import.meta.client && lastCompileEnd.value > 0 && performance.now() - lastCompileEnd.value < 500) return
    status.value = 'compiling'
    // Fresh build → blank the prior game's artifacts (first room on next Play).
    resetEphemeral()
    activeTab.value = 'results'
    const pid = effectiveProfile.value
    await nextPaint()
    try {
      const r = await compile(source.value, {
        profileId: pid,
        ext: effectiveExt.value,
        extensions: enabledFiles.value,
      })
      result.value = r
      usedProfile.value = pid
      status.value = r.ok ? 'success' : 'error'
    } catch {
      result.value = null
      usedProfile.value = pid
      status.value = 'error'
    } finally {
      if (import.meta.client) lastCompileEnd.value = performance.now()
    }
  }
```

- [ ] **Step 4: Disable the Compile buttons while compiling**

Read `app/components/ide/TitleStrip.vue` and `app/components/ide/ResultsPanel.vue`, locate each Compile `UButton`, ensure the component destructures `status` from `useIde()`, and add to the button:

```html
:disabled="status === 'compiling'"
```

(If a button already carries a `:disabled`, OR the condition in.)

- [ ] **Step 5: Run tests + typecheck**

Run: `yarn test useIde && yarn typecheck`
Expected: PASS / exit 0. (happy-dom provides requestAnimationFrame; awaited runCompile tests keep working.)

- [ ] **Step 6: Commit**

```bash
git add app/composables/useIde.ts app/components/ide/TitleStrip.vue app/components/ide/ResultsPanel.vue app/composables/useIde.nuxt.test.ts
git commit -m "fix(compile): guarantee the Compiling paint before main-thread compiles and debounce freeze-queued clicks"
```

---

### Task 11: Map fit stops over-zooming tiny maps

**Files:**
- Modify: `app/composables/map-graph.ts` (add `fitViewBox`)
- Modify: `app/components/ide/MapPanel.vue:38-47` (use it)
- Modify: `app/composables/map-graph.test.ts` (new cases)

**Interfaces:**
- Produces: `fitViewBox(bounds, opts): { x; y; w; h }` exported from map-graph.ts.

- [ ] **Step 1: Write the failing tests**

Append to `app/composables/map-graph.test.ts`:

```ts
describe('fitViewBox', () => {
  const opts = { cell: 120, roomW: 96, roomH: 48, pad: 60, minW: 360 }

  it('clamps a single-room map to the minimum width, centred on the room', () => {
    const vb = fitViewBox({ minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 }, opts)
    expect(vb.w).toBe(360)
    expect(vb.x + vb.w / 2).toBeCloseTo(0)
    expect(vb.y + vb.h / 2).toBeCloseTo(0)
    // Height scales by the same factor so aspect is preserved.
    expect(vb.h).toBeCloseTo(168 * (360 / 216))
  })

  it('leaves larger maps exactly at bounds + padding', () => {
    const vb = fitViewBox({ minCol: 0, maxCol: 10, minRow: 0, maxRow: 5 }, opts)
    expect(vb.w).toBe(10 * 120 + 96 + 120)
    expect(vb.h).toBe(5 * 120 + 48 + 120)
    expect(vb.x).toBe(-48 - 60)
  })
})
```

with `fitViewBox` added to the file's import from `'./map-graph'`.

- [ ] **Step 2: Run to verify failure**

Run: `yarn test map-graph`
Expected: FAIL — `fitViewBox` not exported.

- [ ] **Step 3: Implement**

Append to `app/composables/map-graph.ts`:

```ts
export interface FitViewBox {
  x: number
  y: number
  w: number
  h: number
}

/**
 * The SVG viewBox that fits `bounds` with padding — clamped to a minimum width
 * so a tiny map (one or two rooms) doesn't zoom a single room box up to fill
 * the whole pane. Clamping keeps the fitted centre and the aspect ratio.
 */
export function fitViewBox(
  bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number },
  opts: { cell: number; roomW: number; roomH: number; pad: number; minW: number },
): FitViewBox {
  const { cell, roomW, roomH, pad, minW } = opts
  let x = bounds.minCol * cell - roomW / 2 - pad
  let y = bounds.minRow * cell - roomH / 2 - pad
  let w = (bounds.maxCol - bounds.minCol) * cell + roomW + pad * 2
  let h = (bounds.maxRow - bounds.minRow) * cell + roomH + pad * 2
  if (w < minW) {
    const scale = minW / w
    const cx = x + w / 2
    const cy = y + h / 2
    w = minW
    h = h * scale
    x = cx - w / 2
    y = cy - h / 2
  }
  return { x, y, w, h }
}
```

In `app/components/ide/MapPanel.vue`, import it (script setup already imports from `'~/composables/map-graph'` — extend that import with `fitViewBox`), add a constant near `MIN_W`/`MAX_W`:

```ts
/** Fit never zooms tighter than ~3 cells across — a 1-room map stays room-sized. */
const MIN_FIT_W = CELL * 3
```

and replace `fitView()` (lines 39–47) with:

```ts
/** Set the viewBox to show all rooms with padding (the "fit" state). */
function fitView() {
  const vb = fitViewBox(layout.value.bounds, {
    cell: CELL, roomW: ROOM_W, roomH: ROOM_H, pad: PAD, minW: MIN_FIT_W,
  })
  view.value = vb
  baseW.value = vb.w
}
```

- [ ] **Step 4: Run tests**

Run: `yarn test map-graph && yarn typecheck`
Expected: PASS / exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/composables/map-graph.ts app/composables/map-graph.test.ts app/components/ide/MapPanel.vue
git commit -m "fix(map): clamp fit zoom so a one-room map renders room-sized, not pane-sized"
```

---

### Task 12: Map SVG semantics — no interactive roles inside an image

**Files:**
- Modify: `app/components/ide/MapPanel.vue:397-486`

- [ ] **Step 1: Fix the outer SVG role**

Change the `<svg>` attrs (lines 403–404) from `role="img"` to:

```html
        role="group"
        :aria-label="`Map: ${layout.rooms.length} rooms`"
```

(`group` permits both the label and focusable descendants; `img` declared every descendant presentational while containing "buttons".)

- [ ] **Step 2: Fix the room groups**

The room `<g>` elements (lines 474–486) keep `tabindex="0"` (focus opens the detail popover — that's their real behavior) but drop the false `role="button"` (no Enter/Space action exists). Replace:

```html
          tabindex="0"
          role="button"
          :aria-label="`Room ${r.name}`"
```

with:

```html
          tabindex="0"
          role="img"
          :aria-label="`Room ${r.name}${r.name === currentRoom ? ' (current room)' : ''}`"
```

(A labelled graphic that shows details on focus; `img` allows `aria-label`, and there is no interactive role nested inside the outer group. The sr-only room list remains the primary AT surface.)

- [ ] **Step 3: Verify + commit**

Run: `yarn typecheck`
Expected: exit 0.

```bash
git add app/components/ide/MapPanel.vue
git commit -m "fix(a11y): coherent map SVG semantics (group of labelled room graphics, no fake buttons)"
```

---

### Task 13: RightPaneTabs — named icon-only tabs + full tabs pattern

**Files:**
- Modify: `app/components/ide/RightPaneTabs.vue` (whole file, shown below)

- [ ] **Step 1: Replace the component**

New content for `app/components/ide/RightPaneTabs.vue`:

```vue
<script setup lang="ts">
import type { RightTab } from '~/composables/useIde'

const { activeTab, status } = useIde()

const tabs: { id: RightTab; label: string; icon: string }[] = [
  { id: 'results', label: 'Results', icon: 'i-lucide-clipboard-list' },
  { id: 'play', label: 'Play', icon: 'i-lucide-gamepad-2' },
  { id: 'transcript', label: 'Transcript', icon: 'i-lucide-history' },
  { id: 'testscript', label: 'Test Script', icon: 'i-lucide-scroll-text' },
  { id: 'map', label: 'Map', icon: 'i-lucide-map' },
]

// Arrow-key navigation + focus-follows-selection (ARIA tabs pattern), mirroring
// EditorTabs. currentTarget is captured before the await — it nulls after dispatch.
async function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  const ids = tabs.map(t => t.id)
  const i = ids.indexOf(activeTab.value)
  if (i === -1) return
  const next = event.key === 'ArrowRight' ? ids[i + 1] ?? ids[0] : ids[i - 1] ?? ids[ids.length - 1]
  if (!next) return
  event.preventDefault()
  const tablist = event.currentTarget as HTMLElement
  activeTab.value = next
  await nextTick()
  tablist.querySelector<HTMLElement>(`#rtab-${next}`)?.focus()
}
</script>

<template>
  <div class="flex h-full flex-col">
    <TitleStrip actions />

    <!-- Header: tabs only — Compile/Play live in the title bar (TitleStrip). -->
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-default px-2 py-2">
      <div class="flex items-center gap-1">
        <div role="tablist" aria-label="Output panels" class="flex gap-1" @keydown="onKeydown">
          <button
            v-for="t in tabs"
            :key="t.id"
            :id="`rtab-${t.id}`"
            role="tab"
            :aria-selected="activeTab === t.id"
            :aria-label="t.label"
            aria-controls="right-tabpanel"
            :tabindex="activeTab === t.id ? 0 : -1"
            type="button"
            :class="[
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
              activeTab === t.id
                ? 'bg-elevated text-default'
                : 'text-muted hover:bg-elevated/60 hover:text-default',
            ]"
            @click="activeTab = t.id"
          >
            <UIcon :name="t.icon" class="size-4" />
            <span class="hidden sm:inline">{{ t.label }}</span>
            <span
              v-if="t.id === 'results' && status === 'error'"
              class="size-2 rounded-full bg-error"
              aria-hidden="true"
            />
            <span
              v-else-if="t.id === 'results' && status === 'success'"
              class="size-2 rounded-full bg-success"
              aria-hidden="true"
            />
            <span v-if="t.id === 'results' && (status === 'error' || status === 'success')" class="sr-only">
              {{ status === 'error' ? '— compile failed' : '— compiled cleanly' }}
            </span>
          </button>
        </div>

      </div>

    </div>

    <div id="right-tabpanel" role="tabpanel" :aria-labelledby="`rtab-${activeTab}`" class="min-h-0 flex-1">
      <PlayPanel v-show="activeTab === 'play'" />
      <ResultsPanel v-if="activeTab === 'results'" />
      <TranscriptPanel v-else-if="activeTab === 'transcript'" />
      <TestScriptPanel v-else-if="activeTab === 'testscript'" />
      <MapPanel v-else-if="activeTab === 'map'" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Verify + commit**

Run: `yarn typecheck && yarn test`
Expected: exit 0 / PASS.

```bash
git add app/components/ide/RightPaneTabs.vue
git commit -m "fix(a11y): right-pane tabs get accessible names, tabpanel wiring, roving tabindex and arrow keys"
```

---

### Task 14: EditorTabs — close affordance without nested-interactive

**Files:**
- Modify: `app/components/ide/EditorTabs.vue`

- [ ] **Step 1: Replace the close button with a pointer-only affordance + Delete key**

In the `<script setup>` add after `onKeydown`:

```ts
// Delete/Backspace closes the focused closable tab (the visible × is pointer-only:
// a focusable button nested inside role="tab" is an axe nested-interactive violation).
async function onCloseKey(event: KeyboardEvent, id: string) {
  if (id === 'source') return
  event.preventDefault()
  const tablist = (event.currentTarget as HTMLElement).closest('[role="tablist"]') as HTMLElement | null
  closeTab(id)
  await nextTick()
  tablist?.querySelector<HTMLElement>(`[data-tab-id="${activeId.value}"]`)?.focus()
}
```

On the tab `<div role="tab">` add:

```html
      :aria-keyshortcuts="tab.id !== 'source' ? 'Delete' : undefined"
      @keydown.delete="onCloseKey($event, tab.id)"
      @keydown.backspace="onCloseKey($event, tab.id)"
```

Replace the close `<button>` (lines 57–65) with:

```html
      <span
        v-if="tab.id !== 'source'"
        aria-hidden="true"
        :title="`Close ${tab.name} (Delete)`"
        class="ml-1 cursor-pointer rounded p-0.5 opacity-50 hover:bg-error/15 hover:text-error hover:opacity-100"
        @click.stop="closeTab(tab.id)"
      >
        <UIcon name="i-lucide-x" class="size-3" />
      </span>
```

- [ ] **Step 2: Verify + commit**

Run: `yarn typecheck`
Expected: exit 0.

```bash
git add app/components/ide/EditorTabs.vue
git commit -m "fix(a11y): editor tab close is pointer-only + Delete key — no focusable control nested in role=tab"
```

---

### Task 15: Landmark, mobile switcher state, reduced motion

**Files:**
- Modify: `app/components/ide/IdeLayout.vue:75-128`
- Modify: `app/pages/technical.vue` (wrap content in `<main>` if it lacks one)
- Modify: `app/assets/css/main.css`

- [ ] **Step 1: `<main>` landmark in IdeLayout**

Change the two-pane shell wrapper (line 99) from `<div class="flex min-h-0 flex-1">` to `<main class="flex min-h-0 flex-1">` (and its closing tag at line 128).

- [ ] **Step 2: Mobile switcher conveys state**

Add to each of the two mobile switch buttons (lines 76–95): `:aria-pressed="mobileView === 'editor'"` on the Source button, `:aria-pressed="mobileView === 'output'"` on the Output button.

- [ ] **Step 3: technical.vue landmark**

Read `app/pages/technical.vue`; if its top-level template element is not `<main>` (or doesn't contain one), wrap the page content in `<main>` preserving existing classes.

- [ ] **Step 4: Reduced motion**

Append to `app/assets/css/main.css`:

```css
/* WCAG 2.3.3 / prefers-reduced-motion: collapse decorative animation and
   transitions for users who ask for it. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 5: Verify + commit**

Run: `yarn typecheck`
Expected: exit 0.

```bash
git add app/components/ide/IdeLayout.vue app/pages/technical.vue app/assets/css/main.css
git commit -m "fix(a11y): main landmark, aria-pressed mobile pane switch, prefers-reduced-motion"
```

---

### Task 16: Per-route canonical + og:url; refresh stale OG copy

**Files:**
- Modify: `nuxt.config.ts:57-83`
- Modify: `app/pages/index.vue`, `app/pages/zil.vue`, `app/pages/technical.vue`

- [ ] **Step 1: Remove the global canonical, fix stale copy**

In `nuxt.config.ts`:
- Delete the `{ rel: 'canonical', href: `${SITE_URL}/` }` entry from `link` (line 82).
- Replace both stale descriptions (og:description line 62 and twitter:description line 74) with: `'Write, compile, and play interactive fiction entirely in your browser — Inform 6 and ZIL.'`
- Leave the global `og:url` as the site default (pages override it by property dedupe).

- [ ] **Step 2: Add per-page head entries**

`app/pages/index.vue` script setup becomes:

```ts
import { frotzsmith } from '~~/frotzsmith.config'

const { setLanguage, profile } = useLanguage()
setLanguage('i6')
useHead({
  title: 'Frotzsmith — Inform 6 IDE',
  link: [{ rel: 'canonical', href: `${frotzsmith.siteUrl}/` }],
  meta: [{ property: 'og:url', content: `${frotzsmith.siteUrl}/` }],
})
```

`app/pages/zil.vue` — same shape with `'Frotzsmith — ZIL IDE'` and `` `${frotzsmith.siteUrl}/zil/` ``.

`app/pages/technical.vue` — add to its existing script setup (create `useHead` call if absent, preserving any existing title):

```ts
import { frotzsmith } from '~~/frotzsmith.config'
useHead({
  link: [{ rel: 'canonical', href: `${frotzsmith.siteUrl}/technical/` }],
  meta: [{ property: 'og:url', content: `${frotzsmith.siteUrl}/technical/` }],
})
```

- [ ] **Step 3: Verify + commit**

Run: `yarn typecheck`
Expected: exit 0.

```bash
git add nuxt.config.ts app/pages/index.vue app/pages/zil.vue app/pages/technical.vue
git commit -m "fix(seo): per-route canonical and og:url; drop stale 'ZIL coming' copy"
```

---

### Task 17: Zip decompression caps (their own audit's open Medium)

**Files:**
- Create: `app/utils/zip-limits.ts`
- Test: `app/utils/zip-limits.test.ts`
- Modify: `app/components/ide/ExtensionsModal.vue:13-49`

**Interfaces:**
- Produces: `makeZipEntryFilter(limits?)` — stateful fflate `filter`; admits `.h` entries only, throws `ZipLimitError` past 200 entries / 5 MB uncompressed.

- [ ] **Step 1: Write the failing tests**

New file `app/utils/zip-limits.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { makeZipEntryFilter, ZipLimitError } from './zip-limits'

const h = (name: string, originalSize: number) => ({ name, originalSize })

describe('makeZipEntryFilter', () => {
  it('admits .h entries and rejects everything else', () => {
    const filter = makeZipEntryFilter()
    expect(filter(h('ext.h', 100))).toBe(true)
    expect(filter(h('README.md', 100))).toBe(false)
    expect(filter(h('nested/dir/other.H', 100))).toBe(true)
  })

  it('throws past the entry cap', () => {
    const filter = makeZipEntryFilter({ maxEntries: 2 })
    expect(filter(h('a.h', 1))).toBe(true)
    expect(filter(h('b.h', 1))).toBe(true)
    expect(() => filter(h('c.h', 1))).toThrow(ZipLimitError)
  })

  it('throws past the total-uncompressed-size cap', () => {
    const filter = makeZipEntryFilter({ maxTotalBytes: 1000 })
    expect(filter(h('a.h', 600))).toBe(true)
    expect(() => filter(h('b.h', 600))).toThrow(ZipLimitError)
  })

  it('non-.h entries do not count toward the caps', () => {
    const filter = makeZipEntryFilter({ maxEntries: 1, maxTotalBytes: 100 })
    expect(filter(h('huge.png', 999_999))).toBe(false)
    expect(filter(h('a.h', 50))).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn test zip-limits`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the util**

New file `app/utils/zip-limits.ts`:

```ts
export const ZIP_MAX_ENTRIES = 200
export const ZIP_MAX_TOTAL_BYTES = 5 * 1024 * 1024 // 5 MB of expanded .h text

export class ZipLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ZipLimitError'
  }
}

/**
 * Stateful fflate `filter` for extension archives: admits only `.h` entries and
 * throws once the archive exceeds the entry-count or total-uncompressed-size
 * budget — a zip bomb is rejected BEFORE it expands (fflate consults `filter`
 * per entry, ahead of decompression). See docs/06-security.md (2026-06-30 audit).
 */
export function makeZipEntryFilter(
  limits: { maxEntries?: number; maxTotalBytes?: number } = {},
): (info: { name: string; originalSize: number }) => boolean {
  const maxEntries = limits.maxEntries ?? ZIP_MAX_ENTRIES
  const maxTotal = limits.maxTotalBytes ?? ZIP_MAX_TOTAL_BYTES
  let entries = 0
  let total = 0
  return info => {
    if (!info.name.toLowerCase().endsWith('.h')) return false
    entries += 1
    total += info.originalSize
    if (entries > maxEntries) throw new ZipLimitError(`Archive has too many .h files (max ${maxEntries}).`)
    if (total > maxTotal)
      throw new ZipLimitError(`Archive expands past the ${Math.round(maxTotal / 1024 / 1024)} MB limit.`)
    return true
  }
}
```

- [ ] **Step 4: Wire it into ExtensionsModal**

In `app/components/ide/ExtensionsModal.vue`, add to the script-setup imports:

```ts
import { makeZipEntryFilter, ZipLimitError, ZIP_MAX_TOTAL_BYTES } from '~/utils/zip-limits'
```

Replace `addZip` (lines 13–25) with:

```ts
async function addZip(file: File): Promise<number> {
  // fflate is lazy-loaded only when a .zip is actually dropped.
  const { unzipSync, strFromU8 } = await import('fflate')
  const buf = new Uint8Array(await file.arrayBuffer())
  let n = 0
  // The filter admits only .h entries and throws ZipLimitError on a bomb.
  for (const [path, data] of Object.entries(unzipSync(buf, { filter: makeZipEntryFilter() }))) {
    addUploaded(path.split('/').pop() as string, strFromU8(data))
    n++
  }
  return n
}
```

Replace `ingest` (lines 27–39) with:

```ts
async function ingest(files: File[]) {
  let added = 0
  for (const file of files) {
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.zip')) {
      try {
        added += await addZip(file)
      } catch (e) {
        note.value = e instanceof ZipLimitError ? e.message : 'Could not read that .zip.'
        return
      }
    } else if (lower.endsWith('.h')) {
      if (file.size > ZIP_MAX_TOTAL_BYTES) {
        note.value = `${file.name} is too large (5 MB max).`
        continue
      }
      addUploaded(file.name, await file.text())
      added++
    }
  }
  note.value = added
    ? `Added ${added} extension${added === 1 ? '' : 's'}.`
    : 'No .h files found in that drop.'
}
```

- [ ] **Step 5: Run tests + commit**

Run: `yarn test zip-limits && yarn typecheck`
Expected: PASS / exit 0.

```bash
git add app/utils/zip-limits.ts app/utils/zip-limits.test.ts app/components/ide/ExtensionsModal.vue
git commit -m "fix(security): cap zip extension imports (200 entries / 5 MB uncompressed) — closes the audit's zip-bomb finding"
```

---

### Task 18: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: yarn
      - run: yarn install --frozen-lockfile
      - run: yarn test
      - run: yarn typecheck
      - run: yarn generate
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run tests, typecheck, and static generate on push/PR"
```

---

### Task 19: Docs — README security table + CHANGELOG

**Files:**
- Modify: `README.md` (security-audit table, zip row)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: README**

In the 2026-06-30 audit table, change the **Zip decompression bomb** row's mitigation cell from `*Recommended:* bound decompression…(Tracked.)` to:

```
**Fixed**: `unzipSync` now runs behind an entry filter capping `.h` count (200) and total uncompressed size (5 MB) — `app/utils/zip-limits.ts`; oversized archives are rejected before expansion.
```

- [ ] **Step 2: CHANGELOG**

Read `CHANGELOG.md`'s heading conventions and add a new top section in the same style summarizing this batch, covering at minimum:
- Run replays test scripts **headlessly** again (per-turn transcript in the panel); **Send to Play** is a separate button.
- Language switch no longer leaks the other language's compile result/game/tabs; empty-storage restores reset scripts/extensions/tabs.
- Crash-recovery autosave (and bucket/map reset watchers) survive navigation.
- Active test-script selection survives compiles and reloads.
- Inform 6 source compiles as UTF-8 (`-Cu`); compiler crashes surface as diagnostics; failed WASM boots retry.
- Replay timeouts are reported as timeouts and scale with script length.
- A11y: named right-pane tabs + full tabs pattern, editor-tab close via Delete key, map SVG semantics, `<main>` landmark, `aria-pressed` mobile switch, reduced-motion support.
- Map fit no longer over-zooms tiny maps.
- Zip import caps (security), per-route canonicals, CI workflow.

- [ ] **Step 3: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: changelog + security-table update for the review-fixes batch"
```

---

### Task 20: Full verification

- [ ] **Step 1: Full local gates**

Run: `yarn test && yarn typecheck && yarn generate`
Expected: all tests pass, typecheck exit 0, generate completes.

- [ ] **Step 2: Browser verification (dev server + Chrome)**

Start `yarn dev`, then verify each fixed behavior end-to-end:
1. Compile Haunted House on `/` → Test Script tab → select a script → **Run** → stays on the panel, per-turn transcript fills in, status line shows `Done — N commands · X ms`. **Send to Play** boots the live game instead.
2. Mid-run tab-switch: start a Run, switch to Map, switch back → Cancel still works.
3. Navigate `/` → `/zil/`: ZIL page shows idle Results, NO playable I6 game. Navigate back: I6 restored (its compile result is intentionally blanked only when the language actually changed — verify `/technical` round-trip keeps it).
4. `/technical` → back → edit source → footer flashes "Recovery saved" within ~1s (autosave alive after navigation).
5. Reload the page: the previously selected script is still selected (not "Script 1").
6. ZIL: load Cloak of Darkness → Compile ("Compiling…" visibly paints before the freeze) → Play works.
7. Map with one room: node renders room-sized, centred (not pane-filling).
8. lightcap `run_a11y` on `http://localhost:3000/` (desktop + mobile): the `landmark-one-main` issue is gone; score 100 or document what remains.

- [ ] **Step 3: Fix anything found, re-run gates, then stop**

Do NOT merge or push — present the branch and use superpowers:finishing-a-development-branch to let the user choose merge/PR/keep.

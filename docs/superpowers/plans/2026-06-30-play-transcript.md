# Play Transcript + Test Script Rename — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture the commands a player types during interactive Play into a read-only **Transcript** tab, with one-click **Copy to Test Script**; rename the existing editable runner tab to **Test Script**; and drop the toolbar "Ready" text.

**Architecture:** Interactive Play runs in a same-origin Parchment `<iframe>` (`/play/index.html`). A tiny vanilla script in that page watches GlkOte line input and `postMessage`s each command to the parent; `PlayPanel.vue` validates origin + source and records it into a session-only `useState` store (`usePlayTranscript`). The new read-only `TranscriptPanel.vue` renders the list and can spin it into a new persisted Test Script. The headless `StoryEngine`/`replay()` seam is untouched.

**Tech Stack:** Nuxt 4 (client-only static, `ssr: false`), Vue 3 `<script setup>`, Nuxt UI 4, TypeScript strict, Vitest (environment node), Parchment/GlkOte (vendored in `public/play/web/`).

## Global Constraints

- **No SSR for browser-only paths.** `PlayPanel.vue` is client-only; the play page is a static asset. Never import iframe/worker code into an SSR module.
- **Composables, not Pinia.** Pure logic file + `use*` composable wrapper; unit-test the pure file (mirrors `project-files.ts` / `useProjectFiles`).
- **localStorage namespaced `frotzsmith:*`**, try/catch quota-graceful. The Play transcript itself is **not** persisted — only Test Scripts are (existing `frotzsmith:scripts`).
- **Transcript captures player commands only** (locked) — no game-output scraping.
- **postMessage trust boundary:** ignore any message unless `event.origin === window.location.origin` **and** `event.data.source === 'frotzsmith-play'`. The captured value is data — appended to a list, never executed.
- **Tests:** `yarn test` (`vitest run`, environment node). `yarn typecheck` clean (ignore the known vue-router/volar plugin warning — not a type error).
- **Commits:** conventional-commit style; **no `Co-Authored-By` / AI-attribution trailer** (every commit).

## File Structure

**Create:**
- `app/composables/play-transcript.ts` — pure helpers: `appendCommand`, `toScriptText`, `nextPlaythroughName`.
- `app/composables/play-transcript.test.ts` — unit tests for the pure helpers.
- `app/composables/usePlayTranscript.ts` — session-only capture store (`commands`, `count`, `text`, `record`, `reset`).
- `app/components/ide/TranscriptPanel.vue` — new read-only Transcript tab (list + Copy to Test Script + Clear).

**Rename (git mv):**
- `app/components/ide/TranscriptPanel.vue` → `app/components/ide/TestScriptPanel.vue` (the existing editable runner; behavior unchanged). *(Done in Task 3, before the new `TranscriptPanel.vue` is created in Task 4.)*

**Modify:**
- `app/composables/useTestScripts.ts` — add `addFromText(name, text)`.
- `app/composables/useIde.ts` — widen `RightTab` to include `'testscript'`.
- `app/composables/useTranscript.ts` — focus `activeTab = 'testscript'` (was `'transcript'`).
- `app/components/ide/RightPaneTabs.vue` — tabs array (rename + new tab), wire both panels, remove the Ready `<span>` + `statusMeta`, keep Play mounted (`v-show`).
- `app/components/ide/PlayPanel.vue` — `window` `message` listener → `record` / `reset`.
- `public/play/index.html` — capture script (line-input → `postMessage`) + `session-start`.
- `CHANGELOG.md`, `ROADMAP.md` — feature entry (Task 7).

---

### Task 1: Pure play-transcript helpers (TDD)

**Files:**
- Create: `app/composables/play-transcript.ts`
- Test: `app/composables/play-transcript.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `appendCommand(list: string[], cmd: string): string[]` — trim `cmd`; if empty, return `list` unchanged; else return a new array with the trimmed command appended (never mutates `list`; no dedupe).
  - `toScriptText(commands: string[]): string` — join with `\n` (one command per line).
  - `nextPlaythroughName(existing: string[]): string` — lowest free `"Playthrough N"` (N ≥ 1) not present in `existing`.

- [ ] **Step 1: Write the failing tests**

Create `app/composables/play-transcript.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { appendCommand, toScriptText, nextPlaythroughName } from './play-transcript'

describe('appendCommand', () => {
  it('appends a trimmed command', () => {
    expect(appendCommand(['look'], '  north ')).toEqual(['look', 'north'])
  })
  it('ignores blank / whitespace-only commands', () => {
    expect(appendCommand(['look'], '   ')).toEqual(['look'])
    expect(appendCommand(['look'], '')).toEqual(['look'])
  })
  it('does not mutate the input array', () => {
    const orig = ['look']
    appendCommand(orig, 'north')
    expect(orig).toEqual(['look'])
  })
  it('keeps repeated commands (no dedupe)', () => {
    expect(appendCommand(['wait'], 'wait')).toEqual(['wait', 'wait'])
  })
})

describe('toScriptText', () => {
  it('joins commands one per line', () => {
    expect(toScriptText(['look', 'north', 'take lamp'])).toBe('look\nnorth\ntake lamp')
  })
  it('is empty for no commands', () => {
    expect(toScriptText([])).toBe('')
  })
})

describe('nextPlaythroughName', () => {
  it('starts at 1 when no Playthrough names exist', () => {
    expect(nextPlaythroughName([])).toBe('Playthrough 1')
    expect(nextPlaythroughName(['Script 1'])).toBe('Playthrough 1')
  })
  it('skips taken Playthrough names', () => {
    expect(nextPlaythroughName(['Playthrough 1', 'Playthrough 2'])).toBe('Playthrough 3')
  })
  it('fills the lowest free slot', () => {
    expect(nextPlaythroughName(['Playthrough 1', 'Playthrough 3'])).toBe('Playthrough 2')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test app/composables/play-transcript.test.ts`
Expected: FAIL — `Failed to resolve import "./play-transcript"` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `app/composables/play-transcript.ts`:

```ts
/**
 * Pure helpers for the Play transcript — the read-only log of commands a player
 * typed during interactive Play. No Vue/DOM, so they unit-test in isolation.
 */

/** Append a command to the log: trim, ignore blank, never mutate the input. */
export function appendCommand(list: string[], cmd: string): string[] {
  const trimmed = cmd.trim()
  if (!trimmed) return list
  return [...list, trimmed]
}

/** Render captured commands as test-script text — one command per line. */
export function toScriptText(commands: string[]): string {
  return commands.join('\n')
}

/**
 * The lowest free "Playthrough N" name (N ≥ 1) not already taken. Used to name
 * the Test Script created from a captured playthrough.
 */
export function nextPlaythroughName(existing: string[]): string {
  const taken = new Set(existing)
  let n = 1
  while (taken.has(`Playthrough ${n}`)) n++
  return `Playthrough ${n}`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn test app/composables/play-transcript.test.ts`
Expected: PASS — 3 describe blocks, 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add app/composables/play-transcript.ts app/composables/play-transcript.test.ts
git commit -m "feat(play-transcript): pure helpers (appendCommand/toScriptText/nextPlaythroughName)"
```

---

### Task 2: State layer — usePlayTranscript + useTestScripts.addFromText

**Files:**
- Create: `app/composables/usePlayTranscript.ts`
- Modify: `app/composables/useTestScripts.ts`

**Interfaces:**
- Consumes: `appendCommand`, `toScriptText` (Task 1); `upsertScript`, `newId`, `TestScript` (existing in `useTestScripts.ts` / `test-scripts.ts`).
- Produces:
  - `usePlayTranscript()` → `{ commands: Ref<string[]>, count: ComputedRef<number>, text: ComputedRef<string>, record(cmd: string): void, reset(): void }`. State key `useState('frotz:play-commands')`. **Not persisted.**
  - `useTestScripts().addFromText(name: string, text: string): void` — create a new `TestScript {id,name,text}`, make it active, persist.

> **Note (verification model):** Composables that need Nuxt's `useState` aren't unit-tested in this repo (see `useTestScripts` / `useTranscript` — only their pure files are). These are thin wrappers over already-tested pure functions, so this task is verified by `yarn typecheck`; the live end-to-end check lands in Task 5.

- [ ] **Step 1: Create the capture store**

Create `app/composables/usePlayTranscript.ts` (`useState`/`computed` are Nuxt auto-imports — no import needed for them):

```ts
import { appendCommand, toScriptText } from './play-transcript'

/**
 * The Play transcript: the read-only, in-memory log of commands the player typed
 * during the current interactive Play session. Captured from the Parchment iframe
 * (see PlayPanel.vue) and rendered read-only in the Transcript tab. Not persisted
 * — it mirrors the live game and is reset when a fresh game boots (session-start).
 */
export function usePlayTranscript() {
  const commands = useState<string[]>('frotz:play-commands', () => [])
  const count = computed(() => commands.value.length)
  const text = computed(() => toScriptText(commands.value))

  function record(cmd: string) {
    commands.value = appendCommand(commands.value, cmd)
  }
  function reset() {
    commands.value = []
  }

  return { commands, count, text, record, reset }
}
```

- [ ] **Step 2: Add `addFromText` to `useTestScripts.ts`**

In `app/composables/useTestScripts.ts`, add the method right after `add()` (it mirrors `add()`, reusing the already-imported `upsertScript` + `newId`):

```ts
  /** Create a script from ready-made text (e.g. a captured playthrough). */
  function addFromText(name: string, text: string) {
    const script: TestScript = { id: newId(), name, text }
    scripts.value = upsertScript(scripts.value, script)
    activeId.value = script.id
    persist()
  }
```

Then add `addFromText` to the returned object. Change:

```ts
  return { scripts, activeId, activeScript, add, rename, remove, updateText, select, restore }
```

to:

```ts
  return { scripts, activeId, activeScript, add, addFromText, rename, remove, updateText, select, restore }
```

- [ ] **Step 3: Verify types compile**

Run: `yarn typecheck`
Expected: PASS (no new errors; the known vue-router/volar plugin warning, if present, is not a type error).

- [ ] **Step 4: Commit**

```bash
git add app/composables/usePlayTranscript.ts app/composables/useTestScripts.ts
git commit -m "feat(play-transcript): usePlayTranscript store + useTestScripts.addFromText"
```

---

### Task 3: Rename the runner tab → "Test Script" (refactor, no new behavior)

**Files:**
- Rename: `app/components/ide/TranscriptPanel.vue` → `app/components/ide/TestScriptPanel.vue`
- Modify: `app/composables/useIde.ts`
- Modify: `app/composables/useTranscript.ts`
- Modify: `app/components/ide/RightPaneTabs.vue`

**Interfaces:**
- Consumes: nothing new.
- Produces: `RightTab` union now includes `'testscript'`; the editable runner renders under id `'testscript'`, label **"Test Script"**, component `<TestScriptPanel>`. (The id `'transcript'` is freed for the new tab in Task 4.)

- [ ] **Step 1: Rename the runner component (preserve git history)**

Run:

```bash
git mv app/components/ide/TranscriptPanel.vue app/components/ide/TestScriptPanel.vue
```

(No code change inside the file — Nuxt auto-imports it as `<TestScriptPanel>` from the new filename.)

- [ ] **Step 2: Widen the `RightTab` type**

In `app/composables/useIde.ts`, change:

```ts
export type RightTab = 'results' | 'play' | 'transcript'
```

to:

```ts
export type RightTab = 'results' | 'play' | 'transcript' | 'testscript'
```

(`'transcript'` stays in the union — it's reused by the new read-only tab in Task 4. The default tab remains `'results'`.)

- [ ] **Step 3: Point the headless runner at the renamed tab**

In `app/composables/useTranscript.ts`, change the one line in `run()`:

```ts
    activeTab.value = 'transcript' // stateful right pane focuses the run
```

to:

```ts
    activeTab.value = 'testscript' // stateful right pane focuses the run
```

- [ ] **Step 4: Relabel the tab and swap the panel in `RightPaneTabs.vue`**

In `app/components/ide/RightPaneTabs.vue`, change the runner entry in the `tabs` array:

```ts
  { id: 'transcript', label: 'Transcript', icon: 'i-lucide-scroll-text' },
```

to:

```ts
  { id: 'testscript', label: 'Test Script', icon: 'i-lucide-scroll-text' },
```

And in the template, change the panel line:

```html
      <TranscriptPanel v-else-if="activeTab === 'transcript'" />
```

to:

```html
      <TestScriptPanel v-else-if="activeTab === 'testscript'" />
```

- [ ] **Step 5: Verify types + live behavior**

Run: `yarn typecheck`
Expected: PASS.

Run: `yarn dev`, open the IDE. Expected: the right pane shows **Results · Play · Test Script**; the third tab reads "Test Script", and (after a clean compile) writing a script + **Run** still produces the per-turn output exactly as before.

- [ ] **Step 6: Commit**

```bash
git add app/components/ide/TestScriptPanel.vue app/composables/useIde.ts app/composables/useTranscript.ts app/components/ide/RightPaneTabs.vue
git commit -m "refactor(ide): rename Transcript runner tab to Test Script"
```

---

### Task 4: New read-only Transcript tab (panel + wire + Copy/Clear)

**Files:**
- Create: `app/components/ide/TranscriptPanel.vue`
- Modify: `app/components/ide/RightPaneTabs.vue`

**Interfaces:**
- Consumes: `usePlayTranscript()` (`commands`, `count`, `text`, `reset`) from Task 2; `useTestScripts()` (`scripts`, `addFromText`) from Task 2; `useIde()` (`activeTab`); `nextPlaythroughName` from Task 1.
- Produces: the `'transcript'` tab renders `<TranscriptPanel>`; **Copy to Test Script** creates a `Playthrough N` script and switches to the Test Script tab.

> After this task the Transcript tab renders but stays empty (capture is wired in Task 5). That's the expected intermediate state — verification here covers the empty state, disabled actions, and a11y.

- [ ] **Step 1: Create the read-only panel**

Create `app/components/ide/TranscriptPanel.vue`:

```vue
<script setup lang="ts">
import { nextPlaythroughName } from '~/composables/play-transcript'

const { commands, count, text, reset } = usePlayTranscript()
const { scripts, addFromText } = useTestScripts()
const { activeTab } = useIde()

// Spin the captured commands into a new, non-destructive Test Script, then focus it.
function copyToTestScript() {
  if (!count.value) return
  addFromText(nextPlaythroughName(scripts.value.map(s => s.name)), text.value)
  activeTab.value = 'testscript'
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Action bar -->
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-default px-3 py-2">
      <span class="text-muted text-sm font-semibold">
        {{ count }} command{{ count === 1 ? '' : 's' }}
      </span>
      <div class="ml-auto flex items-center gap-2">
        <UButton
          color="primary"
          size="sm"
          icon="i-lucide-copy"
          :disabled="!count"
          title="Create a Test Script from these commands"
          @click="copyToTestScript"
        >
          Copy to Test Script
        </UButton>
        <UButton
          color="neutral"
          variant="subtle"
          size="sm"
          icon="i-lucide-trash-2"
          :disabled="!count"
          title="Clear the transcript"
          @click="reset"
        >
          Clear
        </UButton>
      </div>
    </div>

    <!-- Transcript (read-only) -->
    <div
      class="min-h-0 flex-1 overflow-auto px-4 py-3"
      tabindex="0"
      role="region"
      aria-label="Play transcript — commands you typed"
    >
      <div
        v-if="!count"
        class="frotz-grid flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <UIcon name="i-lucide-history" class="size-10 text-primary" />
        <p class="text-lg font-semibold">No commands yet</p>
        <p class="text-muted max-w-sm text-sm">
          Play your game — the commands you type appear here as a transcript.
        </p>
      </div>

      <ol v-else class="space-y-1">
        <li v-for="(cmd, i) in commands" :key="i" class="font-mono text-sm">
          <span class="text-muted select-none">{{ i + 1 }}.</span>
          <span class="text-primary ml-1 font-semibold">&gt; {{ cmd }}</span>
        </li>
      </ol>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Add the Transcript tab to `RightPaneTabs.vue`**

In the `tabs` array, insert the new entry **between** `play` and `testscript`:

```ts
const tabs: { id: RightTab; label: string; icon: string }[] = [
  { id: 'results', label: 'Results', icon: 'i-lucide-clipboard-list' },
  { id: 'play', label: 'Play', icon: 'i-lucide-gamepad-2' },
  { id: 'transcript', label: 'Transcript', icon: 'i-lucide-history' },
  { id: 'testscript', label: 'Test Script', icon: 'i-lucide-scroll-text' },
]
```

- [ ] **Step 3: Render the panel**

In the template panel area, add the `TranscriptPanel` line so the block reads:

```html
      <ResultsPanel v-if="activeTab === 'results'" />
      <PlayPanel v-else-if="activeTab === 'play'" />
      <TranscriptPanel v-else-if="activeTab === 'transcript'" />
      <TestScriptPanel v-else-if="activeTab === 'testscript'" />
```

- [ ] **Step 4: Verify types + live empty state**

Run: `yarn typecheck`
Expected: PASS.

Run: `yarn dev`. Expected: the right pane now shows **Results · Play · Transcript · Test Script**. Click **Transcript** → "No commands yet" empty state with the history icon; **Copy to Test Script** and **Clear** are present and disabled.

- [ ] **Step 5: Commit**

```bash
git add app/components/ide/TranscriptPanel.vue app/components/ide/RightPaneTabs.vue
git commit -m "feat(play-transcript): read-only Transcript tab (Copy to Test Script / Clear)"
```

---

### Task 5: Capture player commands from the Play iframe

**Files:**
- Modify: `public/play/index.html`
- Modify: `app/components/ide/PlayPanel.vue`

**Interfaces:**
- Consumes: `usePlayTranscript()` (`record`, `reset`) from Task 2.
- Produces: end-to-end capture — typing a command in Play appends it to `frotz:play-commands`; a fresh game boot clears it. Message contract: `{ source: 'frotzsmith-play', type: 'command', value: string }` and `{ source: 'frotzsmith-play', type: 'session-start' }`.

- [ ] **Step 1: Add the capture script to the play page**

In `public/play/index.html`, add this block immediately before `</body>` (after the `#gameport` div):

```html
<script>
  // Frotzsmith: report the player's typed commands up to the IDE shell so the
  // Transcript tab can show them. GlkOte line input is <input class="… LineInput">;
  // char-input key prompts ("press a key", [MORE]) are class "CharInput" and are
  // intentionally ignored. Same-origin parent, so postMessage targets our origin.
  (function () {
    var TARGET = location.origin
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return
      var el = e.target
      if (!el || el.tagName !== 'INPUT' || !el.classList.contains('LineInput')) return
      var v = (el.value || '').trim()
      if (v) parent.postMessage({ source: 'frotzsmith-play', type: 'command', value: v }, TARGET)
    }, true) // capture phase: read the value before GlkOte clears the field
    // Fresh game booted → ask the shell to start a new transcript.
    parent.postMessage({ source: 'frotzsmith-play', type: 'session-start' }, TARGET)
  })()
</script>
```

- [ ] **Step 2: Listen for the messages in `PlayPanel.vue`**

In `app/components/ide/PlayPanel.vue` `<script setup>`, after the existing `useIde()` destructure near the top, pull in the store:

```ts
const { record, reset } = usePlayTranscript()
```

Add the typed handler (place it near the other functions, e.g. after `onFsChange`):

```ts
interface PlayMessage {
  source?: string
  type?: string
  value?: unknown
}
// Only trust same-origin messages tagged by our play page (instruction-source
// boundary). The value is data — appended to a list, never executed.
function onMessage(e: MessageEvent) {
  if (e.origin !== window.location.origin) return
  const data = e.data as PlayMessage | null
  if (!data || data.source !== 'frotzsmith-play') return
  if (data.type === 'command' && typeof data.value === 'string') record(data.value)
  else if (data.type === 'session-start') reset()
}
```

Then register/unregister it in the existing lifecycle hooks. Change:

```ts
onMounted(() => {
  document.addEventListener('fullscreenchange', onFsChange)
  if (playNonce.value > 0) boot()
})
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFsChange)
  revoke()
})
```

to:

```ts
onMounted(() => {
  document.addEventListener('fullscreenchange', onFsChange)
  window.addEventListener('message', onMessage)
  if (playNonce.value > 0) boot()
})
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFsChange)
  window.removeEventListener('message', onMessage)
  revoke()
})
```

- [ ] **Step 3: Verify types**

Run: `yarn typecheck`
Expected: PASS.

- [ ] **Step 4: Live end-to-end check**

Run: `yarn dev`. Then:
1. Load/keep a sample, **Compile** (clean), **Play**.
2. In the game, type a few commands (e.g. `look`, `north`, `wait`), pressing Enter after each.
3. Switch to the **Transcript** tab → the commands appear as a numbered read-only list (`1. > look`, …). Verify a "press a key"/`[MORE]` prompt did **not** add a line.
4. Click **Copy to Test Script** → a new **Playthrough 1** script is created and the view switches to **Test Script** with those commands as the editor text; **Run** replays them.
5. Back on **Play**, press **Play** again (new game) → returning to **Transcript** shows it reset to empty for the fresh session.

Expected: all of the above; no console errors.

- [ ] **Step 5: Commit**

```bash
git add public/play/index.html app/components/ide/PlayPanel.vue
git commit -m "feat(play-transcript): capture player commands from the Play iframe"
```

---

### Task 6: Move Compile/Play to the title bar + drop the "Ready" indicator + keep Play mounted

**Files:**
- Modify: `app/components/ide/TitleStrip.vue`
- Modify: `app/components/ide/RightPaneTabs.vue`

**Interfaces:**
- Consumes: `TitleStrip` now also pulls `status`, `canPlay`, `runCompile`, `playStory` from `useIde` (in addition to `source`). `RightPaneTabs` keeps only `activeTab` + `status` (the latter still drives the Results tab dot).
- Produces: the **Compile** + **Play** buttons live in the title bar (right-aligned, vertically centred), full size; the tab row holds only the tabs; the `Ready/Not ready/Compiling…` text and `statusMeta` are gone; the Play iframe stays mounted (`v-show`) so the live game and the transcript survive tab switches.

> Why: the Compile/Play buttons are big and legible enough to sit in the title nav, which declutters the tab row and frees the old toolbar slot. (User request, 2026-06-30.)

- [ ] **Step 1: Move Compile + Play into `TitleStrip.vue`**

Replace the entire contents of `app/components/ide/TitleStrip.vue` with:

```vue
<script setup lang="ts">
const { source, status, canPlay, runCompile, playStory } = useIde()

// The game's title & headline, read live from the source.
const meta = computed(() => {
  const story = /Constant\s+Story\s+"([^"]*)"/i.exec(source.value)?.[1]?.trim()
  const headline = (/Constant\s+Headline\s+"([^"]*)"/i.exec(source.value)?.[1] ?? '')
    .replace(/\^/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { story: story || 'Untitled', headline }
})
</script>

<template>
  <div class="flex shrink-0 items-center gap-3 border-b border-default px-4 py-2.5">
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-bold">{{ meta.story }}</p>
      <p v-if="meta.headline" class="text-muted truncate text-xs">{{ meta.headline }}</p>
    </div>

    <!-- Primary actions — moved up from the tab row; right-aligned, vertically centred. -->
    <div class="flex shrink-0 items-center gap-3">
      <UButton
        color="primary"
        icon="i-lucide-hammer"
        class="frotz-glow font-bold"
        :loading="status === 'compiling'"
        @click="runCompile"
      >
        Compile
        <kbd
          class="ml-1 hidden rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-semibold sm:inline"
          >⌘B</kbd
        >
      </UButton>

      <!-- Hidden (but space reserved → no layout shift) until a clean compile. -->
      <UButton
        color="success"
        icon="i-lucide-play"
        class="font-bold"
        :class="canPlay ? 'visible' : 'invisible'"
        :disabled="!canPlay"
        title="Play the compiled game"
        @click="playStory"
      >
        Play
      </UButton>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Remove the toolbar right group + `statusMeta` from `RightPaneTabs.vue`**

Trim the `useIde()` destructure to only what RightPaneTabs still uses — change:

```ts
const { activeTab, status, result, runCompile, canPlay, playStory } = useIde()
```

to:

```ts
const { activeTab, status } = useIde()
```

Delete the whole `statusMeta` computed block:

```ts
// "Ready" is red with an ✗ until a clean compile, then green with a ✓.
const statusMeta = computed(() => {
  switch (status.value) {
    case 'compiling':
      return { label: 'Compiling…', icon: 'i-lucide-loader-circle', spin: true, cls: 'text-primary' }
    case 'success':
      return { label: 'Ready', icon: 'i-lucide-circle-check-big', spin: false, cls: 'text-success' }
    default: // idle or error → not ready
      return { label: 'Not ready', icon: 'i-lucide-circle-x', spin: false, cls: 'text-error' }
  }
})
```

In the template, delete the ENTIRE right-hand toolbar group — the `Ready` span AND both buttons (which now live in the title bar):

```html
      <div class="ml-auto flex items-center gap-3">
        <!-- Fixed width so the label changing never shifts the buttons. -->
        <span
          role="status"
          aria-live="polite"
          :class="['flex w-28 items-center justify-end gap-1.5 text-sm font-semibold', statusMeta.cls]"
        >
          <UIcon :name="statusMeta.icon" :class="['size-4 shrink-0', statusMeta.spin && 'animate-spin']" />
          <span>{{ statusMeta.label }}</span>
        </span>

        <UButton
          color="primary"
          icon="i-lucide-hammer"
          class="frotz-glow font-bold"
          :loading="status === 'compiling'"
          @click="runCompile"
        >
          Compile
          <kbd
            class="ml-1 hidden rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-semibold sm:inline"
            >⌘B</kbd
          >
        </UButton>

        <!-- Hidden (but space reserved → no layout shift) until a clean compile. -->
        <UButton
          color="success"
          icon="i-lucide-play"
          class="font-bold"
          :class="canPlay ? 'visible' : 'invisible'"
          :disabled="!canPlay"
          title="Play the compiled game"
          @click="playStory"
        >
          Play
        </UButton>
      </div>
```

After this, the tab-header row contains only the tabs group (Results · Play · Transcript · Test Script + the disabled Map). The Results tab dot still reads from `status`.

- [ ] **Step 3: Keep Play mounted (`v-show`)**

Change the panel area so Play is always mounted and toggled by `v-show`, with the other three as a `v-if/v-else-if` chain:

```html
      <PlayPanel v-show="activeTab === 'play'" />
      <ResultsPanel v-if="activeTab === 'results'" />
      <TranscriptPanel v-else-if="activeTab === 'transcript'" />
      <TestScriptPanel v-else-if="activeTab === 'testscript'" />
```

(PlayPanel leads and is independent of the chain; when `activeTab === 'play'` none of the chain matches, so only the game shows. When another tab is active, PlayPanel is `display:none` but stays mounted — the game keeps its state.)

- [ ] **Step 4: Verify types + live behavior**

Run: `yarn typecheck`
Expected: PASS.

Run: `yarn dev` (or the running server on `localhost:3000`). Expected:
- The **title bar** (above the tabs) now shows the game title on the left and **Compile** + **Play** on the right, vertically centred. The tab row shows only the tabs — no "Ready/Not ready" text anywhere. The **Results** tab still shows a red dot on errors / green dot on a clean compile, and **Compile** still shows its spinner while compiling.
- Compile + Play, type a command, switch to **Transcript** then back to **Play** → the game is **still where you left it** (not restarted), and the transcript persisted.

- [ ] **Step 5: Commit**

```bash
git add app/components/ide/TitleStrip.vue app/components/ide/RightPaneTabs.vue
git commit -m "refactor(ide): move Compile/Play to the title bar; drop Ready indicator; keep Play mounted"
```

---

### Task 7: SPA loading splash (no more blank screen on load)

**Files:**
- Create: `app/spa-loading-template.html`

**Interfaces:**
- Consumes: nothing (self-contained static HTML/CSS).
- Produces: a branded, full-viewport loading splash shown from first paint until the Vue app hydrates. Nuxt auto-detects `~/spa-loading-template.html` (srcDir `app/`) when `ssr: false` — **no `nuxt.config.ts` change needed** (presence of the file enables it).

**Background:** The app is `ssr: false`, so the served HTML is an empty shell and the user sees ~1–2 s of blank/white before the SPA mounts (user report, 2026-06-30). Nuxt 4's `spaLoadingTemplate` mechanism injects this file's contents alongside `<div id="__nuxt"></div>`, kept in the DOM until the Vue app's suspense resolves — exactly the gap to fill (confirmed against the Nuxt 4 docs). The splash is raw HTML + inline `<style>`: it renders before the app CSS, Tailwind, and icon fonts load, so it inlines everything and hard-codes the dark theme (`colorMode.preference: 'dark'`; live body bg `#0f172a` = slate-900) and brand amber (`--frotz-amber: #f0a830`) so there is no flash and it reads as Frotzsmith.

- [ ] **Step 1: Create `app/spa-loading-template.html`**

```html
<!--
  Frotzsmith SPA loading splash (ssr: false). Shown from first paint until the
  Vue app hydrates. Self-contained: it renders BEFORE the app CSS / Tailwind /
  icon fonts load, so it inlines all styles and hard-codes the dark theme
  (body #0f172a = slate-900) + brand amber (#f0a830) to avoid any flash.
-->
<div class="frotz-spa" role="status" aria-label="Loading Frotzsmith">
  <div class="frotz-spa__brand">
    <svg class="frotz-spa__hammer" xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#f0a830" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/>
      <path d="m18 15 4-4"/>
      <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>
    </svg>
    <span class="frotz-spa__word">Frotzsmith</span>
  </div>
  <span class="frotz-spa__sub">INFORM 6 IDE</span>
  <div class="frotz-spa__spinner" aria-hidden="true"></div>
</div>
<style>
  html, body { margin: 0; background: #0f172a; }
  .frotz-spa {
    position: fixed; inset: 0; z-index: 9999;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 14px; background: #0f172a; color: #e2e8f0;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .frotz-spa__brand { display: flex; align-items: center; gap: 10px; }
  .frotz-spa__word { font-size: 26px; font-weight: 800; letter-spacing: -0.01em; color: #f8fafc; }
  .frotz-spa__sub { font-size: 11px; font-weight: 600; letter-spacing: 0.18em; color: #64748b; }
  .frotz-spa__spinner {
    margin-top: 10px; width: 34px; height: 34px; border-radius: 50%;
    border: 3px solid rgba(240, 168, 48, 0.2); border-top-color: #f0a830;
    animation: frotz-spa-spin 0.7s linear infinite;
  }
  @keyframes frotz-spa-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .frotz-spa__spinner { animation-duration: 2.2s; } }
</style>
```

- [ ] **Step 2: Verify Nuxt embeds it in the SPA shell**

The SPA template is read at build / dev-server start, so a newly-added file needs a fresh build to appear. Run:

```bash
yarn generate
```

Expected: exit 0. Then confirm the splash markup was embedded in the generated shell:

```bash
grep -c "frotz-spa" .output/public/index.html
```

Expected: a non-zero count (the loader markup is inlined into the production HTML). This proves the auto-detection works without any config change.

- [ ] **Step 3: Typecheck (unaffected)**

Run: `yarn typecheck`
Expected: PASS (a static asset; no type surface).

(The live visual check — hard-reload shows the dark amber splash for ~1–2 s, no white flash — is the controller's verification, since the running dev server must be restarted to pick up a new SPA template.)

- [ ] **Step 4: Commit**

```bash
git add app/spa-loading-template.html
git commit -m "feat(ui): branded SPA loading splash (no blank screen on load)"
```

---

### Task 8: Verify suite + docs

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `ROADMAP.md`

**Interfaces:**
- Consumes: everything above.
- Produces: green gates + a documented feature.

- [ ] **Step 1: Full test suite**

Run: `yarn test`
Expected: PASS — all prior tests plus the 8 new `play-transcript` tests.

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: PASS (ignore the known vue-router/volar plugin warning).

- [ ] **Step 3: Static build (proves the static `nuxt generate` path is intact)**

Run: `yarn generate`
Expected: exit 0; `.output/public` regenerated. (The play page edit is a static asset; confirm the build doesn't error.)

- [ ] **Step 4: Accessibility spot-check (axecap)**

With `yarn dev` running, audit the IDE with the **Transcript** tab active (populated by a short play). Use the `axecap` MCP server (`audit_url`) against the dev URL.
Expected: 0 violations (repo baseline). The Transcript region is a labelled `role="region"` with a focusable container; Copy/Clear are labelled buttons.

- [ ] **Step 5: Update `CHANGELOG.md`**

Add an entry under the current unreleased/Shipped section, e.g.:

```markdown
- **Play Transcript** — interactive Play now records the commands you type into a read-only **Transcript** tab; **Copy to Test Script** turns a playthrough into a reusable Test Script in one click. The old Transcript (script runner) tab is now **Test Script**. The toolbar "Ready" text was removed (the Results tab's red/green dot already signals readiness), and switching tabs no longer restarts the running game.
```

- [ ] **Step 6: Update `ROADMAP.md`**

Move/append the play-transcript capability into the Shipped section (match the file's existing wording/structure for shipped items).

- [ ] **Step 7: Commit**

```bash
git add CHANGELOG.md ROADMAP.md
git commit -m "docs: changelog + roadmap for the play transcript"
```

---

## Self-Review

**Spec coverage** (against `2026-06-30-play-transcript-design.md`):
- D1 rename → Task 3 (id `testscript`, `TestScriptPanel.vue`) + Task 4 (new `TranscriptPanel.vue`). ✓
- D2 capture via postMessage, commands only → Task 5 (`input.LineInput`, origin+source guard). ✓
- D3 Play stays mounted (`v-show`) → Task 6. ✓
- D4 Copy → non-destructive `Playthrough N` → Tasks 1 (`nextPlaythroughName`) + 4 (`copyToTestScript`). ✓
- D5 drop toolbar "Ready" text, keep Results → Task 6. ✓
- §3.3 session-only store / reset on session-start → Tasks 2 (`usePlayTranscript`, not persisted) + 5 (`session-start` → `reset`). ✓
- §6 testing (pure helpers) → Task 1; §7 a11y → Task 4 (markup) + Task 7 (axecap). ✓

**Placeholder scan:** none — every step has concrete code/commands/expected output.

**Type consistency:** message contract `{ source:'frotzsmith-play', type:'command'|'session-start', value }` matches between `public/play/index.html` (Task 5 Step 1) and `PlayPanel.onMessage` (Task 5 Step 2). `usePlayTranscript` surface (`commands/count/text/record/reset`) consistent across Tasks 2, 4, 5. `addFromText(name, text)` consistent across Tasks 2 and 4. `RightTab` includes `'testscript'` (Task 3) and `'transcript'` (existing, reused Task 4); tab ids/labels/components line up in `RightPaneTabs` across Tasks 3, 4, 6.

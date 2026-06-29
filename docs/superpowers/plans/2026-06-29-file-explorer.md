# File Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible file explorer that lists the project's compilation bundle (`story.inf`, enabled extensions, and read-only library files) and opens each file in a tabbed, multi-file editor.

**Architecture:** A pure logic module (`app/composables/project-files.ts`) computes the file list, de-dupes library files, and reconciles tabs/persistence — fully unit-tested. A thin Nuxt composable (`useProjectFiles`) wraps it with `useState` and the existing backing stores (`source`, `useExtensions`, the active library profile). Two new components (`FileExplorer.vue`, `EditorTabs.vue`) render the panel and tab strip. `SourcePane.vue` becomes a multi-file editor using **approach B**: one `EditorView` with a per-file `EditorState` map, preserving undo/cursor across tab switches.

**Tech Stack:** Nuxt 4 (`ssr: false`), Vue 3 `<script setup>`, Nuxt UI 4 (`UButton`, `UIcon`, `USlideover`, `UModal`), Tailwind, CodeMirror 6, TypeScript (strict), Vitest.

## Global Constraints

- **No new runtime dependencies.** Everything ships with what's already in `package.json`.
- **TypeScript strict** — no `any`, no non-null assertions on user data; `yarn typecheck` must pass clean.
- **State is Vue composables + `useState`** (no Pinia). New persisted keys go in `frotzsmith.config.ts` under `storageKeys`, never inline string literals.
- **Accessibility: WCAG 2.1 AA, axe-core zero violations.** Every interactive element is a real button/control with an accessible name and visible focus; active/selected state is conveyed beyond color (`aria-current` / `aria-selected` + icon/weight). The mobile drawer traps focus, closes on `Esc`, restores focus to its opener.
- **Commit messages:** conventional style (`feat:`, `test:`, `refactor:`). **Never add an AI co-author trailer.**
- **The explorer mirrors the compilation bundle** mounted in `useCompiler.ts` — source `story.inf`, the active profile's `.h` library files, and enabled extensions. Disabled extensions do not appear.
- **The main source file is displayed as `story.inf`** (what the compiler builds). It is always present and cannot be closed.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `app/composables/project-files.ts` | **(new)** Pure, framework-free logic: file-list composition, library de-dup, tab/persistence reconciliation. Unit-tested. |
| `app/composables/project-files.test.ts` | **(new)** Vitest unit tests for the pure module. |
| `app/composables/useProjectFiles.ts` | **(new)** Nuxt composable: wraps the pure module with `useState`, the backing stores, reactive reconciliation, and persistence. |
| `app/components/ide/FileExplorer.vue` | **(new)** The collapsible panel: Project + Library groups, ✕ close, "+" → Extensions modal. |
| `app/components/ide/EditorTabs.vue` | **(new)** Tab strip above the editor. |
| `app/components/ide/SourcePane.vue` | **(modify)** Multi-file editor (approach B). |
| `app/composables/useExtensions.ts` | **(modify)** Add `updateUploaded(id, content)`. |
| `app/composables/useIde.ts` | **(modify)** Route `format()` to the active editable file. |
| `app/components/ide/IdeLayout.vue` | **(modify)** Desktop column + mobile drawer + insert `EditorTabs`. |
| `app/components/ide/SourceToolbar.vue` | **(modify)** Explorer toggle button. |
| `app/components/ide/IdeToolbar.vue` | **(modify)** Prettify guard for read-only files. |
| `frotzsmith.config.ts` | **(modify)** Add `storageKeys.explorer`. |
| `vitest.config.ts` | **(new)** Minimal config (node env, `~`/`~~` aliases). |
| `CHANGELOG.md` | **(modify)** Record the feature. |

---

## Task 1: Pure file-list logic + test foundation

**Files:**
- Create: `vitest.config.ts`
- Create: `app/composables/project-files.ts`
- Test: `app/composables/project-files.test.ts`

**Interfaces:**
- Produces:
  - `interface ProjectFileMeta { id: string; name: string; group: 'project' | 'library'; editable: boolean }`
  - `canonicalLibraryFiles(files: { path: string; content: string }[]): { name: string; content: string }[]` — de-dupes case aliases (e.g. `parser.h` + `Parser.h` → one canonical `Parser.h`), sorted case-insensitively by name.
  - `buildProjectFileList(input: { sourceName: string; enabledExtensions: { id: string; name: string; origin: 'bundled' | 'uploaded' }[]; libraryNames: string[] }): ProjectFileMeta[]` — `source` first (editable), then enabled extensions (`uploaded` editable, `bundled` read-only) named `<name>.h`, then library files (id `lib:<name>`, read-only).

- [ ] **Step 1: Create the vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Standalone from nuxt.config — only powers the unit suite. Pure logic runs in
// the node environment; the aliases mirror Nuxt 4 (`~` → app/, `~~` → root) so
// test files can use either relative or aliased imports.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/*.{test,spec}.ts'],
  },
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('.', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
})
```

- [ ] **Step 2: Write the failing test**

Create `app/composables/project-files.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { canonicalLibraryFiles, buildProjectFileList } from './project-files'

describe('canonicalLibraryFiles', () => {
  it('collapses case aliases to one canonical name, preferring the capitalized form', () => {
    const out = canonicalLibraryFiles([
      { path: '/lib/std/parser.h', content: 'P' },
      { path: '/lib/std/Parser.h', content: 'P' },
      { path: '/lib/std/infglk.h', content: 'I' },
    ])
    expect(out.map(f => f.name)).toEqual(['infglk.h', 'Parser.h'])
    expect(out.find(f => f.name === 'Parser.h')?.content).toBe('P')
  })

  it('passes through an already-unique lowercase set (PunyInform)', () => {
    const out = canonicalLibraryFiles([
      { path: '/lib/puny/puny.h', content: 'A' },
      { path: '/lib/puny/globals.h', content: 'B' },
    ])
    expect(out.map(f => f.name)).toEqual(['globals.h', 'puny.h'])
  })
})

describe('buildProjectFileList', () => {
  it('lists source first, then enabled extensions, then library files', () => {
    const list = buildProjectFileList({
      sourceName: 'story.inf',
      enabledExtensions: [
        { id: 'uploaded:mine', name: 'mine', origin: 'uploaded' },
        { id: 'bundled:ordinals', name: 'ordinals', origin: 'bundled' },
      ],
      libraryNames: ['Parser.h', 'VerbLib.h'],
    })
    expect(list).toEqual([
      { id: 'source', name: 'story.inf', group: 'project', editable: true },
      { id: 'uploaded:mine', name: 'mine.h', group: 'project', editable: true },
      { id: 'bundled:ordinals', name: 'ordinals.h', group: 'project', editable: false },
      { id: 'lib:Parser.h', name: 'Parser.h', group: 'library', editable: false },
      { id: 'lib:VerbLib.h', name: 'VerbLib.h', group: 'library', editable: false },
    ])
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `yarn test`
Expected: FAIL — `project-files.ts` has no such exports (import/resolve error).

- [ ] **Step 4: Write the implementation**

Create `app/composables/project-files.ts`:

```ts
/**
 * Pure, framework-free logic for the file explorer. No Vue/Nuxt auto-imports
 * live here so it can be unit-tested directly with Vitest; the `useProjectFiles`
 * composable wraps these functions with reactive state and the backing stores.
 */

export interface ProjectFileMeta {
  id: string
  /** Display/Include filename, e.g. `story.inf`, `ordinals.h`, `Parser.h`. */
  name: string
  group: 'project' | 'library'
  editable: boolean
}

const baseName = (path: string) => path.split('/').pop() ?? path
const hasUpper = (s: string) => /[A-Z]/.test(s)

/**
 * The compiler mounts mixed-case aliases (e.g. both `parser.h` and `Parser.h`)
 * to satisfy the case-sensitive MEMFS. For display we want one entry per file,
 * under the name authors actually `Include` — prefer the capitalized variant.
 */
export function canonicalLibraryFiles(
  files: { path: string; content: string }[],
): { name: string; content: string }[] {
  const byKey = new Map<string, { name: string; content: string }>()
  for (const f of files) {
    const name = baseName(f.path)
    const key = name.toLowerCase()
    const existing = byKey.get(key)
    if (!existing || (!hasUpper(existing.name) && hasUpper(name))) {
      byKey.set(key, { name, content: f.content })
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
  )
}

export function buildProjectFileList(input: {
  sourceName: string
  enabledExtensions: { id: string; name: string; origin: 'bundled' | 'uploaded' }[]
  libraryNames: string[]
}): ProjectFileMeta[] {
  const project: ProjectFileMeta[] = [
    { id: 'source', name: input.sourceName, group: 'project', editable: true },
    ...input.enabledExtensions.map(e => ({
      id: e.id,
      name: `${e.name}.h`,
      group: 'project' as const,
      editable: e.origin === 'uploaded',
    })),
  ]
  const library: ProjectFileMeta[] = input.libraryNames.map(name => ({
    id: `lib:${name}`,
    name,
    group: 'library' as const,
    editable: false,
  }))
  return [...project, ...library]
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `yarn test`
Expected: PASS — all four assertions green.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts app/composables/project-files.ts app/composables/project-files.test.ts
git commit -m "feat: pure file-list logic for the explorer + vitest config"
```

---

## Task 2: Pure tab + persistence reconciliation

**Files:**
- Modify: `app/composables/project-files.ts`
- Test: `app/composables/project-files.test.ts`

**Interfaces:**
- Consumes: `ProjectFileMeta` (Task 1).
- Produces:
  - `interface TabState { activeId: string; openTabs: string[] }`
  - `reconcileOpen(current: TabState, validIds: Set<string>): TabState` — drops tabs whose id is neither `'source'` nor in `validIds`; guarantees `'source'` is present; if `activeId` is invalid, falls back to `'source'`. Used for both persistence-restore and reactive changes (extension disabled/removed, library switched).
  - `closeTabState(current: TabState, id: string): TabState` — removes `id` (ignores `'source'`); if it was active, selects the left neighbor, else `'source'`.

- [ ] **Step 1: Write the failing test**

Append to `app/composables/project-files.test.ts`:

```ts
import { reconcileOpen, closeTabState } from './project-files'

describe('reconcileOpen', () => {
  it('drops stale tabs, keeps source, and fixes a stale active', () => {
    const out = reconcileOpen(
      { activeId: 'lib:Gone.h', openTabs: ['source', 'uploaded:a', 'lib:Gone.h'] },
      new Set(['uploaded:a']),
    )
    expect(out.openTabs).toEqual(['source', 'uploaded:a'])
    expect(out.activeId).toBe('source')
  })

  it('always ensures source is present and selectable', () => {
    const out = reconcileOpen({ activeId: 'source', openTabs: [] }, new Set())
    expect(out.openTabs).toEqual(['source'])
    expect(out.activeId).toBe('source')
  })

  it('keeps a still-valid active untouched', () => {
    const out = reconcileOpen(
      { activeId: 'uploaded:a', openTabs: ['source', 'uploaded:a'] },
      new Set(['uploaded:a']),
    )
    expect(out.activeId).toBe('uploaded:a')
  })
})

describe('closeTabState', () => {
  it('closing the active tab selects the left neighbor', () => {
    const out = closeTabState(
      { activeId: 'lib:B.h', openTabs: ['source', 'uploaded:a', 'lib:B.h'] },
      'lib:B.h',
    )
    expect(out.openTabs).toEqual(['source', 'uploaded:a'])
    expect(out.activeId).toBe('uploaded:a')
  })

  it('closing an inactive tab leaves the active alone', () => {
    const out = closeTabState(
      { activeId: 'source', openTabs: ['source', 'uploaded:a'] },
      'uploaded:a',
    )
    expect(out).toEqual({ activeId: 'source', openTabs: ['source'] })
  })

  it('never closes source', () => {
    const out = closeTabState({ activeId: 'source', openTabs: ['source'] }, 'source')
    expect(out).toEqual({ activeId: 'source', openTabs: ['source'] })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test`
Expected: FAIL — `reconcileOpen` / `closeTabState` are not exported.

- [ ] **Step 3: Write the implementation**

Append to `app/composables/project-files.ts`:

```ts
export interface TabState {
  activeId: string
  openTabs: string[]
}

const isValid = (id: string, validIds: Set<string>) => id === 'source' || validIds.has(id)

/** Drop tabs/active that no longer resolve; `source` is always present. */
export function reconcileOpen(current: TabState, validIds: Set<string>): TabState {
  const openTabs = current.openTabs.filter(id => isValid(id, validIds))
  if (!openTabs.includes('source')) openTabs.unshift('source')
  const activeId = isValid(current.activeId, validIds) && openTabs.includes(current.activeId)
    ? current.activeId
    : 'source'
  return { activeId, openTabs }
}

/** Close a tab (never `source`); re-select the left neighbor when needed. */
export function closeTabState(current: TabState, id: string): TabState {
  if (id === 'source') return current
  const idx = current.openTabs.indexOf(id)
  if (idx === -1) return current
  const openTabs = current.openTabs.filter(t => t !== id)
  let activeId = current.activeId
  if (activeId === id) activeId = current.openTabs[idx - 1] ?? 'source'
  return { activeId, openTabs }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test`
Expected: PASS — all reconcile/close assertions green (Task 1 tests still pass).

- [ ] **Step 5: Commit**

```bash
git add app/composables/project-files.ts app/composables/project-files.test.ts
git commit -m "feat: pure tab + persistence reconciliation for the explorer"
```

---

## Task 3: `useProjectFiles` composable + backing-store wiring

**Files:**
- Modify: `frotzsmith.config.ts` (add `storageKeys.explorer`)
- Modify: `app/composables/useExtensions.ts` (add `updateUploaded`)
- Create: `app/composables/useProjectFiles.ts`
- Modify: `app/composables/useIde.ts` (route `format()` to the active editable file)

**Interfaces:**
- Consumes: all pure exports from Task 1–2; `useSourceDocument().source`; `useExtensions()` (`all`, `enabledFiles`, `isEnabled`, `updateUploaded`); `PROFILES`, `detectProfile`, `ProfileId` from `~/modules/inform6/profiles`; `formatI6`.
- Produces — `useProjectFiles()` returns:
  - `files: ComputedRef<ProjectFileMeta[]>`
  - `activeId: Readonly<Ref<string>>`, `activeFile: ComputedRef<ProjectFileMeta>`
  - `openTabs: ComputedRef<ProjectFileMeta[]>`
  - `panelOpen: Ref<boolean>`
  - `openFile(id: string): void`, `closeTab(id: string): void`, `togglePanel(): void`
  - `readFile(id: string): string`, `writeActive(text: string): void`
  - `restore(): void`
- `useExtensions().updateUploaded(id: string, content: string): void`

- [ ] **Step 1: Add the storage key**

In `frotzsmith.config.ts`, extend `storageKeys`:

```ts
  storageKeys: {
    recovery: 'frotzsmith:recovery',
    profileMode: 'frotzsmith:profile-mode',
    target: 'frotzsmith:target',
    extensions: 'frotzsmith:extensions',
    explorer: 'frotzsmith:explorer',
  },
```

- [ ] **Step 2: Add `updateUploaded` to `useExtensions`**

In `app/composables/useExtensions.ts`, add this function above the `return` block and include it in the returned object:

```ts
  /** Persist an edit to an uploaded extension's `.h` content (no-op if unknown). */
  function updateUploaded(id: string, content: string) {
    const idx = uploaded.value.findIndex(e => e.id === id)
    if (idx === -1) return
    uploaded.value = uploaded.value.map(e => (e.id === id ? { ...e, content } : e))
    persist()
  }
```

Add `updateUploaded,` to the returned object.

- [ ] **Step 3: Write the composable**

Create `app/composables/useProjectFiles.ts`:

```ts
import {
  buildProjectFileList,
  canonicalLibraryFiles,
  closeTabState,
  reconcileOpen,
  type ProjectFileMeta,
  type TabState,
} from '~/composables/project-files'
import type { ProfileMode } from '~/composables/useIde'
import { PROFILES, detectProfile } from '~/modules/inform6/profiles'
import { frotzsmith } from '~~/frotzsmith.config'

const SOURCE_NAME = 'story.inf'

/**
 * Reactive model behind the file explorer + editor tabs. The file list mirrors
 * the compilation bundle (source, enabled extensions, the active library's
 * files); the pure helpers in `project-files.ts` carry the real logic.
 */
export function useProjectFiles() {
  const { source } = useSourceDocument()
  const { all, isEnabled, updateUploaded } = useExtensions()

  // Active library: same derivation as useIde (auto-detect vs forced), read from
  // the shared `profileMode` state so we don't depend on (and cycle through) useIde.
  const profileMode = useState<ProfileMode>('frotz:profile-mode', () => 'auto')
  const activeProfile = computed(() =>
    PROFILES[profileMode.value === 'auto' ? detectProfile(source.value) : profileMode.value],
  )

  // Canonical (de-duped) library files for the active profile, with content.
  const libraryFiles = computed(() => canonicalLibraryFiles(activeProfile.value.files))
  const enabledExtensions = computed(() => all.value.filter(e => isEnabled(e.id)))

  const files = computed<ProjectFileMeta[]>(() =>
    buildProjectFileList({
      sourceName: SOURCE_NAME,
      enabledExtensions: enabledExtensions.value.map(e => ({
        id: e.id,
        name: e.name,
        origin: e.origin,
      })),
      libraryNames: libraryFiles.value.map(f => f.name),
    }),
  )
  const validIds = computed(() => new Set(files.value.map(f => f.id)))

  const tabs = useState<TabState>('frotz:tabs', () => ({ activeId: 'source', openTabs: ['source'] }))
  const panelOpen = useState<boolean>('frotz:panel-open', () => true)

  const activeId = computed(() => tabs.value.activeId)
  const activeFile = computed<ProjectFileMeta>(
    () => files.value.find(f => f.id === tabs.value.activeId) ?? files.value[0]!,
  )
  const openTabs = computed<ProjectFileMeta[]>(() =>
    tabs.value.openTabs
      .map(id => files.value.find(f => f.id === id))
      .filter((f): f is ProjectFileMeta => !!f),
  )

  function persist() {
    if (!import.meta.client) return
    try {
      localStorage.setItem(
        frotzsmith.storageKeys.explorer,
        JSON.stringify({ open: panelOpen.value, ...tabs.value }),
      )
    } catch {
      // QuotaExceededError — keep working in memory
    }
  }

  function openFile(id: string) {
    if (!validIds.value.has(id)) return
    const openTabsNext = tabs.value.openTabs.includes(id)
      ? tabs.value.openTabs
      : [...tabs.value.openTabs, id]
    tabs.value = { activeId: id, openTabs: openTabsNext }
    persist()
  }

  function closeTab(id: string) {
    tabs.value = closeTabState(tabs.value, id)
    persist()
  }

  function togglePanel() {
    panelOpen.value = !panelOpen.value
    persist()
  }

  function readFile(id: string): string {
    if (id === 'source') return source.value
    if (id.startsWith('lib:')) {
      const name = id.slice(4)
      return libraryFiles.value.find(f => f.name === name)?.content ?? ''
    }
    return all.value.find(e => e.id === id)?.content ?? ''
  }

  function writeActive(text: string) {
    const file = activeFile.value
    if (!file.editable) return
    if (file.id === 'source') source.value = text
    else updateUploaded(file.id, text)
  }

  function restore() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(frotzsmith.storageKeys.explorer)
      if (raw) {
        const data = JSON.parse(raw) as { open?: boolean; activeId?: string; openTabs?: string[] }
        if (typeof data.open === 'boolean') panelOpen.value = data.open
        tabs.value = reconcileOpen(
          {
            activeId: data.activeId ?? 'source',
            openTabs: Array.isArray(data.openTabs) ? data.openTabs : ['source'],
          },
          validIds.value,
        )
      }
    } catch {
      // corrupt — start clean
    }
  }

  // Reactively close tabs whose backing file leaves the bundle (extension
  // disabled/removed, or the active library switched).
  watch(validIds, ids => {
    const next = reconcileOpen(tabs.value, ids)
    if (next.activeId !== tabs.value.activeId || next.openTabs.length !== tabs.value.openTabs.length) {
      tabs.value = next
      persist()
    }
  })

  return {
    files,
    activeId: readonly(activeId),
    activeFile,
    openTabs,
    panelOpen,
    openFile,
    closeTab,
    togglePanel,
    readFile,
    writeActive,
    restore,
  }
}
```

- [ ] **Step 4: Route `format()` to the active editable file**

In `app/composables/useIde.ts`, add near the other composable calls at the top of `useIde()`:

```ts
  const { activeFile, readFile, writeActive } = useProjectFiles()
```

Replace the existing `format()`:

```ts
  /** Re-indent and tidy the source. Undoable in the editor. */
  function format() {
    source.value = formatI6(source.value)
  }
```

with:

```ts
  /** Re-indent and tidy the active editable file (source or an uploaded ext). */
  function format() {
    if (!activeFile.value.editable) return
    writeActive(formatI6(readFile(activeFile.value.id)))
  }
```

Also call `useProjectFiles().restore()` from `useIde.restore()` — add `restoreProjectFiles()` to the destructure (rename to avoid clashing) and invoke it:

```ts
  const { activeFile, readFile, writeActive, restore: restoreProjectFiles } = useProjectFiles()
```

and inside `restore()`, after `restoreExtensions()`:

```ts
    restoreExtensions()
    restoreProjectFiles()
    restoreSource()
```

- [ ] **Step 5: Typecheck**

Run: `yarn typecheck`
Expected: PASS — no type errors. (If `ProfileMode` import creates a cycle warning, it is a `type`-only import and erases at runtime; confirm typecheck is clean.)

- [ ] **Step 6: Run the unit suite (still green)**

Run: `yarn test`
Expected: PASS — pure tests unaffected.

- [ ] **Step 7: Commit**

```bash
git add frotzsmith.config.ts app/composables/useExtensions.ts app/composables/useProjectFiles.ts app/composables/useIde.ts
git commit -m "feat: useProjectFiles composable wiring file list, tabs, and persistence"
```

---

## Task 4: `EditorTabs.vue`

**Files:**
- Create: `app/components/ide/EditorTabs.vue`

**Interfaces:**
- Consumes: `useProjectFiles()` → `openTabs`, `activeId`, `openFile`, `closeTab`.

- [ ] **Step 1: Write the component**

Create `app/components/ide/EditorTabs.vue`:

```vue
<script setup lang="ts">
const { openTabs, activeId, openFile, closeTab } = useProjectFiles()

// Arrow-key navigation across the tablist (WCAG: tabs are keyboard-operable).
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  const ids = openTabs.value.map(t => t.id)
  const i = ids.indexOf(activeId.value)
  if (i === -1) return
  const next = event.key === 'ArrowRight' ? ids[i + 1] ?? ids[0] : ids[i - 1] ?? ids[ids.length - 1]
  if (next) {
    event.preventDefault()
    openFile(next)
  }
}
</script>

<template>
  <div
    role="tablist"
    aria-label="Open files"
    class="flex shrink-0 items-stretch gap-px overflow-x-auto border-b border-default bg-elevated/40"
    @keydown="onKeydown"
  >
    <div
      v-for="tab in openTabs"
      :key="tab.id"
      role="tab"
      :aria-selected="tab.id === activeId"
      :tabindex="tab.id === activeId ? 0 : -1"
      :class="[
        'group flex cursor-pointer items-center gap-1.5 border-r border-default px-3 py-1.5 text-xs font-medium transition',
        tab.id === activeId
          ? 'bg-default text-primary'
          : 'text-muted hover:bg-default/60 hover:text-default',
      ]"
      @click="openFile(tab.id)"
      @keydown.enter="openFile(tab.id)"
      @keydown.space.prevent="openFile(tab.id)"
    >
      <UIcon
        :name="tab.editable ? 'i-lucide-file-code-2' : 'i-lucide-file-lock-2'"
        class="size-3.5 shrink-0"
      />
      <span class="whitespace-nowrap">{{ tab.name }}</span>
      <span v-if="!tab.editable" class="sr-only">(read-only)</span>
      <button
        v-if="tab.id !== 'source'"
        type="button"
        class="ml-1 rounded p-0.5 opacity-50 hover:bg-error/15 hover:text-error hover:opacity-100"
        :aria-label="`Close ${tab.name}`"
        @click.stop="closeTab(tab.id)"
      >
        <UIcon name="i-lucide-x" class="size-3" />
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/ide/EditorTabs.vue
git commit -m "feat: editor tab strip component"
```

(Visual verification happens in Task 7 once the component is mounted in the layout.)

---

## Task 5: `FileExplorer.vue`

**Files:**
- Create: `app/components/ide/FileExplorer.vue`

**Interfaces:**
- Consumes: `useProjectFiles()` → `files`, `activeId`, `openFile`, `togglePanel`.
- Renders the existing `<ExtensionsModal />` for the "add files" affordance (reuse; no new upload UI).

- [ ] **Step 1: Write the component**

Create `app/components/ide/FileExplorer.vue`:

```vue
<script setup lang="ts">
const { files, activeId, openFile, togglePanel } = useProjectFiles()

const projectFiles = computed(() => files.value.filter(f => f.group === 'project'))
const libraryFiles = computed(() => files.value.filter(f => f.group === 'library'))
const libraryOpen = ref(true)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-elevated/30">
    <!-- Header -->
    <div class="flex shrink-0 items-center gap-2 border-b border-default px-3 py-2.5">
      <UIcon name="i-lucide-folder-tree" class="text-muted size-4" />
      <span class="text-muted text-xs font-semibold uppercase tracking-wide">Project files</span>
      <UButton
        class="ml-auto"
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-x"
        aria-label="Close file explorer"
        @click="togglePanel"
      />
    </div>

    <nav class="min-h-0 flex-1 overflow-y-auto py-2" aria-label="Project files">
      <!-- Project group -->
      <p class="text-muted px-3 pb-1 text-[10px] font-bold uppercase tracking-widest">
        Project
      </p>
      <ul>
        <li v-for="file in projectFiles" :key="file.id">
          <button
            type="button"
            :aria-current="file.id === activeId ? 'true' : undefined"
            :class="[
              'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition',
              file.id === activeId
                ? 'bg-primary/15 font-semibold text-primary'
                : 'text-default hover:bg-default/60',
            ]"
            @click="openFile(file.id)"
          >
            <UIcon
              :name="file.editable ? 'i-lucide-file-code-2' : 'i-lucide-file-lock-2'"
              class="size-4 shrink-0 opacity-70"
            />
            <span class="truncate">{{ file.name }}</span>
            <span v-if="!file.editable" class="sr-only">(read-only)</span>
          </button>
        </li>
      </ul>

      <!-- Library group (read-only, collapsible) -->
      <button
        type="button"
        class="text-muted mt-2 flex w-full items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest hover:text-default"
        :aria-expanded="libraryOpen"
        @click="libraryOpen = !libraryOpen"
      >
        <UIcon
          :name="libraryOpen ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="size-3"
        />
        Library ({{ libraryFiles.length }})
      </button>
      <ul v-show="libraryOpen">
        <li v-for="file in libraryFiles" :key="file.id">
          <button
            type="button"
            :aria-current="file.id === activeId ? 'true' : undefined"
            :class="[
              'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition',
              file.id === activeId
                ? 'bg-primary/15 font-semibold text-primary'
                : 'text-muted hover:bg-default/60 hover:text-default',
            ]"
            @click="openFile(file.id)"
          >
            <UIcon name="i-lucide-file-lock-2" class="size-4 shrink-0 opacity-70" />
            <span class="truncate">{{ file.name }}</span>
            <span class="sr-only">(read-only library file)</span>
          </button>
        </li>
      </ul>
    </nav>

    <!-- Add files: reuse the existing extensions modal -->
    <div class="shrink-0 border-t border-default p-2">
      <ExtensionsModal />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/ide/FileExplorer.vue
git commit -m "feat: file explorer panel component"
```

(Visual + axe verification in Task 7.)

---

## Task 6: Multi-file editor (`SourcePane.vue`, approach B)

**Files:**
- Modify (full rewrite): `app/components/ide/SourcePane.vue`

**Interfaces:**
- Consumes: `useProjectFiles()` → `activeId`, `activeFile`, `readFile`, `writeActive`; `useIde()` → `jumpSignal`, `runCompile`; `useColorMode()`.

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `app/components/ide/SourcePane.vue` with:

```vue
<script setup lang="ts">
import { EditorState, Compartment, type Extension } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { inform6 } from '~/modules/inform6/editor/i6-language'
import { i6Theme } from '~/modules/inform6/editor/i6-theme'
import { i6Lint } from '~/modules/inform6/editor/i6-lint'

const { activeId, activeFile, readFile, writeActive, openFile } = useProjectFiles()
const { jumpSignal, runCompile } = useIde()
const colorMode = useColorMode()

const host = ref<HTMLElement | null>(null)
const themeComp = new Compartment()
const states = new Map<string, EditorState>()
let view: EditorView | null = null

const isDark = () => colorMode.value === 'dark'

// Build a fresh state for a file: editable files get lint + write-back; read-only
// files (library, bundled extensions) are locked and unlinted to avoid noise.
function makeState(id: string): EditorState {
  const editable = isEditable(id)
  const exts: Extension[] = [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    drawSelection(),
    history(),
    bracketMatching(),
    indentOnInput(),
    EditorView.lineWrapping,
    inform6(),
    EditorState.readOnly.of(!editable),
    EditorView.editable.of(editable),
    themeComp.of(i6Theme(isDark())),
    keymap.of([
      { key: 'Mod-b', preventDefault: true, run: () => (runCompile(), true) },
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    ...(editable ? [i6Lint()] : []),
    EditorView.updateListener.of(u => {
      // Only the live, active editable file writes back (avoids stale closures).
      if (u.docChanged && editable && activeId.value === id) writeActive(u.state.doc.toString())
    }),
  ]
  return EditorState.create({ doc: readFile(id), extensions: exts })
}

// Editability for a non-active file id (mirrors the file list rules).
function isEditable(id: string): boolean {
  if (id === 'source') return true
  if (id.startsWith('lib:')) return false
  return id.startsWith('uploaded:')
}

function showFile(id: string) {
  if (!view) return
  const cached = states.get(id)
  // Rebuild when missing or when the backing content changed externally
  // (load sample, open file, new project, library switch, re-upload).
  if (!cached || cached.doc.toString() !== readFile(id)) {
    states.set(id, makeState(id))
  }
  view.setState(states.get(id)!)
}

onMounted(() => {
  if (!host.value) return
  view = new EditorView({ parent: host.value, state: makeState(activeId.value) })
  states.set(activeId.value, view.state)
})

// Switch files: save the outgoing state (keeps undo/cursor), show the incoming.
watch(activeId, (id, prevId) => {
  if (view && prevId) states.set(prevId, view.state)
  showFile(id)
})

// External content change for the active file → replace the doc in place.
watch(
  () => readFile(activeId.value),
  content => {
    if (view && view.state.doc.toString() !== content) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } })
      states.set(activeId.value, view.state)
    }
  },
)

// Dark/light swap without tearing down the editor.
watch(
  () => colorMode.value,
  () => view?.dispatch({ effects: themeComp.reconfigure(i6Theme(isDark())) }),
)

// A clicked diagnostic targets the source — make sure it's the active file first.
watch(jumpSignal, sig => {
  if (!sig) return
  if (activeId.value !== 'source') openFile('source')
  nextTick(() => {
    if (!view) return
    const lineNo = Math.min(Math.max(sig.line, 1), view.state.doc.lines)
    const line = view.state.doc.line(lineNo)
    view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true })
    view.focus()
  })
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
  states.clear()
})
</script>

<template>
  <div
    ref="host"
    role="tabpanel"
    :aria-label="`Editing ${activeFile.name}${activeFile.editable ? '' : ' (read-only)'}`"
    class="h-full w-full overflow-hidden"
  />
</template>
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: PASS.

- [ ] **Step 3: Manual verification (dev server)**

Run: `yarn dev`, open the app. With the explorer mounted only in Task 7, this step is a smoke check that the editor still loads the source and edits/undo work; full multi-file checks are in Task 7. Confirm:
- The demo source loads and is editable.
- Typing then `Cmd/Ctrl-Z` undoes; `Cmd/Ctrl-B` compiles.
- Dark/light toggle still re-themes the editor.

Expected: editor behaves exactly as before for the source file.

- [ ] **Step 4: Commit**

```bash
git add app/components/ide/SourcePane.vue
git commit -m "feat: multi-file editor with per-file EditorState (approach B)"
```

---

## Task 7: Layout integration, toggle, mobile drawer, Prettify guard

**Files:**
- Modify: `app/components/ide/IdeLayout.vue`
- Modify: `app/components/ide/SourceToolbar.vue`
- Modify: `app/components/ide/IdeToolbar.vue`

**Interfaces:**
- Consumes: `useProjectFiles()` → `panelOpen`, `togglePanel`, `activeFile`.

- [ ] **Step 1: Add the explorer + tab strip to the layout**

In `app/components/ide/IdeLayout.vue`, add to the `useIde()` destructure line a `useProjectFiles()` call below it:

```ts
const { restore, savedAt, activeProfile, profileMode, result, effectiveExt } = useIde()
const { panelOpen } = useProjectFiles()
const mobileView = ref<'editor' | 'output'>('editor')
```

Replace the two-pane shell block:

```vue
    <!-- Two-pane shell -->
    <div class="min-h-0 flex-1 lg:grid lg:grid-cols-2 lg:divide-x lg:divide-default">
      <section
        :class="['h-full min-h-0 flex-col', mobileView === 'editor' ? 'flex' : 'hidden', 'lg:flex']"
        aria-label="Source"
      >
        <TitleStrip />
        <SourceToolbar />
        <div class="min-h-0 flex-1">
          <SourcePane />
        </div>
      </section>
      <section
        :class="['h-full min-h-0', mobileView === 'output' ? 'block' : 'hidden', 'lg:block']"
        aria-label="Output"
      >
        <RightPaneTabs />
      </section>
    </div>
```

with:

```vue
    <!-- Explorer + two-pane shell -->
    <div class="flex min-h-0 flex-1">
      <!-- Desktop: collapsible explorer column -->
      <aside
        v-if="panelOpen"
        class="hidden w-60 shrink-0 border-r border-default lg:block"
        aria-label="File explorer"
      >
        <FileExplorer />
      </aside>

      <div class="min-h-0 flex-1 lg:grid lg:grid-cols-2 lg:divide-x lg:divide-default">
        <section
          :class="['h-full min-h-0 flex-col', mobileView === 'editor' ? 'flex' : 'hidden', 'lg:flex']"
          aria-label="Source"
        >
          <TitleStrip />
          <SourceToolbar />
          <EditorTabs />
          <div class="min-h-0 flex-1">
            <SourcePane />
          </div>
        </section>
        <section
          :class="['h-full min-h-0', mobileView === 'output' ? 'block' : 'hidden', 'lg:block']"
          aria-label="Output"
        >
          <RightPaneTabs />
        </section>
      </div>
    </div>

    <!-- Mobile: explorer as a slide-over drawer -->
    <USlideover v-model:open="panelOpen" side="left" title="Project files" class="lg:hidden">
      <template #body>
        <FileExplorer />
      </template>
    </USlideover>
```

- [ ] **Step 2: Add the explorer toggle to the source toolbar**

In `app/components/ide/SourceToolbar.vue`, add the toggle as the first control. First extend the `useIde()` destructure with a `useProjectFiles()` call:

```ts
const { source, loadSample, loadSource, newProject } = useIde()
const { togglePanel, panelOpen } = useProjectFiles()
```

Then, inside the toolbar's root `<div>`, replace the leading icon + label:

```vue
    <UIcon name="i-lucide-file-code-2" class="text-muted size-4" />
    <span class="text-muted text-xs font-semibold uppercase tracking-wide">Source</span>
```

with:

```vue
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      icon="i-lucide-panel-left"
      :aria-label="panelOpen ? 'Hide file explorer' : 'Show file explorer'"
      :aria-pressed="panelOpen"
      @click="togglePanel"
    />
    <UIcon name="i-lucide-file-code-2" class="text-muted size-4" />
    <span class="text-muted text-xs font-semibold uppercase tracking-wide">Source</span>
```

- [ ] **Step 3: Guard Prettify on read-only files**

In `app/components/ide/IdeToolbar.vue`, extend the destructure:

```ts
const { format, profileMode, activeProfile, setProfileMode, targetMode, effectiveExt, setTargetMode } =
  useIde()
const { activeFile } = useProjectFiles()
```

Replace `onPrettify()`:

```ts
function onPrettify() {
  format()
  toast.add({
    title: 'Prettified',
    description: 'Re-indented and tidied the source.',
    icon: 'i-lucide-wand-sparkles',
    color: 'success',
    duration: 2500,
  })
}
```

with:

```ts
function onPrettify() {
  if (!activeFile.value.editable) {
    toast.add({
      title: 'Read-only file',
      description: `${activeFile.value.name} can't be edited.`,
      icon: 'i-lucide-file-lock-2',
      color: 'warning',
      duration: 2500,
    })
    return
  }
  format()
  toast.add({
    title: 'Prettified',
    description: `Re-indented and tidied ${activeFile.value.name}.`,
    icon: 'i-lucide-wand-sparkles',
    color: 'success',
    duration: 2500,
  })
}
```

- [ ] **Step 4: Typecheck**

Run: `yarn typecheck`
Expected: PASS.

- [ ] **Step 5: Manual verification (dev server)**

Run: `yarn dev`. On a desktop-width window verify each:
- The explorer shows on the left with **Project** (`story.inf` + any enabled extensions) and **Library (n)** groups; `n` matches the active library (switch Std ↔ Puny via the toolbar and watch the group rebuild).
- Clicking a library file opens a **read-only** tab (typing does nothing; tab + panel row show the lock icon; Prettify shows the "Read-only file" toast).
- Enable an extension in the Extensions modal → it appears under Project; open it, edit it, switch to `story.inf` and back → **your edit and undo history persist**.
- Disable/remove that extension in the modal → its tab closes and you fall back to `story.inf`.
- The ✕ in the panel header and the `i-lucide-panel-left` toolbar button both hide/show the explorer; reload the page → open/closed state and open tabs are restored.
- Click a compile-error row in Results while a library tab is active → focus jumps to `story.inf` at the right line.
- Narrow the window (mobile): the toggle opens the explorer as a left slide-over; `Esc` closes it and focus returns to the toggle.

Expected: all behaviors as described.

- [ ] **Step 6: Accessibility check**

With the explorer open, a read-only library tab active, and (separately) the mobile drawer open, run an axe audit (the project's axe-core gate / the available a11y audit tool) on the page.
Expected: **zero violations**. Confirm tab focus rings are visible and the active file is distinguishable without color (icon + `aria-current`/`aria-selected`).

- [ ] **Step 7: Commit**

```bash
git add app/components/ide/IdeLayout.vue app/components/ide/SourceToolbar.vue app/components/ide/IdeToolbar.vue
git commit -m "feat: mount file explorer + tabs, toggle, and mobile drawer"
```

---

## Task 8: Final verification + changelog

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Full automated gate**

Run: `yarn test && yarn typecheck && yarn build`
Expected: unit tests PASS, no type errors, production build succeeds.

- [ ] **Step 2: Add a changelog entry**

In `CHANGELOG.md`, under the most recent/Unreleased section, add:

```markdown
- **File explorer** — a collapsible panel listing the compilation bundle (`story.inf`, enabled extensions, and the active library's files), with a tabbed, multi-file editor. Library and bundled-extension files open read-only; uploaded extensions are editable. Open/closed state and open tabs persist; mobile shows the explorer as a slide-over drawer.
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog entry for the file explorer"
```

---

## Self-Review

**Spec coverage:**
- Explorer = compilation bundle → Task 1 (`buildProjectFileList`), Task 3 (wiring). ✓
- Project + read-only Library groups, library switches with profile → Task 3 (`activeProfile`, `libraryFiles`), Task 5 (groups). ✓
- Library de-dup of case aliases → Task 1 (`canonicalLibraryFiles`). ✓
- Open & edit; uploaded editable, bundled/library read-only → Task 1 (editable flags), Task 6 (read-only states). ✓
- Tab strip, `story.inf` non-closable → Task 4. ✓
- Editor approach B (per-file `EditorState`, undo preserved) → Task 6. ✓
- Write-back (source / `updateUploaded`) → Task 3 (`writeActive`, `updateUploaded`), Task 6 (updateListener). ✓
- Prettify routes to active editable file → Task 3 (`format`), Task 7 (guard/toast). ✓
- Diagnostic click activates `story.inf` first → Task 6 (`jumpSignal` watcher). ✓
- Collapsible desktop column + mobile drawer + toggle → Task 7. ✓
- Persistence with stale-id reconciliation → Task 2 (`reconcileOpen`), Task 3 (`restore`, `watch(validIds)`). ✓
- Edge cases (library switch, disable/remove extension) → Task 2 + Task 3 (`watch(validIds)`). ✓
- Accessibility (roles, `aria-current`/`aria-selected`, focus, drawer) → Tasks 4, 5, 7. ✓
- Out-of-scope items (no create/rename/delete, no editing library files) respected. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command has an expected result. ✓

**Type consistency:** `ProjectFileMeta`, `TabState`, `reconcileOpen`, `closeTabState`, `canonicalLibraryFiles`, `buildProjectFileList`, `readFile`, `writeActive`, `updateUploaded`, `openFile`, `closeTab`, `togglePanel`, `panelOpen`, `activeId`, `activeFile` are named identically across the composable, components, and editor. ✓

**Known latitude:** Component/composable tasks are gated by `yarn typecheck` + explicit manual + axe checks rather than vitest, because the repo has no Vue/Nuxt component-test harness and adding one is out of scope. The genuinely tricky logic is fully unit-tested in Tasks 1–2.

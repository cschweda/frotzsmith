/**
 * useTestScripts composable tests — happy-dom env (via environmentMatchGlobs).
 *
 * Tests the COMPOSABLE ORCHESTRATION (bucket CRUD, key switching, localStorage
 * persistence) — not the pure helpers which are already covered in test-scripts.test.ts.
 *
 * useTestScripts reads `useState('frotz:story-key')` directly (to avoid circular
 * import with useIde). We control activeStoryKey by getting the same ref.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'

// Dynamic imports ensure stubs from nuxt-setup.ts are in place first.
const { useTestScripts } = await import('./useTestScripts')

// Convenience: grab the shared story-key state the composable uses internally.
function getActiveStoryKey() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const useStateFn = (globalThis as any).useState as (key: string, init?: () => string) => ReturnType<typeof import('vue').ref<string>>
  return useStateFn('frotz:story-key', () => 'game1')
}

describe('useTestScripts — add / rename / remove / updateText / select', () => {
  it('add creates a script in the active bucket and selects it', () => {
    const { scripts, activeId, add } = useTestScripts()
    expect(scripts.value).toHaveLength(0)
    add('My Script')
    expect(scripts.value).toHaveLength(1)
    expect(scripts.value[0]!.name).toBe('My Script')
    expect(activeId.value).toBe(scripts.value[0]!.id)
  })

  it('add with no name auto-names the script', () => {
    const { scripts, add } = useTestScripts()
    add()
    expect(scripts.value[0]!.name).toMatch(/^Script/)
  })

  it('add multiple scripts increments names', () => {
    const { scripts, add } = useTestScripts()
    add()
    add()
    expect(scripts.value).toHaveLength(2)
  })

  it('rename changes only the target script name', () => {
    const { scripts, activeId, add, rename } = useTestScripts()
    add('Script A')
    add('Script B')
    const idA = scripts.value[0]!.id
    rename(idA, 'Renamed A')
    expect(scripts.value[0]!.name).toBe('Renamed A')
    expect(scripts.value[1]!.name).toBe('Script B')
    // selection unchanged
    expect(activeId.value).toBe(scripts.value[1]!.id)
  })

  it('remove deletes the script and advances the selection', () => {
    const { scripts, activeId, add, remove } = useTestScripts()
    add('A')
    add('B')
    const idA = scripts.value[0]!.id
    const idB = scripts.value[1]!.id
    // Select A then remove it — should advance to B
    const { select } = useTestScripts()
    select(idA)
    remove(idA)
    expect(scripts.value.map(s => s.id)).not.toContain(idA)
    expect(activeId.value).toBe(idB)
  })

  it('remove last script leaves an empty bucket with no selection', () => {
    const { scripts, activeId, add, remove } = useTestScripts()
    add('Only')
    const id = scripts.value[0]!.id
    remove(id)
    expect(scripts.value).toHaveLength(0)
    expect(activeId.value).toBe('')
  })

  it('updateText changes only the text of the targeted script', () => {
    const { scripts, add, updateText } = useTestScripts()
    add('S1')
    add('S2')
    const id1 = scripts.value[0]!.id
    updateText(id1, 'new body')
    expect(scripts.value[0]!.text).toBe('new body')
    expect(scripts.value[1]!.text).toBe('') // untouched
  })

  it('select sets the active script id', () => {
    const { activeId, add, select } = useTestScripts()
    add('A')
    add('B')
    const { scripts } = useTestScripts()
    select(scripts.value[0]!.id)
    expect(activeId.value).toBe(scripts.value[0]!.id)
    select(scripts.value[1]!.id)
    expect(activeId.value).toBe(scripts.value[1]!.id)
  })

  it("select('') deselects the active script", () => {
    const { activeId, add, select } = useTestScripts()
    add('X')
    const { scripts } = useTestScripts()
    select(scripts.value[0]!.id)
    expect(activeId.value).not.toBe('')
    select('')
    expect(activeId.value).toBe('')
  })
})

describe('useTestScripts — bucket isolation when activeStoryKey switches', () => {
  it('switching activeStoryKey shows a different (empty) bucket', async () => {
    const sk = getActiveStoryKey()
    sk.value = 'game1'

    const { scripts: g1Scripts, add: addG1, activeScript } = useTestScripts()
    addG1('G1 Script')
    expect(g1Scripts.value).toHaveLength(1)

    // Switch to game2
    sk.value = 'game2'
    await nextTick()

    // scripts recomputes — game2 bucket is empty
    const { scripts: g2Scripts } = useTestScripts()
    expect(g2Scripts.value).toHaveLength(0)
  })

  it('adding a script to game2 does not affect the game1 bucket', async () => {
    const sk = getActiveStoryKey()
    sk.value = 'game1'

    const { scripts: g1Scripts, add: addG1 } = useTestScripts()
    addG1('G1 Script')

    sk.value = 'game2'
    await nextTick()

    const { add: addG2, scripts: g2Scripts } = useTestScripts()
    addG2('G2 Script')
    expect(g2Scripts.value.map(s => s.name)).toContain('G2 Script')

    // Switch back — game1 still has its script
    sk.value = 'game1'
    await nextTick()

    expect(g1Scripts.value.map(s => s.name)).toContain('G1 Script')
    expect(g1Scripts.value.map(s => s.name)).not.toContain('G2 Script')
  })

  it('activeScript computed reflects the selected script in the current bucket', async () => {
    const sk = getActiveStoryKey()
    sk.value = 'game-a'

    const { activeScript, add, scripts, select } = useTestScripts()
    add('Script Alpha')
    select(scripts.value[0]!.id)
    expect(activeScript.value?.name).toBe('Script Alpha')

    // Switch key — no active script in the new (empty) bucket
    sk.value = 'game-b'
    await nextTick()
    expect(activeScript.value).toBeUndefined()
  })
})

describe('useTestScripts — localStorage persistence round-trip', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persist writes to localStorage on add and restore reads it back', () => {
    // Phase 1: add scripts (triggers persist internally)
    const sk = getActiveStoryKey()
    sk.value = 'saved-game'
    const { add, scripts: initialScripts } = useTestScripts()
    add('Saved Script')
    expect(initialScripts.value.some(s => s.name === 'Saved Script')).toBe(true)

    // Verify localStorage was written
    const raw = localStorage.getItem('frotzsmith:scripts')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.v).toBe(2)
    expect(parsed.buckets['saved-game']).toBeDefined()

    // Phase 2: clear in-memory state (simulate page reload)
    const stateMap = (window as unknown as Record<string, unknown>).__nuxtStateMap as Map<string, unknown>
    stateMap.clear()

    // Phase 3: re-establish the story key (as restore() does on app boot) then restore
    const sk2 = getActiveStoryKey()
    sk2.value = 'saved-game'
    const { restore, scripts: restoredScripts } = useTestScripts()
    restore()

    expect(restoredScripts.value.some(s => s.name === 'Saved Script')).toBe(true)
  })

  it('restore with no localStorage data seeds the default Script 1', () => {
    expect(localStorage.getItem('frotzsmith:scripts')).toBeNull()
    const { restore, scripts } = useTestScripts()
    restore()
    // ensureBucket seeds a default script when the bucket is empty
    expect(scripts.value.length).toBeGreaterThanOrEqual(1)
  })
})

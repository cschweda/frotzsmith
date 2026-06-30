/**
 * usePlayTranscript composable tests — happy-dom env (via environmentMatchGlobs).
 *
 * Nuxt auto-imports (useState, computed, watch) are provided as window globals
 * by test/nuxt-setup.ts. useIde is stubbed to prevent the circular watch chain
 * (usePlayTranscript sets up watch(activeStoryKey) inside if (import.meta.client)).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Stub useIde before the composable module is evaluated so the
// if (import.meta.client) block inside usePlayTranscript doesn't recurse.
vi.stubGlobal('useIde', () => ({
  activeStoryKey: ref('untitled'),
}))

// Import after stubs are in place (vi.stubGlobal is NOT hoisted like vi.mock,
// but composable function bodies run lazily so the stub is ready before they call out).
const { usePlayTranscript } = await import('./usePlayTranscript')

describe('usePlayTranscript', () => {
  // stateMap is cleared before each test by nuxt-setup.ts → fresh useState state.
  beforeEach(() => {
    // Re-stub useIde after each potential clear so the watch handler uses the
    // latest activeStoryKey ref from the fresh state map.
    vi.stubGlobal('useIde', () => ({
      activeStoryKey: ref('untitled'),
    }))
  })

  it('record trims and appends non-empty commands', () => {
    const { commands, record } = usePlayTranscript()
    record('  look  ')
    record('north')
    expect(commands.value).toEqual(['look', 'north'])
  })

  it('record skips blank / whitespace-only commands', () => {
    const { commands, record } = usePlayTranscript()
    record('look')
    record('   ')
    record('')
    expect(commands.value).toEqual(['look'])
  })

  it('reset clears all commands', () => {
    const { commands, record, reset } = usePlayTranscript()
    record('look')
    record('north')
    reset()
    expect(commands.value).toEqual([])
  })

  it('count computed reflects number of recorded commands', () => {
    const { count, record } = usePlayTranscript()
    expect(count.value).toBe(0)
    record('look')
    expect(count.value).toBe(1)
    record('north')
    expect(count.value).toBe(2)
  })

  it('text computed joins commands one per line', () => {
    const { text, record } = usePlayTranscript()
    record('look')
    record('north')
    expect(text.value).toBe('look\nnorth')
  })

  it('text computed is empty string with no commands', () => {
    const { text } = usePlayTranscript()
    expect(text.value).toBe('')
  })

  it('state is shared across multiple usePlayTranscript() calls (useState semantics)', () => {
    const a = usePlayTranscript()
    a.record('look')
    const b = usePlayTranscript()
    // Both see the same commands ref (shared via useState key)
    expect(b.commands.value).toEqual(['look'])
  })
})

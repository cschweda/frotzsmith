/**
 * useMap composable tests — happy-dom env (via environmentMatchGlobs).
 *
 * Nuxt auto-imports (useState, computed, watch) are provided as window globals
 * by test/nuxt-setup.ts. The module-level mapWatchRegistered flag inside useMap
 * persists across tests in the same module, which is fine: the watcher itself
 * uses the shared useState refs that are cleared per-test by nuxt-setup.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest'

const { useMap } = await import('./useMap')

describe('useMap', () => {
  beforeEach(() => { useMap().reset() })

  it('records the start room with no edge', () => {
    const m = useMap()
    m.recordRoom('Cottage', 'A cosy cottage.')
    expect(m.currentRoom.value).toBe('Cottage')
    expect(m.graph.value.edges).toEqual([])
    expect(m.graph.value.start).toBe('Cottage')
  })

  it('pairs a movement command with the next room into an edge', () => {
    const m = useMap()
    m.recordRoom('Cottage', 'A cosy cottage.')
    m.recordCommand('north')
    m.recordRoom('Meadow', 'A sunlit meadow.\n\nYou can see a daisy here.')
    expect(m.graph.value.edges).toEqual([{ from: 'Cottage', to: 'Meadow', dir: 'n' }])
    expect(m.details('Meadow')).toMatchObject({ exits: [], objects: ['daisy'] })
    expect(m.details('Cottage').exits).toEqual(['n'])
  })

  it('does not draw a phantom edge from a second room update without a new command', () => {
    const m = useMap()
    m.recordRoom('Cottage', 'x'); m.recordCommand('north'); m.recordRoom('Meadow', 'y')
    m.recordRoom('Meadow', 'y2') // e.g. a redraw — lastDir already cleared
    expect(m.graph.value.edges.length).toBe(1)
  })

  it('reset() clears everything', () => {
    const m = useMap()
    m.recordRoom('Cottage', 'x'); m.reset()
    expect(m.graph.value.rooms).toEqual([])
    expect(m.currentRoom.value).toBeNull()
  })
})

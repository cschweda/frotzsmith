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
    // Meadow was entered heading north, so it has a south connection back to
    // Cottage (the reverse of the in-edge), even with no advertised exits line.
    expect(m.details('Meadow')).toMatchObject({ exits: ['s'], objects: ['daisy'] })
    expect(m.details('Cottage').exits).toEqual(['n'])
  })

  it('does not draw a phantom edge from a second room update without a new command', () => {
    const m = useMap()
    m.recordRoom('Cottage', 'x'); m.recordCommand('north'); m.recordRoom('Meadow', 'y')
    m.recordRoom('Meadow', 'y2') // e.g. a redraw — lastDir already cleared
    expect(m.graph.value.edges.length).toBe(1)
  })

  it('keeps a sticky union of objects ever seen in a room, even after they are taken', () => {
    const m = useMap()
    // First visit lists two objects.
    m.recordRoom('Vault', 'A cold vault.\n\nYou can see a ruby and a gold bar here.')
    // Come back later (via another room) after taking the ruby — description no
    // longer lists it. `objects` (current) drops it; `seenObjects` (sticky) keeps it.
    m.recordCommand('north'); m.recordRoom('Hall', 'A hall.')
    m.recordCommand('south'); m.recordRoom('Vault', 'A cold vault.\n\nYou can see a gold bar here.')
    const d = m.details('Vault')
    expect(d.objects).toEqual(['gold bar'])
    expect(d.seenObjects).toEqual(['ruby', 'gold bar'])
  })

  it('records advertised exits and marks connected vs unexplored in details()', () => {
    const m = useMap()
    m.recordRoom('Foyer', 'You are in the foyer.\nObvious exits: south, west, east.')
    m.recordCommand('east'); m.recordRoom('Living Room', 'You are in the living room.\nObvious exits: west.')
    const foyer = m.details('Foyer')
    expect(foyer.exits).toEqual(['e', 's', 'w']) // everything the foyer advertises
    expect(foyer.connectedExits).toEqual(['e']) // east has a connector → south + west are stubs
    // Living Room was entered FROM the west; that connector counts as connected,
    // so its advertised "west" is NOT drawn as a redundant unexplored stub.
    const living = m.details('Living Room')
    expect(living.exits).toEqual(['w'])
    expect(living.connectedExits).toEqual(['w'])
  })

  it('toggles the map view mode and reset() does NOT change it (view preference)', () => {
    const m = useMap()
    expect(m.mapMode.value).toBe('player')
    m.toggleMapMode()
    expect(m.mapMode.value).toBe('dev')
    m.recordRoom('Cottage', 'x'); m.reset()
    expect(m.mapMode.value).toBe('dev') // survives a world reset
  })

  it('reset() clears everything', () => {
    const m = useMap()
    m.recordRoom('Cottage', 'A cosy cottage.\n\nYou can see a lamp here.'); m.reset()
    expect(m.graph.value.rooms).toEqual([])
    expect(m.currentRoom.value).toBeNull()
    expect(m.roomObjects.value).toEqual({})
  })
})

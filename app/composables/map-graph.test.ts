import { describe, it, expect } from 'vitest'
import { emptyGraph, parseDirection, parseRoomName, addStep, layout, exitsOf, parseObjects } from './map-graph'

describe('parseDirection', () => {
  it('maps abbreviations, full words, and "go X" to a Dir', () => {
    expect(parseDirection('n')).toBe('n')
    expect(parseDirection('north')).toBe('n')
    expect(parseDirection('go north')).toBe('n')
    expect(parseDirection('NE')).toBe('ne')
    expect(parseDirection('southwest')).toBe('sw')
    expect(parseDirection('up')).toBe('u')
    expect(parseDirection('in')).toBe('in')
    expect(parseDirection('out')).toBe('out')
  })
  it('returns null for non-movement commands', () => {
    expect(parseDirection('take lamp')).toBeNull()
    expect(parseDirection('')).toBeNull()
    expect(parseDirection('examine door')).toBeNull()
  })
})

describe('parseRoomName', () => {
  it('takes the left-aligned name before the score/moves gap', () => {
    expect(parseRoomName('Cottage            Score: 0    Moves: 4')).toBe('Cottage')
    expect(parseRoomName('Fortune Booth      0/12')).toBe('Fortune Booth')
    expect(parseRoomName('Meadow')).toBe('Meadow')
  })
  it('is empty when there is no status text', () => {
    expect(parseRoomName('')).toBe('')
    expect(parseRoomName('   ')).toBe('')
  })
})

describe('addStep', () => {
  it('adds the first room as start with no edge', () => {
    const g = addStep(emptyGraph(), null, null, 'Cottage')
    expect(g.rooms).toEqual(['Cottage'])
    expect(g.start).toBe('Cottage')
    expect(g.edges).toEqual([])
  })
  it('adds a room and a directional edge when the room changes', () => {
    let g = addStep(emptyGraph(), null, null, 'Cottage')
    g = addStep(g, 'Cottage', 'n', 'Meadow')
    expect(g.rooms).toEqual(['Cottage', 'Meadow'])
    expect(g.edges).toEqual([{ from: 'Cottage', to: 'Meadow', dir: 'n' }])
  })
  it('adds no edge on a failed move (room unchanged)', () => {
    let g = addStep(emptyGraph(), null, null, 'Cottage')
    g = addStep(g, 'Cottage', 'n', 'Cottage')
    expect(g.edges).toEqual([])
  })
  it('adds no edge for a non-movement command but still records the room', () => {
    let g = addStep(emptyGraph(), null, null, 'Cottage')
    g = addStep(g, 'Cottage', null, 'Cottage')
    expect(g.edges).toEqual([])
    expect(g.rooms).toEqual(['Cottage'])
  })
  it('does not duplicate an existing edge on revisit', () => {
    let g = addStep(emptyGraph(), null, null, 'Cottage')
    g = addStep(g, 'Cottage', 'n', 'Meadow')
    g = addStep(g, 'Meadow', 's', 'Cottage')
    g = addStep(g, 'Cottage', 'n', 'Meadow') // revisit
    expect(g.edges.filter(e => e.from === 'Cottage' && e.to === 'Meadow').length).toBe(1)
  })
})

function build(steps: Array<[string | null, import('./map-graph').Dir | null, string]>) {
  let g = emptyGraph()
  for (const [p, d, n] of steps) g = addStep(g, p, d, n)
  return g
}

describe('layout', () => {
  it('places a linear chain by direction deltas', () => {
    const g = build([[null, null, 'A'], ['A', 'n', 'B'], ['B', 'e', 'C']])
    const L = layout(g)
    const at = (name: string) => L.rooms.find(r => r.name === name)!
    expect(at('A')).toMatchObject({ col: 0, row: 0 })
    expect(at('B')).toMatchObject({ col: 0, row: -1 }) // north = row-1
    expect(at('C')).toMatchObject({ col: 1, row: -1 }) // east = col+1
    expect(L.connectors.every(c => c.grid)).toBe(true)
    expect(L.bounds).toEqual({ minCol: 0, maxCol: 1, minRow: -1, maxRow: 0 })
  })

  it('marks u/d as non-grid stubs and still places the target', () => {
    const g = build([[null, null, 'Hall'], ['Hall', 'd', 'Cellar']])
    const L = layout(g)
    expect(L.rooms.find(r => r.name === 'Cellar')).toBeTruthy()
    expect(L.connectors[0]).toMatchObject({ from: 'Hall', to: 'Cellar', dir: 'd', grid: false })
  })

  it('resolves a cell conflict to a free cell with a non-grid connector', () => {
    // Two different rooms both "north" of A -> second can't share the cell.
    const g = build([[null, null, 'A'], ['A', 'n', 'B'], ['A', 'n', 'C']])
    const L = layout(g)
    const b = L.rooms.find(r => r.name === 'B')!
    const c = L.rooms.find(r => r.name === 'C')!
    expect([b.col, b.row]).not.toEqual([c.col, c.row]) // no overlap
    expect(L.connectors.find(x => x.to === 'C')!.grid).toBe(false)
  })

  it('is deterministic for a fixed graph', () => {
    const g = build([[null, null, 'A'], ['A', 'n', 'B'], ['B', 'e', 'C'], ['C', 's', 'D']])
    expect(layout(g)).toEqual(layout(g))
  })

  it('returns empty bounds for an empty graph', () => {
    expect(layout(emptyGraph())).toEqual({ rooms: [], connectors: [], bounds: { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 } })
  })
})

describe('exitsOf', () => {
  it('returns out-edges in canonical order', () => {
    const g = build([[null, null, 'A'], ['A', 'e', 'B'], ['A', 'n', 'C'], ['A', 'd', 'D']])
    expect(exitsOf(g, 'A')).toEqual(['n', 'e', 'd']) // canonical: n,ne,e,se,s,sw,w,nw,u,d,in,out
  })
  it('returns [] for a room with no out-edges', () => {
    const g = build([[null, null, 'A'], ['A', 'n', 'B']])
    expect(exitsOf(g, 'B')).toEqual([])
  })
})

describe('parseObjects', () => {
  it('extracts a single listed object, article stripped', () => {
    expect(parseObjects('A cosy cottage.\n\nYou can see a brass lamp here.')).toEqual(['brass lamp'])
  })
  it('splits "and"/commas into multiple objects', () => {
    expect(parseObjects('You can see a lamp and a silver key here.')).toEqual(['lamp', 'silver key'])
    expect(parseObjects('You can see a rock, a stick and a coin here.')).toEqual(['rock', 'stick', 'coin'])
  })
  it('handles "there is X here" and "you can also see"', () => {
    expect(parseObjects('There is a rusty sword here.')).toEqual(['rusty sword'])
    expect(parseObjects('You can also see a map here.')).toEqual(['map'])
  })
  it('returns [] when nothing matches', () => {
    expect(parseObjects('A featureless room.')).toEqual([])
    expect(parseObjects('')).toEqual([])
  })
})

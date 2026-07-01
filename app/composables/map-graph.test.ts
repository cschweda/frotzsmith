import { describe, it, expect } from 'vitest'
import { emptyGraph, parseDirection, parseRoomName, addStep, layout, exitsOf, connectedDirs, parseObjects, parseExits, fitViewBox } from './map-graph'

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

  it('lays out a component entered via a non-directional edge by its own compass exits', () => {
    // Haunted House: you start Outside (no compass exit — you enter by the magic
    // word PLUGH, which parses to no direction), then go east, east. Foyer/Living/
    // Dining are unreachable from `start` via edges, but their east-edges between
    // each other must still be honored — a left→right row, not a spiral stack.
    const g = build([
      [null, null, 'Outside'],
      ['Outside', null, 'Foyer'], // magic word: room recorded, but no edge
      ['Foyer', 'e', 'Living'],
      ['Living', 'e', 'Dining'],
    ])
    const L = layout(g)
    const at = (name: string) => L.rooms.find(r => r.name === name)!
    // East edges place each room one column to the right, same row.
    expect(at('Living').col).toBe(at('Foyer').col + 1)
    expect(at('Living').row).toBe(at('Foyer').row)
    expect(at('Dining').col).toBe(at('Living').col + 1)
    expect(at('Dining').row).toBe(at('Living').row)
    // …and the connectors are solid (grid), not the dashed spiral fallback.
    expect(L.connectors.filter(c => c.dir === 'e').every(c => c.grid)).toBe(true)
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

describe('connectedDirs', () => {
  it('includes out-edges and the reverse of in-edges', () => {
    // A -e-> B: A is connected east (out-edge); B is connected west (came from A).
    const g = build([[null, null, 'A'], ['A', 'e', 'B']])
    expect(connectedDirs(g, 'A')).toEqual(['e'])
    expect(connectedDirs(g, 'B')).toEqual(['w'])
  })
})

describe('parseExits', () => {
  it('parses an "Obvious exits: …" line into canonical-order directions', () => {
    expect(parseExits('You are in the foyer.\nObvious exits: south, west, east.')).toEqual(['e', 's', 'w'])
  })
  it('handles up/down/in and abbreviations', () => {
    expect(parseExits('Obvious exits: north, up, in.')).toEqual(['n', 'u', 'in'])
    expect(parseExits('Exits: n, se, w.')).toEqual(['n', 'se', 'w'])
  })
  it('accepts the "You can go …" phrasing', () => {
    expect(parseExits('You can go north or east.')).toEqual(['n', 'e'])
  })
  it('returns [] for "none" and when there is no exits line', () => {
    expect(parseExits('Obvious exits: none.')).toEqual([])
    expect(parseExits('A featureless room. The way out is barred.')).toEqual([])
    expect(parseExits('')).toEqual([])
  })
  it('is not fooled by the word "exits" without a colon in prose', () => {
    expect(parseExits('All the exits are sealed shut.')).toEqual([])
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
  it('catches "there is X on/in the …" placement phrasing', () => {
    expect(parseObjects('There is a mysterious scroll on the ground.')).toEqual(['mysterious scroll'])
    expect(parseObjects('There is a coin in the fountain.')).toEqual(['coin'])
  })
  it('does not swallow narrative "there is … the …" without a spatial preposition', () => {
    // The scroll's examine text must not be mistaken for a room object.
    expect(parseObjects("It says, 'There is ESCAPE from the second floor!'")).toEqual([])
  })
  it('de-duplicates an object matched by more than one pattern', () => {
    expect(parseObjects('You can see a lamp here.\nThere is a lamp here.')).toEqual(['lamp'])
  })
  it('fuzzily lifts objects out of custom describe prose (subject-verb)', () => {
    expect(parseObjects('A knife is levitating in the middle of the room.')).toEqual(['knife'])
    expect(parseObjects('An ornate lamp rests on the mantel.')).toEqual(['ornate lamp'])
  })
  it('fuzzily lifts objects introduced after a placement verb (verb-subject)', () => {
    expect(parseObjects('On the floor sits a rusty sword.')).toEqual(['rusty sword'])
  })
  it('captures both a custom-described and a listed object from one room', () => {
    const living = 'The Living Room\nYou are in the living room.\n\n' +
      'A knife is levitating in the middle of the room.\n\nThere is a mysterious scroll on the ground.'
    expect(parseObjects(living)).toEqual(['knife', 'mysterious scroll'])
  })
  it('does not treat narrative sentences as objects', () => {
    // "keeps" is not a placement verb; "the wind is…" is a definite-article clause;
    // pronoun-laden fragments are rejected outright.
    expect(parseObjects('A mysterious force keeps you planted in place.')).toEqual([])
    expect(parseObjects('The wind is restless today, blowing leaves around.')).toEqual([])
    expect(parseObjects('It is a dark and stormy night.')).toEqual([])
  })
  it('returns [] when nothing matches', () => {
    expect(parseObjects('A featureless room.')).toEqual([])
    expect(parseObjects('')).toEqual([])
  })
})

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

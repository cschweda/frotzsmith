import { describe, it, expect } from 'vitest'
import { emptyGraph, parseDirection, parseRoomName, addStep } from './map-graph'

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

import { describe, it, expect } from 'vitest'
import { appendCommand, toScriptText, nextPlaythroughName } from './play-transcript'

describe('appendCommand', () => {
  it('appends a trimmed command', () => {
    expect(appendCommand(['look'], '  north ')).toEqual(['look', 'north'])
  })
  it('appends to an empty list', () => {
    expect(appendCommand([], 'x')).toEqual(['x'])
  })
  it('ignores blank / whitespace-only commands', () => {
    expect(appendCommand(['look'], '   ')).toEqual(['look'])
    expect(appendCommand(['look'], '')).toEqual(['look'])
  })
  it('ignores blank command on an empty list (returns same empty array)', () => {
    expect(appendCommand([], '   ')).toEqual([])
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

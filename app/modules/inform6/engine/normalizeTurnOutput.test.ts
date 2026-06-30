import { describe, it, expect } from 'vitest'
import { normalizeTurnOutput } from './normalizeTurnOutput'

describe('normalizeTurnOutput (zmachine)', () => {
  it('strips a trailing command prompt line', () => {
    expect(normalizeTurnOutput('You see a lamp here.\n\n>', 'zmachine')).toBe('You see a lamp here.')
  })

  it('strips a trailing prompt with a space', () => {
    expect(normalizeTurnOutput('Taken.\n> ', 'zmachine')).toBe('Taken.')
  })

  it('trims trailing whitespace on each line', () => {
    expect(normalizeTurnOutput('A   \nB\t\n', 'zmachine')).toBe('A\nB')
  })

  it('collapses 3+ blank lines to one blank line', () => {
    expect(normalizeTurnOutput('A\n\n\n\nB', 'zmachine')).toBe('A\n\nB')
  })

  it('returns empty string for prompt-only output', () => {
    expect(normalizeTurnOutput('\n>', 'zmachine')).toBe('')
  })

  it('strips trailing prompt when followed by blank lines (real VM shape)', () => {
    expect(normalizeTurnOutput('Cottage\nA room.\n\n>', 'zmachine')).toBe('Cottage\nA room.')
  })

  it('strips trailing prompt preceded and followed by blank lines', () => {
    expect(normalizeTurnOutput('Cottage\n\n>\n\n', 'zmachine')).toBe('Cottage')
  })
})

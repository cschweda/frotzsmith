/** The Play tab's player choice: frotzplay unless Parchment was chosen, remembered per browser. */
import { describe, expect, it } from 'vitest'
import { PLAYER_KEY, readPlayerChoice } from './usePlayerChoice'

describe('readPlayerChoice', () => {
  it('defaults to frotzplay', () => {
    expect(readPlayerChoice(null)).toBe('frotzplay')
    expect(readPlayerChoice('')).toBe('frotzplay')
    expect(readPlayerChoice('something else')).toBe('frotzplay')
  })
  it('keeps Parchment when chosen', () => {
    expect(readPlayerChoice('parchment')).toBe('parchment')
  })
  it('is kept under a Frotzsmith key', () => {
    expect(PLAYER_KEY).toBe('frotzsmith:player')
  })
})

/**
 * frotzplay-feed — Send-to-Play through frotzplay's player API, and the room the
 * auto-map reads from its status line. A fake player stands in for ZPlayer; the
 * real one is driven by the same calls (frotzlens packages/player tests).
 */
import { describe, expect, it } from 'vitest'
import { feedPlayer, MAX_KEY_PROMPTS, roomFromStatus, type FeedablePlayer } from './frotzplay-feed'

/** A game that takes lines, optionally asks for a key first, and quits after `quitAfter` lines. */
function fakePlayer(opts: { keyBefore?: number[]; quitAfter?: number; stuckOnKeys?: boolean } = {}) {
  const lines: string[] = []
  const keys: string[] = []
  const state = { phase: opts.keyBefore?.includes(0) ? 'char' : 'line' }
  const p: FeedablePlayer & { lines: string[]; keys: string[] } = {
    state,
    lines,
    keys,
    async send(line) {
      if (state.phase !== 'line') return false
      lines.push(line)
      state.phase = opts.quitAfter !== undefined && lines.length >= opts.quitAfter ? 'quit' : opts.keyBefore?.includes(lines.length) ? 'char' : 'line'
      return true
    },
    async press(key) {
      if (state.phase !== 'char') return false
      keys.push(key)
      if (!opts.stuckOnKeys) state.phase = 'line'
      return true
    },
  }
  return p
}

const quick = { paceMs: 0, isVisible: () => true }

describe('feedPlayer', () => {
  it('sends every command, in order', async () => {
    const p = fakePlayer()
    expect(await feedPlayer(p, ['look', 'take lamp', 'north'], quick)).toEqual({ completed: true, fed: 3, total: 3 })
    expect(p.lines).toEqual(['look', 'take lamp', 'north'])
  })

  it('presses through a "press a key" prompt with Space, then carries on', async () => {
    const p = fakePlayer({ keyBefore: [0, 2] })
    const out = await feedPlayer(p, ['a', 'b', 'c'], quick)
    expect(out.completed).toBe(true)
    expect(p.keys).toEqual([' ', ' '])
    expect(p.lines).toEqual(['a', 'b', 'c'])
  })

  it('stops, and says where, when the game quits part-way', async () => {
    const p = fakePlayer({ quitAfter: 2 })
    expect(await feedPlayer(p, ['a', 'b', 'c', 'd'], quick)).toEqual({ completed: false, fed: 2, total: 4 })
  })

  it('gives up on a game that only ever wants keys', async () => {
    const p = fakePlayer({ keyBefore: [0], stuckOnKeys: true })
    expect(await feedPlayer(p, ['a'], quick)).toEqual({ completed: false, fed: 0, total: 1 })
    expect(p.keys).toHaveLength(MAX_KEY_PROMPTS)
  })

  it('paces only when the tab is visible', async () => {
    const t0 = Date.now()
    await feedPlayer(fakePlayer(), ['a', 'b', 'c'], { paceMs: 50, isVisible: () => false })
    expect(Date.now() - t0).toBeLessThan(40)
    const t1 = Date.now()
    await feedPlayer(fakePlayer(), ['a', 'b', 'c'], { paceMs: 30, isVisible: () => true })
    expect(Date.now() - t1).toBeGreaterThanOrEqual(55) // two gaps, none after the last
  })
})

describe('roomFromStatus', () => {
  it('v3: the status line’s location', () => {
    expect(roomFromStatus({ version: 3, status: { left: ' West of House ' }, upper: [] })).toBe('West of House')
  })
  it('v4+: the top row up to its first wide gap, as the Parchment page reads it', () => {
    expect(roomFromStatus({ version: 5, status: { left: '' }, upper: [' Cellar                 Score: 0  Moves: 3'] })).toBe('Cellar')
    expect(roomFromStatus({ version: 5, status: { left: '' }, upper: ['   The Old Mill   12/50'] })).toBe('The Old Mill')
  })
  it('empty when there’s no status line', () => {
    expect(roomFromStatus({ version: 5, status: { left: '' }, upper: [] })).toBe('')
    expect(roomFromStatus({ version: 3, status: { left: '' }, upper: [] })).toBe('')
  })
})

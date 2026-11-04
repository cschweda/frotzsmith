import { describe, it, expect } from 'vitest'
import { HeadlessGlkOte, MAX_TURN_OUTPUT_CHARS, TRUNCATED_NOTICE } from './headless-glkote'

/** One buffer-window paragraph in glkapi's compressed run format. */
const para = (text: string) => ({ content: ['normal', text] })

describe('HeadlessGlkOte output cap', () => {
  it('truncates a runaway turn with a visible notice, then resets for the next turn', async () => {
    const g = new HeadlessGlkOte()
    g.init({ accept: () => {} })
    const chunk = 'x'.repeat(10_000)
    // A game printing in a loop: many updates, no input request.
    for (let i = 0; i < 100; i++) g.update({ gen: 1, content: [{ id: 1, text: [para(chunk)] }] })
    g.update({ gen: 2, content: [], input: [{ id: 1, type: 'line', gen: 2 }] })

    const turn = await g.nextTurn()
    expect(turn.buffer.length).toBeLessThanOrEqual(MAX_TURN_OUTPUT_CHARS + TRUNCATED_NOTICE.length)
    expect(turn.buffer.endsWith(TRUNCATED_NOTICE)).toBe(true)

    // The cap is per turn: the next turn starts clean.
    g.update({ gen: 3, content: [{ id: 1, text: [para('You are in a room.')] }], input: [{ id: 1, type: 'line', gen: 3 }] })
    const next = await g.nextTurn()
    expect(next.buffer).toBe('You are in a room.\n')
  })
})

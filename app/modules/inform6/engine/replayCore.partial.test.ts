import { describe, it, expect, vi } from 'vitest'

// An engine that boots, answers one command, then fails on the second.
vi.mock('./ZmachineEngine', () => ({
  ZmachineEngine: class {
    awaitingLine = true
    async boot() { return 'BANNER' }
    async send(command: string) {
      if (command === 'boom') throw new Error('Illegal opcode')
      return { command, output: `did ${command}` }
    }
  },
}))

const { runReplay, ReplayRunError } = await import('./replayCore')

describe('runReplay — an engine error part-way', () => {
  it('rejects with the turns played before the error', async () => {
    const err = await runReplay(new Uint8Array(), 'zmachine', ['look', 'boom', 'look']).catch(e => e)
    expect(err).toBeInstanceOf(ReplayRunError)
    expect(err.message).toBe('Illegal opcode')
    expect(err.turns).toEqual([
      { command: '', output: 'BANNER' },
      { command: 'look', output: 'did look' },
    ])
  })
})

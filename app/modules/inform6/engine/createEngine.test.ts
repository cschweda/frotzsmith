import { describe, it, expect } from 'vitest'
import { createEngine } from './StoryEngine'
import { ZmachineEngine } from './ZmachineEngine'

describe('createEngine', () => {
  it('returns a ZmachineEngine for the zmachine target', () => {
    expect(createEngine('zmachine')).toBeInstanceOf(ZmachineEngine)
  })

  it('throws for the (deferred) glulx target', () => {
    expect(() => createEngine('glulx')).toThrow(/Glulx not yet supported/)
  })
})

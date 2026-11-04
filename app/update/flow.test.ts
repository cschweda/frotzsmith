import { describe, it, expect, vi } from 'vitest'
import { createUpdateFlow } from './flow'
import { useUpdateFlow } from './prompt'

describe('createUpdateFlow', () => {
  it('reload() calls apply once and is applying meanwhile', async () => {
    let seen = ''
    let flow!: ReturnType<typeof createUpdateFlow>
    const apply = vi.fn(async () => {
      seen = flow.stage.value
    })
    flow = createUpdateFlow({ apply })
    await flow.reload()
    expect(apply).toHaveBeenCalledTimes(1)
    expect(seen).toBe('applying')
    expect(flow.stage.value).toBe('toast')
  })

  it('goes back to toast when apply throws', async () => {
    const flow = createUpdateFlow({ apply: async () => { throw new Error('x') } })
    await flow.reload().catch(() => {})
    expect(flow.stage.value).toBe('toast')
  })
})

describe('useUpdateFlow', () => {
  it('is one flow per visit', () => {
    expect(useUpdateFlow()).toBe(useUpdateFlow())
  })
})

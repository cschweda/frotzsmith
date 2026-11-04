import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createControllerWatch,
  flushBeforeReload,
  needRefresh,
  replaced,
  setBeforeReload,
} from './state'

describe('createControllerWatch', () => {
  beforeEach(() => {
    needRefresh.value = false
    replaced.value = false
  })

  it('an uncontrolled first change with no offer is the first-visit claim', () => {
    const reload = vi.fn()
    createControllerWatch({ controlled: false, reload }).onChange()
    expect(replaced.value).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('a change after apply() reloads once', () => {
    const reload = vi.fn()
    const w = createControllerWatch({ controlled: true, reload })
    w.apply()
    w.onChange()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('a change without apply() while controlled marks the tab replaced', () => {
    const reload = vi.fn()
    createControllerWatch({ controlled: true, reload }).onChange()
    expect(replaced.value).toBe(true)
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('flushBeforeReload', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    setBeforeReload(async () => {})
  })

  it('awaits the registered flush', async () => {
    let done = false
    setBeforeReload(async () => {
      await Promise.resolve()
      done = true
    })
    await flushBeforeReload()
    expect(done).toBe(true)
  })

  it('gives up after ms when the flush never resolves', async () => {
    setBeforeReload(() => new Promise<void>(() => {}))
    let finished = false
    const p = flushBeforeReload(1000).then(() => (finished = true))
    await vi.advanceTimersByTimeAsync(999)
    expect(finished).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await p
    expect(finished).toBe(true)
  })

  it('resolves when the flush rejects', async () => {
    setBeforeReload(async () => {
      throw new Error('nope')
    })
    await expect(flushBeforeReload()).resolves.toBeUndefined()
  })
})

/**
 * plugins/service-worker.client.ts — with a fake registration: the plugin
 * itself never reloads. Its hourly poll only asks the registration for a new
 * version, and a chunk error shows the offer rather than reloading.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POLL_MS } from '~/update/check'
import { needRefresh, replaced } from '~/update/state'

const registerSW = vi.fn((_options: Record<string, unknown>) => async () => {})
vi.mock('virtual:pwa-register', () => ({ registerSW: (o: Record<string, unknown>) => registerSW(o) }))

const registration = { update: vi.fn(async () => {}), waiting: null, installing: null }
const reload = vi.fn()
let hooks: Map<string, () => void>

beforeEach(() => {
  vi.useFakeTimers()
  needRefresh.value = false
  replaced.value = false
  registration.update.mockClear()
  reload.mockClear()
  registerSW.mockClear()
  hooks = new Map()
  vi.stubGlobal('defineNuxtPlugin', (setup: unknown) => setup)
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      controller: {},
      getRegistration: async () => registration,
    }),
  })
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function setUp() {
  const { default: plugin } = (await import('./service-worker.client')) as unknown as {
    default: (nuxtApp: unknown) => void
  }
  plugin({
    hook: (name: string, fn: () => void) => hooks.set(name, fn),
    runWithContext: (fn: () => unknown) => fn(),
  })
}

describe('service-worker plugin', () => {
  it('registers the worker in prompt mode (an offer, never a reload)', async () => {
    await setUp()
    expect(registerSW).toHaveBeenCalledTimes(1)
    const options = registerSW.mock.calls[0]![0] as { onNeedRefresh: () => void; onNeedReload: () => void }
    options.onNeedReload()
    expect(reload).not.toHaveBeenCalled()
    options.onNeedRefresh()
    expect(needRefresh.value).toBe(true)
    expect(reload).not.toHaveBeenCalled()
  })

  it('asks the registration for a new version hourly, and never reloads', async () => {
    await setUp()
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(registration.update).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(POLL_MS * 5)
    expect(registration.update).toHaveBeenCalledTimes(6)
    expect(reload).not.toHaveBeenCalled()
  })

  it('a chunk error shows the offer instead of reloading', async () => {
    await setUp()
    const onChunkError = hooks.get('app:chunkError')
    expect(onChunkError).toBeTypeOf('function')
    onChunkError!()
    expect(replaced.value).toBe(true)
    expect(needRefresh.value).toBe(true)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(reload).not.toHaveBeenCalled()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkMessage,
  createUpdateCheck,
  fetchNewest,
  POLL_MS,
  startUpdatePolling,
  type RegistrationLike,
} from './check'
import { UPDATE_READY } from './flow'

class FakeWorker extends EventTarget {
  state = 'installing'
  set(state: string) {
    this.state = state
    this.dispatchEvent(new Event('statechange'))
  }
}

function reg(over: Partial<{ waiting: unknown; installing: FakeWorker | null }> = {}, update?: () => Promise<unknown>) {
  const r = {
    waiting: null,
    installing: null,
    update: vi.fn(update ?? (async () => {})),
    ...over,
  }
  return r as unknown as RegistrationLike & { update: ReturnType<typeof vi.fn> }
}

const sw = (r: RegistrationLike | undefined) => ({ getRegistration: async () => r })

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createUpdateCheck', () => {
  it('reports ready without calling update() when an offer is up', async () => {
    const r = reg()
    const c = createUpdateCheck({ serviceWorker: sw(r), offered: () => true })
    expect(await c.run()).toEqual({ status: 'ready' })
    expect(r.update).not.toHaveBeenCalled()
  })

  it('is unavailable with no service worker or registration', async () => {
    expect((await createUpdateCheck({ serviceWorker: null, offered: () => false }).run()).status).toBe('unavailable')
    expect((await createUpdateCheck({ serviceWorker: sw(undefined), offered: () => false }).run()).status).toBe('unavailable')
  })

  it('is an error when update() rejects', async () => {
    const r = reg({}, async () => {
      throw new Error('offline')
    })
    const c = createUpdateCheck({ serviceWorker: sw(r), offered: () => false })
    expect((await c.run()).status).toBe('error')
  })

  it('is latest when nothing is waiting or installing', async () => {
    const c = createUpdateCheck({ serviceWorker: sw(reg()), offered: () => false })
    expect((await c.run()).status).toBe('latest')
  })

  it('is ready when a worker is waiting after update()', async () => {
    const c = createUpdateCheck({ serviceWorker: sw(reg({ waiting: {} })), offered: () => false })
    expect((await c.run()).status).toBe('ready')
  })

  it('reports fetching, then ready, when an installing worker installs', async () => {
    const w = new FakeWorker()
    const c = createUpdateCheck({ serviceWorker: sw(reg({ installing: w })), offered: () => false })
    const p = c.run()
    await vi.advanceTimersByTimeAsync(0)
    expect(c.state.value.status).toBe('fetching')
    w.set('installed')
    expect((await p).status).toBe('ready')
  })

  it('is latest when the installing worker becomes redundant', async () => {
    const w = new FakeWorker()
    const c = createUpdateCheck({ serviceWorker: sw(reg({ installing: w })), offered: () => false })
    const p = c.run()
    await vi.advanceTimersByTimeAsync(0)
    w.set('redundant')
    expect((await p).status).toBe('latest')
  })

  it('is an error when the installing worker never settles', async () => {
    const w = new FakeWorker()
    const c = createUpdateCheck({ serviceWorker: sw(reg({ installing: w })), offered: () => false, installMs: 1000 })
    const p = c.run()
    await vi.advanceTimersByTimeAsync(1000)
    expect((await p).status).toBe('error')
  })

  it('shares one promise between concurrent runs', async () => {
    const c = createUpdateCheck({ serviceWorker: sw(reg()), offered: () => false })
    expect(c.run()).toBe(c.run())
  })
})

describe('fetchNewest', () => {
  it('resolves by its deadline when update() hangs', async () => {
    const r = reg({}, () => new Promise(() => {}))
    let done = false
    void fetchNewest(async () => r, 500).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(499)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(done).toBe(true)
  })

  it('never rejects', async () => {
    await expect(
      fetchNewest(async () => {
        throw new Error('x')
      }),
    ).resolves.toBeUndefined()
  })

  it('waits for an installing worker to settle', async () => {
    const w = new FakeWorker()
    let done = false
    void fetchNewest(async () => reg({ installing: w }), 5000).then(() => (done = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(false)
    w.set('installed')
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(true)
  })
})

describe('checkMessage', () => {
  it('words each status', () => {
    expect(checkMessage({ status: 'idle' }, '0.1.0')).toBe('')
    expect(checkMessage({ status: 'checking' }, '0.1.0')).toBe('Checking for updates…')
    expect(checkMessage({ status: 'fetching' }, '0.1.0')).toBe('Getting the newest version…')
    expect(checkMessage({ status: 'latest' }, '0.1.0')).toBe('frotzsmith 0.1.0 is the newest version.')
    expect(checkMessage({ status: 'error' }, '0.1.0')).toBe('Couldn’t check for updates — are you offline?')
    expect(checkMessage({ status: 'unavailable' }, '0.1.0')).toBe('This copy can’t check for updates.')
    expect(checkMessage({ status: 'ready' }, '0.1.0')).toBe(UPDATE_READY)
  })
})

describe('startUpdatePolling', () => {
  it('asks the registration for a new version every hour', async () => {
    const r = reg()
    const stop = startUpdatePolling(async () => r)
    expect(POLL_MS).toBe(60 * 60 * 1000)
    await vi.advanceTimersByTimeAsync(POLL_MS - 1)
    expect(r.update).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(r.update).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(r.update).toHaveBeenCalledTimes(2)
    stop()
    await vi.advanceTimersByTimeAsync(POLL_MS * 3)
    expect(r.update).toHaveBeenCalledTimes(2)
  })

  it('keeps polling after a failed check (offline, or sw.js gone)', async () => {
    const r = reg({}, async () => {
      throw new Error('offline')
    })
    const stop = startUpdatePolling(async () => r)
    await vi.advanceTimersByTimeAsync(POLL_MS * 2)
    expect(r.update).toHaveBeenCalledTimes(2)
    stop()
  })

  it('does nothing without a registration', async () => {
    const getRegistration = vi.fn(async () => undefined)
    const stop = startUpdatePolling(getRegistration)
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(getRegistration).toHaveBeenCalledTimes(1)
    stop()
  })
})

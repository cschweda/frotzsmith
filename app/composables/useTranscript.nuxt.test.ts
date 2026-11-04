/**
 * useTranscript — a reset (new build / new game) must stop the run in flight
 * and keep its late result out of the fresh transcript.
 */
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'

const _result = ref({ ok: true, storyFile: new Uint8Array([1]) })
vi.stubGlobal('useIde', () => ({ result: _result, activeTab: ref('results'), canPlay: ref(true) }))

let release!: () => void
const _cancel = vi.fn()
vi.stubGlobal('useReplay', () => ({
  replay: () => {
    let resolve!: (v: unknown) => void
    const promise = new Promise(r => { resolve = r })
    release = () => resolve({ turns: [{ command: '', output: 'OLD BUILD' }], ms: 1 })
    return { promise, cancel: _cancel }
  },
}))

const { useTranscript } = await import('./useTranscript')

describe('useTranscript', () => {
  it('reset() cancels the in-flight run and drops its late result', async () => {
    const t = useTranscript()
    const run = t.run(['look'])
    expect(t.running.value).toBe(true)

    t.reset()
    expect(_cancel).toHaveBeenCalledTimes(1)
    expect(t.running.value).toBe(false)

    release() // the old worker answers anyway
    await run
    expect(t.turns.value).toEqual([])
    expect(t.error.value).toBeNull()
    expect(t.running.value).toBe(false)
  })
})

/**
 * A raw WASM trap (not Emscripten's ExitStatus) during callMain must surface as
 * a fatal diagnostic — previously it was swallowed and the compile failed with
 * zero diagnostics anywhere in the UI.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('~/composables/useCompilerWasm', () => ({
  useCompilerWasm: () => ({
    createInstance: async () => ({
      FS: {
        mkdir: () => {},
        writeFile: () => {},
        chdir: () => {},
        readFile: () => {
          throw new Error('no output')
        },
      },
      callMain: () => {
        const e = new Error('table index is out of bounds')
        e.name = 'RuntimeError' // WebAssembly trap, not ExitStatus
        throw e
      },
    }),
  }),
}))

describe('I6_PROFILE.compile — WASM trap surfacing', () => {
  it('reports the trap as a fatal diagnostic instead of failing silently', async () => {
    const { I6_PROFILE } = await import('./profile')
    const result = await I6_PROFILE.compile('Constant Story "X";', { profileId: 'std', ext: 'z5' })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.some(d => d.severity === 'fatal' && d.message.includes('table index'))).toBe(true)
  })
})

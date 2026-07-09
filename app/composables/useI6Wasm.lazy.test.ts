/**
 * Worker-enabled compile behavior for useI6Wasm (protocol + fallback).
 *
 * Mirrors useZilfWasm.lazy.test.ts. The Emscripten seam (useCompilerWasm) is
 * mocked with a success-shaped fake — the real wasm is covered by
 * compiler.golden.test.ts (its locateFile note explains why the ?url wasm
 * path is browser-only). Everything else on the fallback path is real:
 * compile-main's MEMFS mount, argument building, diagnostics parsing, and
 * CompileResult assembly.
 *
 * Environment: node (no DOM needed).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeWorkerSpy } from '~~/test/mock-worker'

vi.mock('~/composables/useCompilerWasm', () => ({
  useCompilerWasm: () => ({
    createInstance: async (hooks: { print: (l: string) => void; printErr: (l: string) => void }) => {
      const written = new Map<string, string | Uint8Array>()
      return {
        FS: {
          mkdir: () => {},
          writeFile: (p: string, d: string | Uint8Array) => written.set(p, d),
          chdir: () => {},
          readFile: (p: string) => {
            // Emit a tiny fake story for whatever output name was requested.
            if (p.startsWith('/work/story.z')) return new Uint8Array([5, 1, 2, 3])
            throw new Error('not found')
          },
        },
        callMain: (args: string[]) => {
          hooks.print(`fake inform6 run: ${args.join(' ')}`)
          // Prove the library actually got mounted by the real compile-main.
          hooks.print(written.has('/lib/std/Parser.h') ? 'lib mounted' : 'LIB MISSING')
          return 0
        },
      }
    },
  }),
}))

describe('useI6Wasm — worker enabled, fallback to main thread', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('does NOT construct a Worker on module import (page navigation is free)', async () => {
    const { spy } = makeWorkerSpy('reply-error')
    vi.stubGlobal('Worker', spy)

    await import('~/composables/useI6Wasm')

    expect(spy).not.toHaveBeenCalled()
  })

  it('compile() uses the Worker lazily, tags the request, and falls back on a worker error reply', async () => {
    const { spy, instances } = makeWorkerSpy('reply-error')
    vi.stubGlobal('Worker', spy)

    const { useI6Wasm } = await import('~/composables/useI6Wasm')
    const result = await useI6Wasm().compile('Include "Parser";', { profileId: 'std', ext: 'z5' })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(instances[0]!.posted[0]).toMatchObject({
      source: 'Include "Parser";',
      opts: { profileId: 'std', ext: 'z5' },
      requestId: expect.any(Number),
    })
    // Worker reported an error → main-thread fallback ran the REAL
    // compile-main pipeline against the fake Emscripten instance.
    expect(result.ok).toBe(true)
    expect(result.storyExt).toBe('z5')
    expect(result.byteLength).toBe(4)
    expect(result.rawStderr).toContain('lib mounted')
  })

  it('returns the worker-produced CompileResult as-is (no fallback run)', async () => {
    const workerResult = {
      ok: true,
      storyExt: 'z8',
      diagnostics: [],
      rawStderr: 'FROM-WORKER',
      ms: 42,
      byteLength: 7,
    }
    const { spy } = makeWorkerSpy('reply-result', { result: workerResult })
    vi.stubGlobal('Worker', spy)

    const { useI6Wasm } = await import('~/composables/useI6Wasm')
    const result = await useI6Wasm().compile('src', { ext: 'z8' })

    expect(result.rawStderr).toBe('FROM-WORKER') // not the fallback's output
    expect(result.ms).toBe(42)
  })

  it('after a worker failure, later compiles skip the Worker and still resolve', async () => {
    const { spy } = makeWorkerSpy('reply-error')
    vi.stubGlobal('Worker', spy)

    const { useI6Wasm } = await import('~/composables/useI6Wasm')
    const r1 = await useI6Wasm().compile('a', { profileId: 'std' })
    const r2 = await useI6Wasm().compile('b', { profileId: 'std' })

    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1) // _workerFailed caches the fallback decision
  })

  it('without a Worker global (node/SSR), compile goes straight to the main path', async () => {
    const { useI6Wasm } = await import('~/composables/useI6Wasm')
    const result = await useI6Wasm().compile('Include "Parser";', { profileId: 'std' })
    expect(result.ok).toBe(true)
  })
})

/**
 * I6_PROFILE unit tests — node env (default).
 *
 * useCompilerWasm is mocked so no WASM binary is loaded; the mock
 * simulates a successful compile by writing a fake story file to the
 * in-memory FS when callMain is invoked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Stable mock references via vi.hoisted so the same createInstance fn is
// shared between the vi.mock factory and individual test overrides.
// ---------------------------------------------------------------------------

const { createInstance } = vi.hoisted(() => {
  const createInstance = vi.fn()
  return { createInstance }
})

/** Build a fresh in-memory FS instance that simulates a successful compile. */
function makeSuccessInstance() {
  const files = new Map<string, Uint8Array>()
  return {
    FS: {
      mkdir: vi.fn(),
      writeFile: vi.fn((path: string, data: string | Uint8Array) => {
        const bytes =
          typeof data === 'string' ? new TextEncoder().encode(data) : data
        files.set(path, bytes)
      }),
      readFile: vi.fn((path: string) => {
        const f = files.get(path)
        if (!f) throw new Error(`MEMFS: ${path} not found`)
        return f
      }),
      chdir: vi.fn(),
    },
    callMain: vi.fn((args: string[]) => {
      // Output filename is always the last arg (e.g. 'story.z5').
      const outFile = args[args.length - 1] ?? 'story.z5'
      files.set(`/work/${outFile}`, new Uint8Array([0x05, 0, 0, 0]))
      return 0
    }),
  }
}

vi.mock('~/composables/useCompilerWasm', () => ({
  useCompilerWasm: () => ({ createInstance }),
}))

// Default: every createInstance call returns a success instance.
beforeEach(() => {
  vi.clearAllMocks()
  createInstance.mockImplementation(async () => makeSuccessInstance())
})

const { I6_PROFILE } = await import('./profile')

// ---------------------------------------------------------------------------
// Static shape
// ---------------------------------------------------------------------------

describe('I6_PROFILE — static shape', () => {
  it('id is "i6"', () => {
    expect(I6_PROFILE.id).toBe('i6')
  })

  it('label is "Inform 6"', () => {
    expect(I6_PROFILE.label).toBe('Inform 6')
  })

  it('badge is "beta"', () => {
    expect(I6_PROFILE.badge).toBe('beta')
  })

  it('route is "/"', () => {
    expect(I6_PROFILE.route).toBe('/')
  })

  it('fileExt is "inf"', () => {
    expect(I6_PROFILE.fileExt).toBe('inf')
  })

  it('stateKey is "i6"', () => {
    expect(I6_PROFILE.stateKey).toBe('i6')
  })

  it('versionTargets is exactly ["z3","z4","z5","z8"]', () => {
    expect(I6_PROFILE.versionTargets).toEqual(['z3', 'z4', 'z5', 'z8'])
  })

  it('compile is a function', () => {
    expect(typeof I6_PROFILE.compile).toBe('function')
  })

  it('editorMode is a function', () => {
    expect(typeof I6_PROFILE.editorMode).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// compile — behavior
// ---------------------------------------------------------------------------

describe('I6_PROFILE.compile', () => {
  it('returns a CompileResult with ok=true when callMain succeeds', async () => {
    const result = await I6_PROFILE.compile('Constant x = 1;', { ext: 'z5' })
    expect(result.ok).toBe(true)
    expect(result.storyFile).toBeInstanceOf(Uint8Array)
    expect(result.storyExt).toBe('z5')
    expect(Array.isArray(result.diagnostics)).toBe(true)
    expect(typeof result.rawStderr).toBe('string')
    expect(typeof result.ms).toBe('number')
    expect(result.ms).toBeGreaterThanOrEqual(0)
    expect(typeof result.byteLength).toBe('number')
    expect(result.byteLength).toBeGreaterThan(0)
  })

  it('uses z5 as default ext when no ext is given (std profile default)', async () => {
    const result = await I6_PROFILE.compile('Constant x = 1;', {})
    expect(result.storyExt).toBe('z5')
    expect(result.ok).toBe(true)
  })

  it('respects the ext option (z3)', async () => {
    const result = await I6_PROFILE.compile('Constant x = 1;', { ext: 'z3' })
    expect(result.storyExt).toBe('z3')
    expect(result.ok).toBe(true)
  })

  it('uses the puny profile when profileId is "puny"', async () => {
    // puny profile defaults to z5
    const result = await I6_PROFILE.compile('Constant x = 1;', { profileId: 'puny' })
    expect(result.storyExt).toBe('z5')
    expect(result.ok).toBe(true)
  })

  it('returns ok=false when callMain throws and no story file is produced', async () => {
    // Override for this test: callMain throws (compile error), FS has no output.
    createInstance.mockImplementationOnce(async () => ({
      FS: {
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        readFile: vi.fn((_path: string) => {
          throw new Error('MEMFS: not found')
        }),
        chdir: vi.fn(),
      },
      callMain: vi.fn(() => {
        throw new Error('ExitStatus')
      }),
    }))

    const result = await I6_PROFILE.compile('!bad source', {})
    expect(result.ok).toBe(false)
    expect(result.storyFile).toBeUndefined()
    expect(result.byteLength).toBe(0)
  })
})

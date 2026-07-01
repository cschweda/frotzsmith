/**
 * ZIL_PROFILE unit tests — node env (default).
 *
 * useZilfWasm is mocked so no WASM binary is loaded; the mock lets us assert
 * that compile() maps each StoryExt to the correct numeric Z-machine version.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CompileResult } from '~/modules/inform6/types'

// ---------------------------------------------------------------------------
// Stable mock references via vi.hoisted so the same compileMock fn is shared
// between the vi.mock factory and individual test overrides.
// ---------------------------------------------------------------------------

const { compileMock } = vi.hoisted(() => {
  const compileMock = vi.fn<(source: string, version: number) => Promise<CompileResult>>()
  return { compileMock }
})

vi.mock('~/composables/useZilfWasm', () => ({
  useZilfWasm: () => ({ compile: compileMock }),
}))

/** A minimal CompileResult used as the mock return value. */
const FAKE_RESULT: CompileResult = {
  ok: true,
  storyFile: new Uint8Array([0x03, 0, 0, 0]),
  storyExt: 'z3',
  diagnostics: [],
  rawStderr: '',
  ms: 1,
  byteLength: 4,
}

beforeEach(() => {
  vi.clearAllMocks()
  compileMock.mockResolvedValue(FAKE_RESULT)
})

const { ZIL_PROFILE } = await import('./profile')

// ---------------------------------------------------------------------------
// Static shape
// ---------------------------------------------------------------------------

describe('ZIL_PROFILE — static shape', () => {
  it('id is "zil"', () => {
    expect(ZIL_PROFILE.id).toBe('zil')
  })

  it('label is "ZIL"', () => {
    expect(ZIL_PROFILE.label).toBe('ZIL')
  })

  it('badge is "alpha"', () => {
    expect(ZIL_PROFILE.badge).toBe('alpha')
  })

  it('route is "/zil/"', () => {
    expect(ZIL_PROFILE.route).toBe('/zil/')
  })

  it('fileExt is "zil"', () => {
    expect(ZIL_PROFILE.fileExt).toBe('zil')
  })

  it('stateKey is "zil"', () => {
    expect(ZIL_PROFILE.stateKey).toBe('zil')
  })

  it('versionTargets is exactly ["z3","z5","z8"]', () => {
    expect(ZIL_PROFILE.versionTargets).toEqual(['z3', 'z5', 'z8'])
  })

  it('compile is a function', () => {
    expect(typeof ZIL_PROFILE.compile).toBe('function')
  })

  it('editorMode is a function', () => {
    expect(typeof ZIL_PROFILE.editorMode).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// compile — version mapping
// ---------------------------------------------------------------------------

describe('ZIL_PROFILE.compile — version mapping', () => {
  it('maps z3 → numeric version 3', async () => {
    await ZIL_PROFILE.compile('(VERSION ZIP)', { ext: 'z3' })
    expect(compileMock).toHaveBeenCalledWith('(VERSION ZIP)', 3)
  })

  it('maps z5 → numeric version 5', async () => {
    await ZIL_PROFILE.compile('(VERSION ZIP)', { ext: 'z5' })
    expect(compileMock).toHaveBeenCalledWith('(VERSION ZIP)', 5)
  })

  it('maps z8 → numeric version 8', async () => {
    await ZIL_PROFILE.compile('(VERSION ZIP)', { ext: 'z8' })
    expect(compileMock).toHaveBeenCalledWith('(VERSION ZIP)', 8)
  })

  it('defaults to version 3 when opts.ext is undefined', async () => {
    await ZIL_PROFILE.compile('(VERSION ZIP)', {})
    expect(compileMock).toHaveBeenCalledWith('(VERSION ZIP)', 3)
  })

  it('returns the CompileResult from useZilfWasm().compile()', async () => {
    const result = await ZIL_PROFILE.compile('(VERSION ZIP)', { ext: 'z3' })
    expect(result).toBe(FAKE_RESULT)
  })
})

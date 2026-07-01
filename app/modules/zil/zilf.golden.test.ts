/// <reference types="node" />
/**
 * Golden-compile test — runs the ZILF .NET WASM bundle under Node to compile a
 * minimal one-room ZIL game and asserts stable, valid Z-machine story output.
 *
 * Analogue of app/modules/inform6/compiler.golden.test.ts, which does the same
 * for the Inform 6 Emscripten WASM.
 *
 * ENVIRONMENT: node (default per vitest.config.ts — NOT *.nuxt.test.ts)
 *
 * RUNTIME NOTE: The .NET WASM boot (~200 ms) + two ZIL compiles (~5 s each) make
 * this inherently slow (~10–15 s total). We boot the runtime ONCE in beforeAll and
 * reuse the cached exports across all test cases to keep it as fast as possible.
 * vitest --testTimeout must be ≥ 30 000 ms for this suite (set below).
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Paths — resolved relative to this test file.
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const frameworkDir = path.join(repoRoot, 'public/zilf/_framework')

// ---------------------------------------------------------------------------
// The same one-room fixture used by test-smoke.mjs (stable against the
// committed bundle).
// ---------------------------------------------------------------------------
const ZIL_GAME = `
<CONSTANT RELEASEID 1>
<CONSTANT GAME-BANNER "Smoke Test">
<ROOM WEST-OF-HOUSE
    (DESC "West of House")
    (IN ROOMS)
    (FLAGS LIGHTBIT)>
<ROUTINE GO ()
    <SETG HERE ,WEST-OF-HOUSE>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>
<INSERT-FILE "parser">
`

// A deliberately broken ZIL source (calls an undefined routine).
const ZIL_BROKEN = `<ROUTINE GO () <UNDEFINED-FUNCTION>>`

// ---------------------------------------------------------------------------
// Locked byte lengths — captured from the first verified smoke run against the
// committed bundle (test-smoke.mjs).  Update these if the bundle is rebuilt.
// ---------------------------------------------------------------------------
const GOLDEN_Z5_BYTES = 26108
const GOLDEN_Z3_BYTES = 26090

// ---------------------------------------------------------------------------
// Runtime state — booted once in beforeAll and reused across tests.
// ---------------------------------------------------------------------------
let zilfExports: {
  ZilfExports: { Compile: (source: string, version: number) => string }
}

describe('ZILF WASM golden compile (node-env)', { timeout: 60_000 }, () => {
  beforeAll(async () => {
    // Locate dotnet.js (fingerprinting disabled → plain dotnet.js expected).
    const files = await readdir(frameworkDir)
    const dotnetJs = files.includes('dotnet.js')
      ? 'dotnet.js'
      : files.find(
          (f) => f.match(/^dotnet\.[a-z0-9]+\.js$/) && !f.includes('native') && !f.includes('runtime'),
        )
    if (!dotnetJs) {
      throw new Error(
        `Could not find dotnet.js in ${frameworkDir}\nFiles: ${files.filter((f) => f.endsWith('.js')).join(', ')}`,
      )
    }

    const dotnetUrl = pathToFileURL(path.join(frameworkDir, dotnetJs)).href
    // Dynamic import with runtime URL — suppressed by @vite-ignore equivalent
    // (vitest resolves file:// URLs natively; no vite-ignore needed in Node).
    const { dotnet } = await import(/* @vite-ignore */ dotnetUrl as string)

    const { getAssemblyExports, getConfig } = await dotnet
      .withApplicationArguments()
      .create()

    const config = getConfig()
    zilfExports = (await getAssemblyExports(config.mainAssemblyName)) as typeof zilfExports
  }, 30_000 /* allow up to 30 s for the one-time boot */)

  // -------------------------------------------------------------------------
  it('compiles the one-room fixture to a valid z5 story of locked byte length', () => {
    const raw = zilfExports.ZilfExports.Compile(ZIL_GAME, 5)
    const result: { success: boolean; storyBase64: string | null; diagnostics: string[] } =
      JSON.parse(raw)

    expect(result.success, `z5 compile failed: ${result.diagnostics.join('; ')}`).toBe(true)
    expect(result.storyBase64).not.toBeNull()

    const bytes = Buffer.from(result.storyBase64!, 'base64')

    // Z-machine header byte 0 must match the requested version.
    expect(bytes[0], 'z5 header byte 0 must be 5').toBe(5)

    // Locked byte length — catches any silent regression in the bundle.
    expect(bytes.length, `z5 byte length changed from ${GOLDEN_Z5_BYTES}`).toBe(GOLDEN_Z5_BYTES)
  })

  // -------------------------------------------------------------------------
  it('compiles the one-room fixture to a valid z3 story of locked byte length', () => {
    const raw = zilfExports.ZilfExports.Compile(ZIL_GAME, 3)
    const result: { success: boolean; storyBase64: string | null; diagnostics: string[] } =
      JSON.parse(raw)

    expect(result.success, `z3 compile failed: ${result.diagnostics.join('; ')}`).toBe(true)
    expect(result.storyBase64).not.toBeNull()

    const bytes = Buffer.from(result.storyBase64!, 'base64')

    expect(bytes[0], 'z3 header byte 0 must be 3').toBe(3)
    expect(bytes.length, `z3 byte length changed from ${GOLDEN_Z3_BYTES}`).toBe(GOLDEN_Z3_BYTES)
  })

  // -------------------------------------------------------------------------
  it('returns success:false with non-empty diagnostics for broken ZIL', () => {
    const raw = zilfExports.ZilfExports.Compile(ZIL_BROKEN, 5)
    const result: { success: boolean; storyBase64: string | null; diagnostics: string[] } =
      JSON.parse(raw)

    expect(result.success, 'broken ZIL should not succeed').toBe(false)
    expect(result.storyBase64).toBeNull()
    expect(result.diagnostics.length, 'broken ZIL should produce diagnostics').toBeGreaterThan(0)

    // At least one diagnostic must contain the ZILF error code for an
    // unrecognised routine (confirmed in the test-smoke.mjs run).
    const hasZil0122 = result.diagnostics.some((d) => d.includes('ZIL0122'))
    expect(hasZil0122, `expected ZIL0122 in diagnostics: ${result.diagnostics.join('; ')}`).toBe(
      true,
    )
  })
})

/// <reference types="node" />
/**
 * Anti-rot compile check for the ZIL sample set.
 *
 * Compiles every sample in ZIL_SAMPLES against the committed ZILF .NET WASM
 * bundle and asserts:
 *   - result.success === true (no error diagnostics from ZILF)
 *   - bytes[0] === declared target version (e.g. 3 for z3)
 *   - story file length > 64 bytes (sanity check)
 *
 * TIMING NOTE: Each ZIL compile takes ~5–6 s under the .NET WASM runtime.
 * With 7 samples that is ~40 s of compile time — well above the ~30 s budget
 * for the default suite. This test is therefore GATED behind an environment
 * variable so that `yarn test` stays fast:
 *
 *   ZIL_SAMPLE_GOLDEN=1 yarn test app/modules/zil/zilf-samples.golden.test.ts
 *
 * The runtime is booted ONCE in beforeAll and reused across all samples.
 * Total wall time with boot: ~42 s (boot ~200 ms + 7 × ~5.8 s).
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { ZIL_SAMPLES } from '~/modules/languages/zil/samples'
import { ZILF_FRAMEWORK_BASE } from '~~/frotzsmith.config'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const frameworkDir = path.join(repoRoot, 'public', ZILF_FRAMEWORK_BASE)

// ---------------------------------------------------------------------------
// Version string → integer mapping (matches ZilfExports.Compile second arg)
// ---------------------------------------------------------------------------
const VERSION_INT: Record<string, number> = { z3: 3, z4: 4, z5: 5, z8: 8 }

// ---------------------------------------------------------------------------
// Runtime state — booted once for all samples
// ---------------------------------------------------------------------------
let zilfExports: {
  ZilfExports: { Compile: (source: string, version: number) => string }
}

// ---------------------------------------------------------------------------
// The entire suite is skipped unless ZIL_SAMPLE_GOLDEN=1 to keep
// `yarn test` fast. Run with:
//   ZIL_SAMPLE_GOLDEN=1 yarn test app/modules/zil/zilf-samples.golden.test.ts
// ---------------------------------------------------------------------------
describe.skipIf(!process.env['ZIL_SAMPLE_GOLDEN'])(
  'ZIL sample set — anti-rot compile check (ZIL_SAMPLE_GOLDEN=1 to enable)',
  { timeout: 90_000 },
  () => {
    beforeAll(async () => {
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
      const { dotnet } = await import(/* @vite-ignore */ dotnetUrl as string)
      const { getAssemblyExports, getConfig } = await dotnet.withApplicationArguments().create()
      const config = getConfig()
      zilfExports = (await getAssemblyExports(config.mainAssemblyName)) as typeof zilfExports
    }, 30_000)

    // Parametrized: one it() per sample so failures are reported individually.
    for (const sample of ZIL_SAMPLES) {
      it(`compiles cleanly: ${sample.id} (target ${sample.target})`, () => {
        const versionInt = VERSION_INT[sample.target]
        expect(versionInt, `Unknown target version '${sample.target}' for ${sample.id}`).toBeDefined()

        const raw = zilfExports.ZilfExports.Compile(sample.source, versionInt!)
        const result: {
          success: boolean
          storyBase64: string | null
          diagnostics: string[]
        } = JSON.parse(raw)

        // Filter to error-level diagnostics (not warnings).
        const errors = result.diagnostics.filter(
          (d) => !d.toLowerCase().includes('warning') && d.trim().length > 0,
        )

        expect(
          result.success,
          `${sample.id} compile failed.\nDiagnostics: ${errors.join('; ')}`,
        ).toBe(true)
        expect(result.storyBase64, `${sample.id} produced no story output`).not.toBeNull()

        const bytes = Buffer.from(result.storyBase64!, 'base64')

        // Z-machine header byte 0 must equal the declared version.
        expect(
          bytes[0],
          `${sample.id}: header byte 0 should be ${versionInt} (${sample.target}), got ${bytes[0]}`,
        ).toBe(versionInt)

        // Sanity: a valid Z-machine story is always > 64 bytes.
        expect(bytes.length, `${sample.id}: story file suspiciously small`).toBeGreaterThan(64)
      })
    }
  },
)

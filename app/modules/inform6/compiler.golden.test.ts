/// <reference types="node" />
/**
 * Golden-compile test — runs inform6.wasm under Node (via Emscripten's
 * built-in Node path) to compile a minimal Standard Library game and asserts
 * the output is a deterministic, valid Z-machine story.
 *
 * Analogue of engine/replay.golden.test.ts, which verifies the ZVM side.
 * The compiler was verified Node-runnable by the build README (wasm/README.md).
 *
 * ENVIRONMENT: node (default per vitest.config.ts)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

// ---------------------------------------------------------------------------
// Paths resolved at module scope so they resolve relative to this file.
// ---------------------------------------------------------------------------
const STD_LIB_DIR = fileURLToPath(new URL('./lib/std', import.meta.url))
const WASM_PATH = fileURLToPath(new URL('./wasm/inform6.wasm', import.meta.url))

// Capitalized aliases required by the Standard Library's own #include
// directives (MEMFS is case-sensitive, files ship as lowercase).
const STD_ALIASES: Record<string, string> = {
  'Parser.h': 'parser.h',
  'VerbLib.h': 'verblib.h',
  'Grammar.h': 'grammar.h',
  'English.h': 'english.h',
}

// A minimal but complete Standard Library game (mirrors std-skeleton.inf).
// Using the same story as samples/std-skeleton.inf so the output is stable.
const TINY_SOURCE = `\
Constant Story "GOLDEN";
Constant Headline "^Golden compile test.^";
Include "Parser";
Include "VerbLib";
[ Initialise; location = Room; ];
Object Room "Room"
  with description "A plain room.",
  has light;
Include "Grammar";
`

// ---------------------------------------------------------------------------
// Golden sha-256 of the compiled story.z5.
// Computed on first verified run; locked here so any compiler regression
// (e.g. WASM rebuild) is caught automatically.  To recompute:
//   yarn test compiler.golden --reporter=verbose
// and update the value below.
// ---------------------------------------------------------------------------
const GOLDEN_SHA256: string = '607505c85dd736174f4125e399cf41caae94884c8905728651ebdba3535de089'

describe('inform6.wasm golden compile (node-env)', () => {
  it('compiles a minimal std game to a deterministic, valid z5 story', async () => {
    // Dynamic import so Vitest resolves it through Vite's transform
    // (same pattern used by useCompilerWasm.ts in the browser).
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — no hand-written types for this pre-built Emscripten module
    const mod = await import('./wasm/inform6.mjs')
    const factory: (opts: Record<string, unknown>) => Promise<Record<string, unknown>> = mod.default

    const output: string[] = []

    const m = await factory({
      print: (line: string) => output.push(line),
      printErr: (line: string) => output.push(line),
      // Point Emscripten at the real .wasm on disk.  Without this, the default
      // locateFile resolves relative to import.meta.url of inform6.mjs which
      // may be a Vite virtual URL rather than a file:// path.
      locateFile: (path: string) => (path.endsWith('.wasm') ? WASM_PATH : path),
    }) as { FS: { mkdir: (p: string) => void; writeFile: (p: string, d: string | Uint8Array) => void; readFile: (p: string) => Uint8Array; chdir: (p: string) => void }; callMain: (args: string[]) => number }

    // --- Mount Standard Library (same layout as useCompiler.ts) -------------
    const mkdir = (p: string) => { try { m.FS.mkdir(p) } catch { /* exists */ } }
    mkdir('/lib')
    mkdir('/lib/std')

    for (const name of readdirSync(STD_LIB_DIR)) {
      if (!name.endsWith('.h')) continue
      const content = readFileSync(`${STD_LIB_DIR}/${name}`)
      m.FS.writeFile(`/lib/std/${name}`, content)
      for (const [alias, real] of Object.entries(STD_ALIASES)) {
        if (real === name) m.FS.writeFile(`/lib/std/${alias}`, content)
      }
    }

    // --- Write source + compile ---------------------------------------------
    mkdir('/work')
    m.FS.writeFile('/work/story.inf', TINY_SOURCE)
    m.FS.chdir('/work')

    let exitCode: number | undefined
    try {
      exitCode = m.callMain(['+include_path=/lib/std', '-s', '-v5', 'story.inf', 'story.z5'])
    } catch (e: unknown) {
      // Emscripten may throw ExitStatus on non-zero exit; surface the
      // compiler output to make failures diagnosable.
      const raw = output.join('\n')
      throw new Error(`callMain threw: ${String(e)}\n\nCompiler output:\n${raw}`)
    }

    // --- Read story bytes ---------------------------------------------------
    let storyFile: Uint8Array
    try {
      storyFile = m.FS.readFile('/work/story.z5')
    } catch {
      const raw = output.join('\n')
      throw new Error(`No story.z5 produced (exit=${exitCode}).\n\nCompiler output:\n${raw}`)
    }

    // --- Assertions ---------------------------------------------------------
    // 1. Compiler exited cleanly.
    expect(exitCode, `callMain exit code\nCompiler output:\n${output.join('\n')}`).toBe(0)

    // 2. Output is non-empty.
    expect(storyFile.length).toBeGreaterThan(0)

    // 3. Z-machine header sanity:
    //    byte 0 = version (5 for z5)
    expect(storyFile[0]).toBe(5)

    //    bytes 26-27 = file-length field (0x1A), scaled by 4 for z5 stories.
    //    Inform 6 stores the unpadded game size in this field, then pads the
    //    physical file up to the nearest 512-byte page.  So:
    //      headerLen   = unpadded game size (what the field declares)
    //      storyFile.length = physical file, always a multiple of 512
    //      storyFile.length >= headerLen, difference < 512
    const headerLen = ((storyFile[26]! << 8) | storyFile[27]!) * 4
    expect(storyFile.length % 512).toBe(0)
    expect(storyFile.length).toBeGreaterThanOrEqual(headerLen)
    expect(storyFile.length - headerLen).toBeLessThan(512)

    // 4. Golden sha-256 — compile is deterministic across runs.
    const sha256 = createHash('sha256').update(storyFile).digest('hex')
    if (GOLDEN_SHA256 !== 'PENDING') {
      expect(sha256, 'golden sha-256 changed — WASM was rebuilt or source changed').toBe(
        GOLDEN_SHA256,
      )
    } else {
      // First run: print the hash so we can lock it in.
      // eslint-disable-next-line no-console
      console.log(`[golden-compile] sha256 = ${sha256}  (${storyFile.length} bytes) — paste into GOLDEN_SHA256`)
    }
  })
})

/// <reference types="node" />
/**
 * Multi-file ZIL: runs the committed ZILF .NET WASM bundle under Node through
 * `CompileProject` (the export the compile worker calls) and checks the file
 * set behaves as it would on disk: INSERT-FILE finds the other files, errors
 * name the right file and line, and a circular or repeated INSERT-FILE ends
 * in a diagnostic instead of a hang.
 *
 * The diagnostics cases run in the normal suite; the 3-file walkthrough is
 * gated like architect-legacy.golden.test.ts (ZIL_SAMPLE_GOLDEN=1).
 *
 * ENVIRONMENT: node (default per vitest.config.ts)
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { ZILF_FRAMEWORK_BASE } from '~~/frotzsmith.config'
import { runReplay } from '~/modules/inform6/engine/replayCore'
import { parseZilDiagnostics } from '~/modules/zil/zil-diagnostics'
import { buildZilFileSet } from '~/modules/zil/zil-project'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const frameworkDir = path.join(repoRoot, 'public', ZILF_FRAMEWORK_BASE)

type Payload = { success: boolean; storyBase64: string | null; diagnostics: string[] }
let compileProject: (filesJson: string, mainPath: string, version: number) => string

/** Compile through the same file-set builder the composable uses. */
function build(files: Record<string, string>, main = 'story.zil', version = 5): Payload {
  const { [main]: source = '', ...rest } = files
  const set = buildZilFileSet(
    source,
    main,
    Object.entries(rest).map(([p, text]) => ({ path: p, text })),
  )
  return JSON.parse(compileProject(JSON.stringify(set), main, version)) as Payload
}

const HEAD = `<CONSTANT RELEASEID 1>
<CONSTANT GAME-BANNER "Multi-file Golden">`
const GO = `<ROUTINE GO ()
    <SETG HERE ,HALL>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>
<INSERT-FILE "parser">`
const ROOMS = `; rooms.zil
<ROOM HALL
    (DESC "Great Hall")
    (IN ROOMS)
    (NORTH TO CELLAR)
    (FLAGS LIGHTBIT)>
<ROOM CELLAR
    (DESC "Damp Cellar")
    (IN ROOMS)
    (SOUTH TO HALL)
    (FLAGS LIGHTBIT)>
`
const ITEMS = `; lib/items.zil
<OBJECT LAMP
    (DESC "brass lamp")
    (IN CELLAR)
    (SYNONYM LAMP)
    (ADJECTIVE BRASS)
    (FLAGS TAKEBIT)>
`
const STORY = `${HEAD}\n<INSERT-FILE "rooms">\n<INSERT-FILE "lib/items">\n${GO}\n`

describe('ZILF multi-file compile (node-env)', { timeout: 60_000 }, () => {
  beforeAll(async () => {
    const files = await readdir(frameworkDir)
    const dotnetJs = files.includes('dotnet.js')
      ? 'dotnet.js'
      : files.find((f) => f.match(/^dotnet\.[a-z0-9]+\.js$/) && !f.includes('native') && !f.includes('runtime'))
    if (!dotnetJs) throw new Error(`Could not find dotnet.js in ${frameworkDir}`)
    const { dotnet } = await import(/* @vite-ignore */ pathToFileURL(path.join(frameworkDir, dotnetJs)).href as string)
    const { getAssemblyExports, getConfig } = await dotnet.withApplicationArguments().create()
    const exports = (await getAssemblyExports(getConfig().mainAssemblyName)) as {
      ZilfExports: { CompileProject: typeof compileProject }
    }
    compileProject = exports.ZilfExports.CompileProject
  }, 30_000)

  describe.skipIf(!process.env['ZIL_SAMPLE_GOLDEN'])('3-file game walkthrough (ZIL_SAMPLE_GOLDEN=1 to enable)', () => {
    it('compiles and plays look / north / take lamp', async () => {
      const r = build({ 'story.zil': STORY, 'rooms.zil': ROOMS, 'lib/items.zil': ITEMS, 'unused.zil': '<NOT VALID' })
      expect(r.success, r.diagnostics.join('\n')).toBe(true)
      const story = new Uint8Array(Buffer.from(r.storyBase64!, 'base64'))
      const { turns } = await runReplay(story, 'zmachine', ['look', 'north', 'take lamp'])
      expect(turns[0]!.output).toContain('Great Hall')
      expect(turns[2]!.output).toContain('Damp Cellar')
      expect(turns[2]!.output).toContain('brass lamp')
      expect(turns[3]!.output).toContain('You pick up the brass lamp')
    }, 120_000)
  })

  it('ignores an un-inserted file, even one with a syntax error', () => {
    const r = build({ 'story.zil': STORY, 'rooms.zil': ROOMS, 'lib/items.zil': ITEMS, 'unused.zil': '<THIS IS NOT VALID' })
    expect(r.success, r.diagnostics.join('\n')).toBe(true)
  })

  it('parses an error in rooms.zil to { file: rooms.zil, line: 4 }', () => {
    const r = build({
      'story.zil': STORY,
      'rooms.zil': `; one\n; two\n; three\n<UNDEFINED-FUNCTION>\n${ROOMS}`,
      'lib/items.zil': ITEMS,
    })
    expect(r.success).toBe(false)
    const d = parseZilDiagnostics(r.diagnostics).find((x) => x.file === 'rooms.zil')
    expect(d, r.diagnostics.join('\n')).toMatchObject({ file: 'rooms.zil', line: 4 })
  })

  it('parses an error on line 3 of the main file to { file: story.zil, line: 3 }', () => {
    const r = build({
      'story.zil': `; line 1\n; line 2\n<UNDEFINED-FUNCTION>\n${STORY}`,
      'rooms.zil': ROOMS,
      'lib/items.zil': ITEMS,
    })
    expect(r.success).toBe(false)
    const d = parseZilDiagnostics(r.diagnostics).find((x) => x.file === 'story.zil')
    expect(d, r.diagnostics.join('\n')).toMatchObject({ file: 'story.zil', line: 3 })
  })

  it('a circular INSERT-FILE fails with a diagnostic (and the cause comes first once parsed)', () => {
    const r = build({
      'story.zil': `${HEAD}\n<INSERT-FILE "a">\n${GO}\n`,
      'a.zil': '<INSERT-FILE "b">\n',
      'b.zil': '<INSERT-FILE "a">\n',
    })
    expect(r.success).toBe(false)
    expect(r.diagnostics.length).toBeGreaterThan(0)
    const parsed = parseZilDiagnostics(r.diagnostics)
    expect(parsed[0]!.message).toContain('inserted too many times')
  })

  it('a file inserted twice fails with a diagnostic', () => {
    const r = build({
      'story.zil': `${HEAD}\n<INSERT-FILE "rooms">\n<INSERT-FILE "rooms">\n${GO}\n`,
      'rooms.zil': ROOMS,
    })
    expect(r.success).toBe(false)
    expect(r.diagnostics.length).toBeGreaterThan(0)
  })
})

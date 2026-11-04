/// <reference types="node" />
/**
 * Walkthrough test for the ZIL version of the bundled longer sample, "The
 * Architect's Legacy" (languages/zil/samples/architect-legacy.zil). Compiles
 * the registered sample with the committed ZILF .NET WASM bundle under Node,
 * then replays the SHARED walkthrough
 * (app/modules/samples-shared/architect-legacy.walkthrough.txt — the Inform 6
 * version is verified against the same file) on the headless Z-machine.
 *
 * It catches two kinds of breakage: the game no longer being winnable, and
 * walkthrough drift (a command zillib's parser no longer understands).
 *
 * GATED like zilf-samples.golden.test.ts: a ZIL compile takes several seconds
 * under the .NET WASM runtime, so the suite only runs with
 *
 *   ZIL_SAMPLE_GOLDEN=1 npx vitest run app/modules/zil/architect-legacy.golden.test.ts
 *
 * ENVIRONMENT: node (default per vitest.config.ts)
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { ZILF_FRAMEWORK_BASE } from '~~/frotzsmith.config'
import { sampleById } from '~/modules/languages/zil/samples'
import { runReplay } from '~/modules/inform6/engine/replayCore'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const frameworkDir = path.join(repoRoot, 'public', ZILF_FRAMEWORK_BASE)
const WALKTHROUGH = fileURLToPath(
  new URL('../samples-shared/architect-legacy.walkthrough.txt', import.meta.url),
)

const walkthrough = readFileSync(WALKTHROUGH, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.length > 0)

/** zillib's messages for a command the parser rejected or could not resolve. */
const PARSER_FAILURES = [
  "I don't understand",
  "I don't know the word",
  "I didn't expect the word",
  "You don't see that here",
  "You can't see",
  'That sentence has no verb',
  'Which do you mean',
  "That's not something you can",
]

describe.skipIf(!process.env['ZIL_SAMPLE_GOLDEN'])(
  "The Architect's Legacy (ZIL sample) — shared walkthrough (ZIL_SAMPLE_GOLDEN=1 to enable)",
  { timeout: 120_000 },
  () => {
    let story: Uint8Array

    beforeAll(async () => {
      const files = await readdir(frameworkDir)
      const dotnetJs = files.includes('dotnet.js')
        ? 'dotnet.js'
        : files.find(
            (f) => f.match(/^dotnet\.[a-z0-9]+\.js$/) && !f.includes('native') && !f.includes('runtime'),
          )
      if (!dotnetJs) throw new Error(`Could not find dotnet.js in ${frameworkDir}`)
      const { dotnet } = await import(
        /* @vite-ignore */ pathToFileURL(path.join(frameworkDir, dotnetJs)).href as string
      )
      const { getAssemblyExports, getConfig } = await dotnet.withApplicationArguments().create()
      const exports = (await getAssemblyExports(getConfig().mainAssemblyName)) as {
        ZilfExports: { Compile: (source: string, version: number) => string }
      }

      const sample = sampleById('zil-architect-legacy')
      expect(sample, 'zil-architect-legacy is registered').toBeDefined()
      expect(sample!.target).toBe('z5')

      const result: { success: boolean; storyBase64: string | null; diagnostics: string[] } =
        JSON.parse(exports.ZilfExports.Compile(sample!.source, 5))
      expect(result.success, `compile failed:\n${result.diagnostics.join('\n')}`).toBe(true)
      // No warnings either: the sample is teaching material.
      expect(result.diagnostics.filter((d) => d.trim().length > 0)).toEqual([])
      story = new Uint8Array(Buffer.from(result.storyBase64!, 'base64'))
    }, 60_000)

    // The VM runs in the story's own bytes (it mutates dynamic memory), so
    // every replay gets a fresh copy of the compiled story.
    const fresh = () => story.slice()

    it('compiles to a z5 story', () => {
      expect(story[0]).toBe(5)
    })

    it('wins with the shared walkthrough, scoring 40 of 50', async () => {
      const { turns } = await runReplay(fresh(), 'zmachine', walkthrough)
      // Every command was accepted by the VM (boot turn + one per command).
      expect(turns).toHaveLength(walkthrough.length + 1)

      for (const t of turns.slice(1)) {
        for (const phrase of PARSER_FAILURES) {
          expect(t.output, `walkthrough drift at "${t.command}":\n${t.output}`).not.toContain(phrase)
        }
      }

      const last = turns.at(-1)!
      expect(last.command).toBe('read blueprint')
      expect(last.output).toContain('The work continues')
      expect(last.output).toMatch(/scored 40 points out of a possible 50/)
    })

    it('a wrong brass order does not open the way to the Cellar Stairs', async () => {
      const commands = ['north', 'east', 'blow horn', 'ring bell', 'strike chime', 'down']
      const { turns } = await runReplay(fresh(), 'zmachine', commands)
      expect(turns).toHaveLength(commands.length + 1)
      expect(turns.at(-1)!.output).not.toContain('Cellar Stairs')
      // ...but the right order does.
      const right = ['north', 'east', 'ring bell', 'strike chime', 'blow horn', 'down']
      const ok = await runReplay(fresh(), 'zmachine', right)
      expect(ok.turns.at(-1)!.output).toContain('Cellar Stairs')
    })
  },
)

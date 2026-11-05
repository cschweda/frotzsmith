/// <reference types="node" />
/**
 * Every bundled ZIL sample, compiled with the committed ZILF .NET WASM bundle
 * and played through its walkthrough (app/modules/samples-shared/*.walkthrough.txt,
 * looked up with sampleWalkthrough, the registry Solutions uses).
 *
 * For each sample in ZIL_SAMPLES it asserts:
 *   - the compile succeeds with NO diagnostics at all (zero errors and zero
 *     warnings: the samples are teaching material);
 *   - the walkthrough replays to its last command with no engine error;
 *   - no replayed command hits a parser failure (walkthrough drift);
 *   - the end is reached where the sample has one, and otherwise the
 *     last turn shows what the sample is there to teach.
 *
 * GATED like the other ZIL golden tests: a ZIL compile takes several seconds
 * under the .NET WASM runtime, so the suite only runs with
 *
 *   ZIL_SAMPLE_GOLDEN=1 npx vitest run app/modules/zil/sample-walkthroughs.golden.test.ts
 *
 * ENVIRONMENT: node (default per vitest.config.ts)
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readdir } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { ZILF_FRAMEWORK_BASE } from '~~/frotzsmith.config'
import { ZIL_SAMPLES } from '~/modules/languages/zil/samples'
import { sampleWalkthrough } from '~/modules/samples-shared/walkthroughs'
import { runReplay } from '~/modules/inform6/engine/replayCore'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../..')
const frameworkDir = path.join(repoRoot, 'public', ZILF_FRAMEWORK_BASE)

const VERSION_INT: Record<string, number> = { z3: 3, z4: 4, z5: 5, z8: 8 }

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

/**
 * What each sample's last turn must show. `ended` samples reach their end
 * (the game-over banner); the others are concept demos with no end, so the
 * check is the payoff the sample exists to show.
 */
const FINALE: Record<string, { text: string; ended?: boolean }> = {
  'zil-skeleton': { text: 'open field west of a white house' },
  'zil-cloak': { text: 'You have won', ended: true },
  'zil-two-rooms': { text: 'gold coin' },
  'zil-npc': { text: 'Seek the passage to the west' },
  'zil-puzzle': { text: 'ruby jewel' },
  'zil-light': { text: 'The lantern dims and goes dark' },
  'zil-daemon': { text: 'The candle gutters and goes out' },
  'zil-architect-legacy': { text: 'The work continues', ended: true },
  'zil-mingus-1': { text: '*** You have reached the bottom of the Mingus ***', ended: true },
}

let compile: (source: string, version: number) => string

describe.skipIf(!process.env['ZIL_SAMPLE_GOLDEN'])(
  'every bundled ZIL sample compiles cleanly and plays its walkthrough (ZIL_SAMPLE_GOLDEN=1 to enable)',
  { timeout: 120_000 },
  () => {
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
      compile = (source, version) => exports.ZilfExports.Compile(source, version)
    }, 30_000)

    it('every sample has a walkthrough and a finale check', () => {
      for (const s of ZIL_SAMPLES) {
        expect(sampleWalkthrough(s.id), `walkthrough for ${s.id}`).not.toBeNull()
        expect(FINALE[s.id], `finale for ${s.id}`).toBeDefined()
      }
    })

    for (const s of ZIL_SAMPLES) {
      it(`${s.id}: no diagnostics, walkthrough plays to the end`, async () => {
        const version = VERSION_INT[s.target]!
        const result: { success: boolean; storyBase64: string | null; diagnostics: string[] } =
          JSON.parse(compile(s.source, version))
        const diagnostics = result.diagnostics.filter((d) => d.trim().length > 0)
        expect(diagnostics, `${s.id} diagnostics`).toEqual([])
        expect(result.success, `${s.id} compile`).toBe(true)
        const story = new Uint8Array(Buffer.from(result.storyBase64!, 'base64'))
        expect(story[0]).toBe(version)

        const commands = sampleWalkthrough(s.id)!
        const { turns } = await runReplay(story, 'zmachine', commands)
        // Every command was played: the game did not end or stop early.
        expect(turns, `${s.id} played every command`).toHaveLength(commands.length + 1)
        for (const t of turns.slice(1)) {
          for (const phrase of PARSER_FAILURES) {
            expect(t.output, `${s.id}: parser failure at "${t.command}":\n${t.output}`).not.toContain(phrase)
          }
        }
        const last = turns.at(-1)!.output
        const finale = FINALE[s.id]!
        expect(last, `${s.id} last turn`).toContain(finale.text)
        if (!finale.ended) expect(last, `${s.id} is not ended`).not.toMatch(/You have died|\*\*\*\*/)
      })
    }
  },
)

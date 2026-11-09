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

/** Assert that no turn after the boot turn hit a parser failure. */
function expectNoParserFailures(turns: { command?: string; output: string }[]) {
  for (const t of turns.slice(1)) {
    for (const phrase of PARSER_FAILURES) {
      expect(t.output, `parser failure at "${t.command}":\n${t.output}`).not.toContain(phrase)
    }
  }
}

/** A slice of the shared walkthrough, from `from` up to (not including) `to`. */
const walk = (from: string, to?: string) =>
  walkthrough.slice(walkthrough.indexOf(from), to ? walkthrough.indexOf(to) : undefined)

describe.skipIf(!process.env['ZIL_SAMPLE_GOLDEN'])(
  "The Architect's Legacy (ZIL sample) — shared walkthrough (ZIL_SAMPLE_GOLDEN=1 to enable)",
  { timeout: 120_000 },
  () => {
    let story: Uint8Array

    // CI's runners take about 50 s for this compile alone, and up to 100 s while other ZILF
    // goldens compile beside it (measured 2026-11-09); the limit is for a hang, not for speed.
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
    }, 240_000)

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

      // Walkthrough drift: a command the parser no longer understands.
      expectNoParserFailures(turns)

      const last = turns.at(-1)!
      expect(last.command).toBe('read blueprint')
      expect(last.output).toContain('The work continues')
      expect(last.output).toMatch(/scored 40 points out of a possible 50/)
    })

    it('EMPTY WASTEBASKET finds the right half, like SEARCH (both versions)', async () => {
      const at = walkthrough.indexOf('search wastebasket')
      const commands = [...walkthrough.slice(0, at), 'empty wastebasket', 'take half']
      const { turns } = await runReplay(fresh(), 'zmachine', commands)
      expectNoParserFailures(turns)
      expect(turns.at(-2)!.output).toContain('half of a torn blueprint')
    })

    it('CLIMB PANEL goes down the opened floor panel, like ENTER (both versions)', async () => {
      const commands = ['north', 'east', 'ring bell', 'strike chime', 'blow horn', 'climb panel']
      const { turns } = await runReplay(fresh(), 'zmachine', commands)
      expectNoParserFailures(turns)
      expect(turns.at(-1)!.output).toContain('Cellar Stairs')
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

    it('a wrong note mid-sequence is refused and resets the chord', async () => {
      // bell (right), horn (wrong: the chime comes second), chime (now alone).
      const commands = ['north', 'east', 'ring bell', 'blow horn', 'strike chime', 'down']
      const { turns } = await runReplay(fresh(), 'zmachine', commands)
      expect(turns).toHaveLength(commands.length + 1)
      expect(turns[4]!.output).toContain('collapses into a discord')
      expect(turns[5]!.output).toContain('It was not the note it was waiting for')
      expect(turns.at(-1)!.output).not.toContain('Cellar Stairs')
    })

    // Phrasings beyond the walkthrough that the sample promises to understand.
    it('understands noun-noun names, TURN DIAL TO, SWITCH ON/OFF and the stilled Shifting Room', async () => {
      const at = (cmd: string) => walkthrough.indexOf(cmd)
      const commands = [
        ...walkthrough.slice(0, at('set dial to 8')),
        'turn dial to 8',
        ...walkthrough.slice(at('take journal'), at('down')),
        'x floor panel',
        ...walkthrough.slice(at('down'), at('set dial to spiral')),
        'x lift cage',
        'turn dial to spiral',
        ...walkthrough.slice(at('pull lever'), at('turn wheel')),
        'switch on pump',
        'switch off pump',
        'turn wheel',
        'switch on pump',
        ...walkthrough.slice(at('turn on pump') + 1, at('take crystal') + 2),
        'x formula wall',
        ...walkthrough.slice(at('take crystal') + 2, at('put crystal on pedestal')),
        // Back through the Shifting Room after passing it: it has stilled.
        'south', 'wait', 'listen', 'north',
        ...walkthrough.slice(at('put crystal on pedestal')),
      ]
      const { turns } = await runReplay(fresh(), 'zmachine', commands)
      expect(turns).toHaveLength(commands.length + 1)
      expectNoParserFailures(turns)
      const out = (cmd: string) => turns.find((t) => t.command === cmd)!.output
      expect(out('turn dial to 8')).toContain('satisfied click')
      expect(out('x floor panel')).toContain('floorboards')
      expect(out('x lift cage')).toContain('A brass cage')
      expect(out('turn dial to spiral')).toContain('clicks round to the spiral')
      expect(out('switch off pump')).toContain('falls silent')
      expect(turns.filter((t) => t.command === 'switch on pump').at(-1)!.output).toContain(
        'flooded no longer',
      )
      expect(out('x formula wall')).toContain('Checked. A.Q.')
      const back = turns.findLastIndex((t) => t.command === 'south')
      expect(turns[back]!.output).toContain('kept still')
      expect(turns[back + 1]!.output).toContain('the room has stilled')
      expect(turns[back + 1]!.output).not.toContain('grinding')
      expect(turns[back + 2]!.output).toContain('The grinding has stopped')
      expect(turns.at(-1)!.output).toContain('The work continues')
    })
  },
)

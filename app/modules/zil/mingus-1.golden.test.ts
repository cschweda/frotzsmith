/// <reference types="node" />
/**
 * Walkthrough test for the ZIL version of the second longer bundled sample,
 * "Mingus I: Elevated Returns" (languages/zil/samples/mingus-1.zil). Compiles
 * the registered sample with the committed ZILF .NET WASM bundle under Node,
 * then replays the SHARED walkthrough
 * (app/modules/samples-shared/mingus-1.walkthrough.txt — the Inform 6 version
 * is verified against the same file) on the headless Z-machine.
 *
 * Beyond "the game is winnable", it pins the finale's timed rule (the
 * three-poke rule, docs/superpowers/specs/2026-11-05-mingus-1-sample-design.md)
 * so a change that makes it unfair — or toothless — fails loudly. The
 * assertions mirror app/modules/inform6/mingus-1.golden.test.ts.
 *
 * Bundled samples are canonical: the compile must report ZERO errors and
 * ZERO warnings (ZILF reports both as diagnostics).
 *
 * GATED like architect-legacy.golden.test.ts: a ZIL compile takes several
 * seconds under the .NET WASM runtime, so the suite only runs with
 *
 *   ZIL_SAMPLE_GOLDEN=1 npx vitest run app/modules/zil/mingus-1.golden.test.ts
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
  new URL('../samples-shared/mingus-1.walkthrough.txt', import.meta.url),
)

const walkthrough = readFileSync(WALKTHROUGH, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.length > 0)

/** The walkthrough up to (not including) the first occurrence of `cmd`. */
const until = (cmd: string) => {
  const i = walkthrough.indexOf(cmd)
  if (i < 0) throw new Error(`walkthrough has no "${cmd}"`)
  return walkthrough.slice(0, i)
}

/** The walkthrough up to and including the first `east` after `down` from the
 *  Windward Ledge: the player has just arrived on the Runout with the pike. */
const RUNOUT_PREFIX = until('dig by gondola')

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

describe.skipIf(!process.env['ZIL_SAMPLE_GOLDEN'])(
  'Mingus I: Elevated Returns (ZIL sample) — shared walkthrough (ZIL_SAMPLE_GOLDEN=1 to enable)',
  { timeout: 120_000 },
  () => {
    let story: Uint8Array
    let diagnostics: string[] = []

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

      const sample = sampleById('zil-mingus-1')
      expect(sample, 'zil-mingus-1 is registered').toBeDefined()
      expect(sample!.target).toBe('z5')

      const result: { success: boolean; storyBase64: string | null; diagnostics: string[] } =
        JSON.parse(exports.ZilfExports.Compile(sample!.source, 5))
      expect(result.success, `compile failed:\n${result.diagnostics.join('\n')}`).toBe(true)
      diagnostics = result.diagnostics.filter((d) => d.trim().length > 0)
      story = new Uint8Array(Buffer.from(result.storyBase64!, 'base64'))
    }, 60_000)

    // The VM runs in the story's own bytes (it mutates dynamic memory), so
    // every replay gets a fresh copy of the compiled story.
    const fresh = () => story.slice()
    const play = async (commands: string[]) => {
      const { turns } = await runReplay(fresh(), 'zmachine', commands)
      expect(turns).toHaveLength(commands.length + 1)
      return turns
    }

    it('compiles to a z5 story with zero errors and zero warnings', () => {
      // No diagnostics of any kind: the sample is teaching material.
      expect(diagnostics.filter((d) => /error/i.test(d)), 'compiler reported errors').toEqual([])
      expect(diagnostics.filter((d) => /warning/i.test(d)), 'compiler reported warnings').toEqual([])
      expect(diagnostics).toEqual([])
      expect(story[0]).toBe(5)
    })

    it("the walkthrough is the spec's 70 commands, ending with east", () => {
      expect(walkthrough).toHaveLength(70)
      expect(walkthrough.at(-1)).toBe('east')
    })

    it('wins with the shared walkthrough, scoring 60 of 60', async () => {
      const turns = await play(walkthrough)
      // Walkthrough drift: a command zillib's parser no longer understands.
      expectNoParserFailures(turns)

      const last = turns.at(-1)!
      expect(last.command).toBe('east')
      expect(last.output).toContain('*** You have reached the bottom of the Mingus ***')
      expect(last.output).toContain('Nobody here is going to tell you to climb it')
      // zillib prints the rank (and with it the teaser) from PRINT-RANK,
      // after the score line; the spec asks for presence, not order.
      expect(last.output).toContain('EVERYTHING ROLLS DOWNHILL')
      expect(last.output).toContain('Exit Liquidity')
      expect(last.output).toMatch(/scored 60 points out of a possible 60/)
      expect(last.output).not.toContain('You have died')
    })

    it('prints each pivotal line on its own turn', async () => {
      const turns = await play(walkthrough)
      const out = (cmd: string, nth = 0) => turns.filter((t) => t.command === cmd)[nth]!.output
      expect(out('type mountain')).toContain('The tears freeze')
      expect(out('look through telescope')).toContain('by the upturned gondola car')
      expect(out('press shop tile')).toContain('to be left behind')
      expect(out('select none')).toContain('Verification complete')
      expect(out('put card in slot')).toContain('more efficient')
      expect(out('type up')).toContain('MNEMONIC ACCEPTED')
      expect(out('press pawl with pin')).toContain("I won't need it up here")
      // The Runout: arrival is free, then one poke per turn until the pike is up.
      const arrive = turns.findIndex((t) => t.command === 'dig by gondola') - 1
      expect(turns[arrive]!.output).toContain('regards you with total contempt')
      expect(turns[arrive]!.output).toContain('[POKES: ---]')
      expect(out('dig by gondola')).toContain('[POKES: *--]')
      expect(out('take coat')).toContain('[POKES: **-]')
      expect(out('fend verdlings with pike')).toContain('[POKES: **-]')
      // The ending, over several turns: the bowing, then the parting on WAIT.
      expect(turns.at(-4)!.output).toContain('lower their pikes and bow')
      expect(out('bow')).toContain('something very like approval')
      expect(out('bow')).not.toContain('A lane opens')
      expect(out('wait')).toContain('A lane opens')
      expect(out('wait')).toContain('funeral ships')
    })

    describe('the three-poke rule', () => {
      it('three pokes on the Runout without the pike raised kill you', async () => {
        const turns = await play([...RUNOUT_PREFIX, 'wait', 'wait', 'wait'])
        expect(turns.at(-3)!.output).toContain('[POKES: *--]')
        expect(turns.at(-2)!.output).toContain('[POKES: **-]')
        expect(turns.at(-2)!.output).not.toContain('You have died')
        const last = turns.at(-1)!.output
        expect(last).toContain('do not only poke')
        expect(last).toContain('poked back up the mountain in the morning, as a courtesy')
        expect(last).toContain('*** You have died ***')
        expect(last).not.toContain('bottom of the Mingus')
      })

      it('leaving resets the count', async () => {
        const turns = await play([...RUNOUT_PREFIX, 'wait', 'wait', 'west', 'east', 'wait', 'wait'])
        for (const t of turns) expect(t.output).not.toContain('You have died')
        expect(turns.at(-3)!.output).toContain('[POKES: ---]')
        expect(turns.at(-1)!.output).toContain('[POKES: **-]')
      })

      it('a raised pike stops the pokes until another action lowers it', async () => {
        const turns = await play([...RUNOUT_PREFIX, 'raise pike', 'wait', 'look', 'take medallions'])
        expectNoParserFailures(turns.slice(-4))
        expect(turns.at(-3)!.output).toContain('[POKES: ---]')
        expect(turns.at(-2)!.output).toContain('[POKES: ---]')
        // TAKE lowers the pike, the treasure costs a poke on the spot, and the
        // end of the turn lands another.
        const take = turns.at(-1)!.output
        expect(take).toContain('(You lower the pike.)')
        expect(take).toContain('pokes your hand')
        expect(take).toContain('[POKES: *--]')
        expect(take).toContain('[POKES: **-]')
      })

      it('bare-handed, walking east gets you escorted back to the station', async () => {
        const prefix = RUNOUT_PREFIX.filter((c) => c !== 'press pawl with pin')
        const turns = await play([...prefix, 'east'])
        const last = turns.at(-1)!.output
        expect(last).toContain("only a pike gets a verdling's respect")
        expect(last).toContain('Bottom Gondola Station')
        expect(last).not.toContain('You have died')
      })

      it('with the pike lowered, walking east gets you escorted too — with a hint', async () => {
        const turns = await play([...RUNOUT_PREFIX, 'east'])
        const last = turns.at(-1)!.output
        expect(last).toContain('A pike only matters raised')
        expect(last).toContain('Bottom Gondola Station')
      })

      it('with the pike raised but no coat, you are told to fetch it', async () => {
        const turns = await play([...RUNOUT_PREFIX, 'fend verdlings with pike', 'east'])
        const last = turns.at(-1)!.output
        expect(last).toContain('You came down for the coat')
        expect(last).not.toContain("The River's Edge")
        // The pike stays up: no poke lands.
        expect(last).toContain('[POKES: ---]')
      })
    })

    describe('the puzzles refuse wrong input', () => {
      it('a wrong tile order leaves the ballroom floor shut', async () => {
        const turns = await play([
          ...until('press foyer tile'),
          'press shaft tile', 'press foyer tile', 'press station tile',
          'press observatory tile', 'press shop tile', 'down',
        ])
        expect(turns.at(-2)!.output).toContain('disappointed click')
        expect(turns.at(-1)!.output).not.toContain('Root Cellar')
      })

      it('a wrong kiosk word does not advance the line', async () => {
        const turns = await play([...until('type nobody'), 'type money', 'type nobody'])
        expect(turns.at(-2)!.output).toContain('NOT CLEAR ENOUGH')
        expect(turns.at(-2)!.output).toContain('decentralized synergy')
        expect(turns.at(-1)!.output).toContain('trustless value-capture')
      })

      it('a gold word at the keypad resets the mnemonic', async () => {
        const turns = await play([...until('type they'), 'type they', 'type higher'])
        expect(turns.at(-2)!.output).toContain('1 OF 4')
        expect(turns.at(-1)!.output).toContain('INVALID MNEMONIC. 0 OF 4.')
      })

      it('the consensus door wants two attestations', async () => {
        const turns = await play([...until('west'), 'west', 'north'])
        expect(turns.at(-1)!.output).toContain('YOU HAVE 1')
        expect(turns.at(-1)!.output).not.toContain('The Archive')
      })
    })

    it('understands phrasings beyond the walkthrough', async () => {
      const scope = await play([...until('turn telescope'), 'x telescopes', 'x telescope'])
      expectNoParserFailures(scope)
      expect(scope.at(-2)!.output).toContain('Twelve brass telescopes')
      expect(scope.at(-1)!.output).toContain('swivel mount')

      const tiles = await play([...until('press foyer tile'), 'push foyer tile'])
      expectNoParserFailures(tiles)
      expect(tiles.at(-1)!.output).toContain('FOYER tile sinks with a heavy click')

      const grease = await play([...until('oil buckle'), 'grease buckle'])
      expectNoParserFailures(grease)
      expect(grease.at(-1)!.output).toContain('hopeful creak')

      const raise = await play([...RUNOUT_PREFIX, 'raise pike'])
      expectNoParserFailures(raise)
      expect(raise.at(-1)!.output).toContain('stop short, stare at the pike')

      const follow = await play([...walkthrough.slice(0, -1), 'follow lane'])
      expectNoParserFailures(follow)
      expect(follow.at(-1)!.output).toContain('You have reached the bottom of the Mingus')
    })
  },
)

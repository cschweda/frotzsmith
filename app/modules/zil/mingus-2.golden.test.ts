/// <reference types="node" />
/**
 * Walkthrough test for the ZIL version of the third longer bundled sample,
 * "Mingus II: Everything Rolls Downhill" (languages/zil/samples/mingus-2.zil).
 * Compiles the registered sample with the committed ZILF .NET WASM bundle
 * under Node, then replays the SHARED walkthrough
 * (app/modules/samples-shared/mingus-2.walkthrough.txt -- the Inform 6
 * version is verified against the same file) on the headless Z-machine.
 *
 * It mirrors app/modules/inform6/mingus-2.golden.test.ts case for case: the
 * NPC Lucan (following, leading, conversation, GIVE/SHOW, his scripted death
 * on turn 42), the current (the one-turn windows, the eddy, the deadly
 * broken end, the warn-once river rule), Sandwich's schedule, and the
 * turn-timing parity rules (docs/superpowers/specs/2026-11-05-mingus-2-sample-design.md).
 * Only the stock-library wording differs between the two files (zillib's
 * score line, its parser messages).
 *
 * Bundled samples are canonical: the compile must report ZERO errors and
 * ZERO warnings (ZILF reports both as diagnostics).
 *
 * GATED like mingus-1.golden.test.ts: a ZIL compile takes several seconds
 * under the .NET WASM runtime, so the suite only runs with
 *
 *   ZIL_SAMPLE_GOLDEN=1 npx vitest run app/modules/zil/mingus-2.golden.test.ts
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
  new URL('../samples-shared/mingus-2.walkthrough.txt', import.meta.url),
)

const walkthrough = readFileSync(WALKTHROUGH, 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l.length > 0)

/** The walkthrough's first n commands: "to #n" in the spec's numbering. */
const to = (n: number) => walkthrough.slice(0, n)

/** The walkthrough with every occurrence of `cmd` removed. */
const without = (cmd: string) => walkthrough.filter(c => c !== cmd)

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
  'What do you want to',
]

/** Assert that none of the replayed commands hit a parser failure. */
function expectNoParserFailures(turns: { command?: string; output: string }[]) {
  for (const t of turns.slice(1)) {
    for (const phrase of PARSER_FAILURES) {
      expect(t.output, `parser failure at "${t.command}":\n${t.output}`).not.toContain(phrase)
    }
  }
}

describe.skipIf(!process.env['ZIL_SAMPLE_GOLDEN'])(
  'Mingus II: Everything Rolls Downhill (ZIL sample) — shared walkthrough (ZIL_SAMPLE_GOLDEN=1 to enable)',
  { timeout: 120_000 },
  () => {
  let story: Uint8Array
  let diagnostics: string[] = []

  beforeAll(async () => {
    const files = await readdir(frameworkDir)
    const dotnetJs = files.includes('dotnet.js')
      ? 'dotnet.js'
      : files.find(
          f => f.match(/^dotnet\.[a-z0-9]+\.js$/) && !f.includes('native') && !f.includes('runtime'),
        )
    if (!dotnetJs) throw new Error(`Could not find dotnet.js in ${frameworkDir}`)
    const { dotnet } = await import(
      /* @vite-ignore */ pathToFileURL(path.join(frameworkDir, dotnetJs)).href as string
    )
    const { getAssemblyExports, getConfig } = await dotnet.withApplicationArguments().create()
    const exports = (await getAssemblyExports(getConfig().mainAssemblyName)) as {
      ZilfExports: { Compile: (source: string, version: number) => string }
    }

    const sample = sampleById('zil-mingus-2')
    expect(sample, 'zil-mingus-2 is registered').toBeDefined()
    expect(sample!.target).toBe('z5')

    const result: { success: boolean; storyBase64: string | null; diagnostics: string[] } =
      JSON.parse(exports.ZilfExports.Compile(sample!.source, 5))
    expect(result.success, `compile failed:\n${result.diagnostics.join('\n')}`).toBe(true)
    diagnostics = result.diagnostics.filter(d => d.trim().length > 0)
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
  /** Play prefix + cmds; check the extra commands parse; return their outputs. */
  const tail = async (prefix: string[], cmds: string[]) => {
    const turns = await play([...prefix, ...cmds])
    const extra = turns.slice(-cmds.length)
    expectNoParserFailures([turns[0]!, ...extra])
    return extra.map(t => t.output)
  }

  it('compiles to a z5 story with zero errors and zero warnings', () => {
    // No diagnostics of any kind: the sample is teaching material.
    expect(diagnostics.filter(d => /error/i.test(d)), 'compiler reported errors').toEqual([])
    expect(diagnostics.filter(d => /warning/i.test(d)), 'compiler reported warnings').toEqual([])
    expect(diagnostics).toEqual([])
    expect(story[0]).toBe(5)
  })

  it("the walkthrough is the spec's 74 commands, ending with put plaque in chest", () => {
    expect(walkthrough).toHaveLength(74)
    expect(walkthrough.at(-1)).toBe('put plaque in chest')
  })

  it('wins with the shared walkthrough, scoring 100 of 100', async () => {
    const turns = await play(walkthrough)
    expect(turns).toHaveLength(75)
    // Walkthrough drift: a command the parser no longer understands.
    expectNoParserFailures(turns)

    const last = turns.at(-1)!
    expect(last.command).toBe('put plaque in chest')
    expect(last.output).toContain('You have gone further down the Verdance than anyone')
    expect(last.output).toContain('*** You have gone further than anyone ***')
    expect(last.output).toContain('Furthest Downstream')
    expect(last.output).toContain('Coming next: MINGUS III: THE OLD SIDE.')
    expect(last.output).toContain('Nobody has ever come back')
    expect(last.output).toMatch(/scored 100 points out of a possible 100/)
    // zillib prints the rank (and with it the teaser) from PRINT-RANK, after
    // the score line; the spec asks for presence, not order.
    // The Mingus III house is never mentioned.
    expect(last.output).not.toMatch(/house/i)
  }, 60_000)

  it('prints each pivotal line on its own turn', async () => {
    const turns = await play(walkthrough)
    const out = (cmd: string, nth = 0) => turns.filter(t => t.command === cmd)[nth]!.output
    const at = (n: number) => turns[n]!.output   // turns[n] answers command #n
    expect(out('read receipt')).toContain('BOTTOM LINE SALVAGE')
    expect(out('bow')).toContain('let go of the lines')
    expect(out('pull lever')).toContain('[CURRENT: 1/3]')
    expect(out('pull lever')).toContain('someone sneezes')
    expect(at(11)).toContain('Lucan Fairweather. Tenor. Thursdays.')
    expect(out('put register in chest')).toContain('NOTHING HAS EVER BEEN WITHDRAWN')
    expect(out('put register in chest')).toContain('sandbar')
    expect(at(17)).toContain("It's latency")
    expect(out('take strongbox')).toContain('FIRST!')
    expect(out('take strongbox')).toContain('rows away')
    expect(out('put sweep in socket')).toContain('as if it had been waiting')
    expect(out('pull line')).toContain('[CURRENT: 1/3]')
    expect(out('ask lucan about songs')).toContain('steer east now')
    expect(out('steer east')).toContain('No one crosses the Verdance')
    expect(out('take lifebelt')).toContain('steps back to take it all in')
    expect(out('wear lifebelt')).toContain('Lucan is gone')
    expect(out('ring bell', 1)).toContain('past a towel')
    expect(out('examine chain')).toContain('Throw now or not at all')
    expect(out('throw grapnel at chain')).toContain('bites')
    expect(out('pull box with pike')).toContain('VAUNT CIVIC KEY')
    expect(out('wait')).toContain('PUMPING STATION No. 2')
    expect(out('put key in switch')).toContain("Fair's fair")
    expect(at(70)).toContain('meant to be driven')
    expect(at(73)).toContain('FIRST ACROSS')
  }, 60_000)

  it('runs the current on the spec\'s turns (the turn audit)', async () => {
    const turns = await play(walkthrough)
    const at = (n: number) => turns[n]!.output
    const drifts: [number, number][] = [
      [10, 1], [11, 2], [12, 3], [30, 1], [31, 2], [32, 3], [50, 1], [51, 2], [52, 3],
      [65, 1], [66, 2], [67, 3], [72, 1], [73, 2], [74, 3],
    ]
    for (const [n, d] of drifts) expect(at(n), `#${n}`).toContain(`[CURRENT: ${d}/3]`)
    expect(turns.filter(t => t.output.includes('[CURRENT:'))).toHaveLength(drifts.length)
  }, 60_000)

  describe('the NPC: Lucan Fairweather', () => {
    it('follows, talks, leads, waits, arrives and dies on the spec\'s turns', async () => {
      const turns = await play(walkthrough)
      expectNoParserFailures(turns)
      const at = (n: number) => turns[n]!.output
      expect(at(13), 'say hello').toContain('Your servant, chief')
      expect(at(14), 'ask about sandwich').toContain('Reach for the gilt')
      expect(at(15), 'up').toContain('Lucan follows you, humming.')
      expect(at(16), 'out').toContain('Lucan follows you, humming.')
      expect(at(31), 'ask about old side').toContain('Tonight I find out which')
      expect(at(33), 'steer east').toContain('onto the pier before the ship has stopped moving')
      expect(at(34), 'north: he calls').toContain('calling for you to keep up')
      expect(at(35), 'out: he waits').not.toContain('This way!')
      expect(at(36), 'ring bell: he leads').toContain('This way!')
      expect(at(37), 'ask thrumble: he calls').toContain('calling for you to keep up')
      expect(at(38), 'north: he waits').not.toContain('This way!')
      expect(at(39), 'examine patches: he leads').toContain('This way!')
      expect(at(40), 'north: ARRIVED').toContain('A ring on a post')
      expect(at(41), 'take lifebelt: timer 1').not.toContain('Lucan is gone')
      // The death is on turn 42, whatever the player does.
      expect(at(42), 'wear lifebelt: timer 2').toContain('Lucan is gone')
    }, 60_000)

    it('has a fallback line, a topic table TELL shares, and GIVE / SHOW reactions', async () => {
      const [fallback, tell, show, give, hello, greet, sayTo] = await tail(to(14), [
        'ask lucan about weather', 'tell lucan about verdlings', 'show coat to lucan',
        'give pike to lucan', 'hello', 'greet lucan', 'say hello to lucan',
      ])
      expect(fallback).toContain('sings a line about something else entirely')
      expect(tell).toContain('They bowed to you')
      expect(show).toContain('Both weddings')
      expect(give).toContain('Not to me, chief')
      for (const g of [hello, greet, sayTo]) expect(g).toContain('Your servant, chief')
    }, 60_000)

    it('FOLLOW LUCAN takes you to where he has gone; FOLLOW HIM too', async () => {
      const [, follow] = await tail(to(36), ['wait', 'follow lucan'])
      expect(follow).toContain('The Mine Heads')
      expect(follow).toContain('Here and there the grass is a brighter green')
      const [him] = await tail(to(36), ['follow him'])
      expect(him).toContain('The Mine Heads')
    }, 60_000)

    it('catches up if you get ahead, and still dies two turns after arriving', async () => {
      const outs = await tail(to(35), ['north', 'north', 'wait', 'wait'])
      expect(outs[0]).toContain('Wait for me!')
      expect(outs[1]).toContain('Wait for me!')
      expect(outs[1]).toContain('A ring on a post')
      expect(outs[2]).not.toContain('Lucan is gone')
      expect(outs[3]).toContain('Lucan is gone')
    }, 60_000)

    it('cannot be saved: WARN LUCAN is waved off, and he dies on that same turn', async () => {
      const [warn] = await tail(to(41), ['warn lucan'])
      expect(warn).toContain('mid-verse')
      expect(warn).toContain('Lucan is gone')
    }, 60_000)

    it('leaves his effects behind, and the patches are never deadly to you', async () => {
      const [hat, step, down] = await tail(to(42), ['examine hat', 'step on patch', 'down'])
      expect(hat).toContain('A Thursday hat')
      expect(step).toContain("You remember Lucan. You don't.")
      expect(down).toContain("You remember Lucan. You don't.")
      for (const o of [hat, step, down]) expect(o).not.toContain('You have died')
    }, 60_000)

    it('the other NPCs mention him afterwards', async () => {
      const turns = await play(to(68))
      expect(turns.at(-1)!.output).toContain("Where's your tenor?")
      const [ask] = await tail(to(45), ['ask thrumble about lucan'])
      expect(ask).toContain('past a towel')
    }, 60_000)

    it('keeps the ship at the pier while he lives', async () => {
      const [, untie] = await tail(to(33), ['north', 'untie rope'])
      expect(untie).toContain('Twenty years')
      expect(untie).not.toContain('[CURRENT:')
    }, 60_000)
  })

  describe('the current', () => {
    it('the eddy brings you round on a missed crossing, and you can try again', async () => {
      const outs = await tail(to(32), ['wait', 'wait', 'wait', 'steer east'])
      expect(outs[0]).toContain('the eddy brings you round')
      expect(outs[0]).toContain('[CURRENT: 1/3]')
      expect(outs[0]).not.toContain('Stone Pier')
      expect(outs[1]).toContain('[CURRENT: 2/3]')
      expect(outs[2]).toContain('[CURRENT: 3/3]')
      expect(outs[3]).toContain('No one crosses the Verdance')
    }, 60_000)

    it('steering too early is refused, and the turn still passes', async () => {
      const [early] = await tail(to(30), ['steer east'])
      expect(early).toContain('Not yet')
      expect(early).toContain('[CURRENT: 2/3]')
    }, 60_000)

    it('missing the chain kills you under the broken end', async () => {
      const [miss] = await tail(to(52), ['wait'])
      expect(miss).toContain('The hull opens like a letter')
      expect(miss).toContain('*** You have died ***')
    }, 60_000)

    it('the Race without the lifebelt on is death', async () => {
      const cmds = without('wear lifebelt')
      const turns = await play(cmds)
      expect(turns).toHaveLength(74)
      expect(turns.at(-2)!.output).toContain('If you are going to put that lifebelt on')
      const last = turns.at(-1)!.output
      expect(last).toContain('*** You have died ***')
      expect(last).not.toContain('Furthest Downstream')
    }, 60_000)
  })

  describe('the river warns once, globally', () => {
    it('the first SWIM warns; the second kills', async () => {
      const [first, second] = await tail([], ['swim', 'swim'])
      expect(first).toContain('warns you once')
      expect(first).not.toContain('You have died')
      expect(second).toContain('Nobody comes back')
      expect(second).toContain('*** You have died ***')
    }, 60_000)

    it('at the Drowned Road, a warning then DOWN kills', async () => {
      const [swim, down] = await tail(to(70), ['swim', 'down'])
      expect(swim).toContain('warns you once')
      expect(down).toContain('*** You have died ***')
    }, 60_000)

    it('the warning is global: a SWIM at the start makes DOWN at the Drowned Road deadly', async () => {
      const turns = await play(['swim', ...to(70), 'down'])
      expect(turns[1]!.output).toContain('warns you once')
      expect(turns.at(-1)!.output).toContain('*** You have died ***')
    }, 60_000)

    it('the girder at the Broken End is a river attempt', async () => {
      const [girder, walk] = await tail(to(54), ['get on girder', 'walk out'])
      expect(girder).toContain('The planks tilt under your first step')
      expect(girder).toContain('warns you once')
      expect(walk).toContain('*** You have died ***')
    }, 60_000)
  })

  describe('the gates explain themselves', () => {
    it('the lever does nothing until the verdlings let go', async () => {
      const [lever] = await tail(to(8), ['pull lever'])
      expect(lever).toContain('does not move')
      expect(lever).not.toContain('[CURRENT:')
    }, 60_000)

    it('no kedging off the bar without the sweep shipped', async () => {
      const [kedge] = await tail(to(27), ['throw grapnel'])
      expect(kedge).toContain('no way to steer')
    }, 60_000)

    it('no leaving the Span without the civic key', async () => {
      const noKey = [...to(55), 'down', 'south', 'down', 'put tag in chest', 'up', 'north', 'unhook grapnel']
      const turns = await play(noKey)
      expectNoParserFailures(turns)
      expect(turns.at(-1)!.output).toContain("You're not leaving it")
      expect(turns.at(-1)!.output).not.toContain('[CURRENT:')
    }, 60_000)
  })

  describe('Sandwich, the front-runner', () => {
    it('the coat trade wins at 92, still Furthest Downstream', async () => {
      const at18 = walkthrough.indexOf('take strongbox')
      const cmds = [
        ...walkthrough.slice(0, at18), 'take sweep', 'give coat to sandwich',
        ...walkthrough.slice(at18 + 1).filter(c => c !== 'take sweep'),
      ]
      const turns = await play(cmds)
      expectNoParserFailures(turns)
      expect(turns[at18 + 2]!.output).toContain('Everyone does')
      const last = turns.at(-1)!.output
      expect(last).toContain('*** You have gone further than anyone ***')
      expect(last).toMatch(/scored 92 points out of a possible 100/)
      expect(last).toContain('Furthest Downstream')
    }, 60_000)

    it('a decoy can be swapped for the strongbox', async () => {
      const [hold, swap] = await tail(to(17), ['take nameboard', 'take strongbox'])
      expect(hold).toContain('Yours for the coat')
      expect(swap).toContain('Better offer!')
      expect(swap).toContain('rows away')
    }, 60_000)

    it('he holds the plaque until the pump stops', async () => {
      const [plaque] = await tail(to(68), ['take plaque'])
      expect(plaque).toContain('Unpin me first')
    }, 60_000)
  })

  describe('the same timing as the other version', () => {
    it('INVENTORY is a turn', async () => {
      const [inv] = await tail(to(10), ['inventory'])
      expect(inv).toContain('[CURRENT: 2/3]')
    }, 60_000)

    it('SCORE is not a turn; WAIT and LOOK are', async () => {
      const [score, wait] = await tail(to(10), ['score', 'wait'])
      expect(score).not.toContain('[CURRENT:')
      expect(score).toContain('Ballast')
      expect(wait).toContain('[CURRENT: 2/3]')
      const [look] = await tail(to(10), ['look'])
      expect(look).toContain('[CURRENT: 2/3]')
    }, 60_000)

    it('the mid-game rank follows the ladder', async () => {
      const [score] = await tail(to(33), ['score'])
      expect(score).toMatch(/scored 48 points out of a possible 100/)
      expect(score).toContain('Liquidity Provider')
    }, 60_000)
  })

  it('understands the phrasings beyond the walkthrough', async () => {
    const expectLast = async (prefix: string[], cmds: string[], text: string) => {
      const outs = await tail(prefix, cmds)
      expect(outs.at(-1), cmds.join(' / ')).toContain(text)
    }
    await expectLast([], ['board ship'], 'Main Deck')
    await expectLast(to(14), ['hello'], 'Your servant, chief')
    await expectLast(to(14), ['greet lucan'], 'Your servant, chief')
    await expectLast(to(14), ['say hello to lucan'], 'Your servant, chief')
    await expectLast(to(32), ['steer for pier'], 'No one crosses the Verdance')
    await expectLast(to(49), ['cast off'], '[CURRENT: 1/3]')
    await expectLast(to(49), ['untie ship'], '[CURRENT: 1/3]')
    await expectLast(to(52), ['hook chain with grapnel'], 'bites')
    await expectLast(to(55), ['hook box with pike'], 'VAUNT CIVIC KEY')
    await expectLast(to(55), ['get box with pike'], 'VAUNT CIVIC KEY')
    await expectLast(to(68), ['unlock switch with key'], "Fair's fair")
    await expectLast(to(68), ['turn switch with key'], "Fair's fair")
    await expectLast(to(36), ['follow him'], 'The Mine Heads')
    await expectLast(to(11), ['x medallions'], 'Thousands of them')
    await expectLast(to(11), ['x medallion'], 'Thousands of them')
    await expectLast(to(36), ['ask thrumble about mountain'], "I don't look up")
    await expectLast(to(40), ['north', 'climb fence'], 'hold on to the fence')
    await expectLast(to(70), ['enter car'], 'You know exactly where it goes')
    await expectLast(to(38), ['east', 'down'], "It isn't that you can't")
  }, 120_000)
})

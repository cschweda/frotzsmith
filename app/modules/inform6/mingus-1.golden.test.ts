/// <reference types="node" />
/**
 * Walkthrough test for the second longer bundled sample, "Mingus I: Elevated
 * Returns" (samples/mingus-1.inf). Compiles the sample with the real
 * inform6.wasm under Node, then replays the SHARED walkthrough
 * (app/modules/samples-shared/mingus-1.walkthrough.txt — the ZIL version is
 * verified against the same file) on the headless Z-machine.
 *
 * Beyond "the game is winnable", it pins the finale's timed rule (the
 * three-poke rule, docs/superpowers/specs/2026-11-05-mingus-1-sample-design.md)
 * so a change that makes it unfair — or toothless — fails loudly.
 *
 * Bundled samples are canonical: the compile must report ZERO errors and
 * ZERO warnings.
 *
 * ENVIRONMENT: node (default per vitest.config.ts)
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runReplay } from './engine/replayCore'

const STD_LIB_DIR = fileURLToPath(new URL('./lib/std', import.meta.url))
const WASM_PATH = fileURLToPath(new URL('./wasm/inform6.wasm', import.meta.url))
const SAMPLE = fileURLToPath(new URL('./samples/mingus-1.inf', import.meta.url))
const WALKTHROUGH = fileURLToPath(
  new URL('../samples-shared/mingus-1.walkthrough.txt', import.meta.url),
)

const STD_ALIASES: Record<string, string> = {
  'Parser.h': 'parser.h',
  'VerbLib.h': 'verblib.h',
  'Grammar.h': 'grammar.h',
  'English.h': 'english.h',
  'Exits.h': 'exits.h',
}

let compilerOutput = ''

/** Compile an Inform 6 source against the bundled Standard Library (z5). */
async function compileStd(source: string): Promise<Uint8Array> {
  const mod = await import('./wasm/inform6.mjs')
  const factory: (opts: Record<string, unknown>) => Promise<unknown> = mod.default
  const output: string[] = []
  const m = (await factory({
    print: (line: string) => output.push(line),
    printErr: (line: string) => output.push(line),
    locateFile: (path: string) => (path.endsWith('.wasm') ? WASM_PATH : path),
  })) as {
    FS: {
      mkdir: (p: string) => void
      writeFile: (p: string, d: string | Uint8Array) => void
      readFile: (p: string) => Uint8Array
      chdir: (p: string) => void
    }
    callMain: (args: string[]) => number
  }
  const mkdir = (p: string) => {
    try { m.FS.mkdir(p) } catch { /* exists */ }
  }
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
  mkdir('/work')
  m.FS.writeFile('/work/story.inf', source)
  m.FS.chdir('/work')
  try {
    // Same switches as the app's compile path (compile-main.ts).
    m.callMain(['+include_path=/lib/std', '-s', '-Cu', '-v5', 'story.inf', 'story.z5'])
  } catch (e: unknown) {
    throw new Error(`callMain threw: ${String(e)}\n\nCompiler output:\n${output.join('\n')}`)
  }
  compilerOutput = output.join('\n')
  return m.FS.readFile('/work/story.z5')
}

const walkthrough = readFileSync(WALKTHROUGH, 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l.length > 0)

/** The walkthrough up to (not including) the first occurrence of `cmd`. */
const until = (cmd: string) => {
  const i = walkthrough.indexOf(cmd)
  if (i < 0) throw new Error(`walkthrough has no "${cmd}"`)
  return walkthrough.slice(0, i)
}

/** The walkthrough up to and including the first `east` after `down` from the
 *  Windward Ledge: the player has just arrived on the Runout with the pike. */
const RUNOUT_PREFIX = walkthrough.slice(0, walkthrough.indexOf('dig by gondola'))

/** The walkthrough up to the arrival at the River's Edge (its last three
 *  commands are bow, wait, east). */
const EDGE = walkthrough.slice(0, -3)

/** A winning run that skips all five lore points: 50 of 60. */
const NO_LORE = (() => {
  const lore = new Set([
    'read plaque', 'listen to busker', 'read terminal', 'read genesis block',
    'take hard hat', 'give hard hat to thrumble',
  ])
  const out: string[] = []
  for (let i = 0; i < walkthrough.length; i++) {
    const c = walkthrough[i]!
    if (lore.has(c)) continue
    // The detour down the Shared Shaft (down, give hat, up) goes too.
    if (c === 'down' && walkthrough[i + 1] === 'give hard hat to thrumble') continue
    if (c === 'up' && walkthrough[i - 1] === 'give hard hat to thrumble') continue
    out.push(c)
  }
  return out
})()

/** The Standard Library's messages for a command the parser rejected or
 *  could not resolve (lib/std/english.h, Miscellany 27-48). */
const PARSER_FAILURES = [
  "I didn't understand that sentence.",
  'I only understood you as far as',
  "I didn't understand that number.",
  "I didn't understand the way that finished.",
  "You can't see",
  "That's not a verb",
  'Which do you mean',
  'Who do you mean',
  'What do you want to',
  "I'm not sure what",
]

/** Assert that none of the replayed commands hit a parser failure. */
function expectNoParserFailures(turns: { command?: string; output: string }[]) {
  for (const t of turns.slice(1)) {
    for (const phrase of PARSER_FAILURES) {
      expect(t.output, `parser failure at "${t.command}":\n${t.output}`).not.toContain(phrase)
    }
  }
}

describe('Mingus I: Elevated Returns (I6 sample) — shared walkthrough', () => {
  let story: Uint8Array

  beforeAll(async () => {
    story = await compileStd(readFileSync(SAMPLE, 'utf8'))
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
    expect(compilerOutput, 'compiler reported errors').not.toMatch(/\bError:|Fatal error/)
    expect(compilerOutput, 'compiler reported warnings').not.toMatch(/\bWarning:/)
    expect(story[0]).toBe(5)
  })

  it('the walkthrough is the spec\'s 70 commands, ending with east', () => {
    expect(walkthrough).toHaveLength(70)
    expect(walkthrough.at(-1)).toBe('east')
  })

  it('wins with the shared walkthrough, scoring 60 of 60', async () => {
    const turns = await play(walkthrough)
    // Walkthrough drift: a command the parser no longer understands.
    expectNoParserFailures(turns)

    const last = turns.at(-1)!
    expect(last.command).toBe('east')
    expect(last.output).toContain('You have reached the bottom of the Mingus')
    expect(last.output).toContain('*** You have reached the bottom of the Mingus ***')
    expect(last.output).toContain('Nobody here is going to tell you to climb it')
    expect(last.output).toContain('EVERYTHING ROLLS DOWNHILL')
    expect(last.output).toContain('Exit Liquidity')
    expect(last.output).toMatch(/scored 60 out of a possible 60/)
  }, 60_000)

  it('prints each pivotal line on its own turn', async () => {
    const turns = await play(walkthrough)
    const out = (cmd: string, nth = 0) => turns.filter(t => t.command === cmd)[nth]!.output
    expect(out('type mountain')).toContain('The tears freeze')
    expect(out('look through telescope')).toContain('by the upturned gondola car')
    expect(out('press shop tile')).toContain('to be left behind')
    expect(out('select none')).toContain('Verification complete')
    expect(out('put card in slot')).toContain('more efficient')
    expect(out('type up')).toContain('MNEMONIC ACCEPTED')
    expect(out('press pawl with pin')).toContain("I won't need it up here")
    // The Runout: arrival is free, then one poke per turn until the pike is up.
    const arrive = turns.findIndex(t => t.command === 'dig by gondola') - 1
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
  }, 60_000)

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
    }, 60_000)

    it('leaving resets the count', async () => {
      const turns = await play([...RUNOUT_PREFIX, 'wait', 'wait', 'west', 'east', 'wait', 'wait'])
      for (const t of turns) expect(t.output).not.toContain('You have died')
      expect(turns.at(-3)!.output).toContain('[POKES: ---]')
      expect(turns.at(-1)!.output).toContain('[POKES: **-]')
    }, 60_000)

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
      expect(take).toContain('[POKES: **-]')
    }, 60_000)

    it('bare-handed, walking east gets you escorted back to the station', async () => {
      const prefix = RUNOUT_PREFIX.filter(c => c !== 'press pawl with pin')
      const turns = await play([...prefix, 'east'])
      const last = turns.at(-1)!.output
      expect(last).toContain("only a pike gets a verdling's respect")
      expect(last).toContain('Bottom Gondola Station')
      expect(last).not.toContain('You have died')
    }, 60_000)

    it('with the pike lowered, walking east gets you escorted too — with a hint', async () => {
      const turns = await play([...RUNOUT_PREFIX, 'east'])
      const last = turns.at(-1)!.output
      expect(last).toContain('A pike only matters raised')
      expect(last).toContain('Bottom Gondola Station')
    }, 60_000)

    it('with the pike raised but no coat, you are told to fetch it', async () => {
      const turns = await play([...RUNOUT_PREFIX, 'fend verdlings with pike', 'east'])
      const last = turns.at(-1)!.output
      expect(last).toContain('You came down for the coat')
      expect(last).not.toContain("The River's Edge")
      // The pike stays up: no poke lands.
      expect(last).toContain('[POKES: ---]')
    }, 60_000)
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
    }, 60_000)

    it('a wrong kiosk word does not advance the line', async () => {
      const turns = await play([...until('type nobody'), 'type money', 'type nobody'])
      expect(turns.at(-2)!.output).toContain('NOT CLEAR ENOUGH')
      expect(turns.at(-2)!.output).toContain('decentralized synergy')
      expect(turns.at(-1)!.output).toContain('trustless value-capture')
      // And on the second line too.
      const two = await play([...until('type money'), 'type rock', 'type money'])
      expect(two.at(-2)!.output).toContain('NOT CLEAR ENOUGH')
      expect(two.at(-2)!.output).toContain('trustless value-capture')
      expect(two.at(-1)!.output).toContain('elevation-agnostic vertical')
    }, 60_000)

    it('a gold word at the keypad resets the mnemonic', async () => {
      const turns = await play([...until('type they'), 'type they', 'type higher'])
      expect(turns.at(-2)!.output).toContain('1 OF 4')
      expect(turns.at(-1)!.output).toContain('INVALID MNEMONIC. 0 OF 4.')
    }, 60_000)

    it('the consensus door wants two attestations', async () => {
      const turns = await play([...until('west'), 'west', 'north'])
      expect(turns.at(-1)!.output).toContain('YOU HAVE 1')
      expect(turns.at(-1)!.output).not.toContain('The Archive')
    }, 60_000)
  })

  describe('the same timing as the other version', () => {
    it('INVENTORY is a turn on the Runout: three of them kill you', async () => {
      const turns = await play([...RUNOUT_PREFIX, 'inventory', 'inventory', 'inventory'])
      expect(turns.at(-3)!.output).toContain('[POKES: *--]')
      expect(turns.at(-2)!.output).toContain('[POKES: **-]')
      expect(turns.at(-2)!.output).not.toContain('You have died')
      expect(turns.at(-1)!.output).toContain('*** You have died ***')
    }, 60_000)

    it('a treasure grab with one poke already landed kills you', async () => {
      const turns = await play([...RUNOUT_PREFIX, 'wait', 'take piano'])
      expect(turns.at(-2)!.output).toContain('[POKES: *--]')
      const last = turns.at(-1)!.output
      expect(last).toContain('pokes your hand')
      expect(last).toContain('*** You have died ***')
    }, 60_000)

    it('INVENTORY at the River\'s Edge parts the crowd on that turn', async () => {
      const turns = await play([...EDGE, 'inventory'])
      expect(turns.at(-1)!.output).toContain('A lane opens')
    }, 60_000)

    it('movement before the parting goes nowhere, and does not part the crowd', async () => {
      const turns = await play([...EDGE, 'west'])
      expect(turns.at(-1)!.output).toContain('closes softly')
      expect(turns.at(-1)!.output).not.toContain('A lane opens')
    }, 60_000)

    it('a win below 60 points is still Exit Liquidity', async () => {
      const turns = await play(NO_LORE)
      const last = turns.at(-1)!.output
      expect(last).toContain('*** You have reached the bottom of the Mingus ***')
      expect(last).toMatch(/scored 50 (points )?out of a possible 60/)
      expect(last).toContain('Exit Liquidity')
      expect(last).not.toContain('Early Adopter')
      expect(last).toContain('EVERYTHING ROLLS DOWNHILL')
    }, 60_000)
  })

  describe('natural moves on the Runout', () => {
    it('LOOK UNDER CAR finds what rolled under it', async () => {
      const turns = await play([...RUNOUT_PREFIX, 'look under car'])
      expect(turns.at(-1)!.output).toContain('You drag it out: a long coat')
    }, 60_000)

    it('a bare DIG asks what to dig, and costs no turn', async () => {
      const turns = await play([...RUNOUT_PREFIX, 'dig'])
      expect(turns.at(-1)!.output).toContain('What do you want to dig?')
      expect(turns.at(-1)!.output).not.toContain('[POKES')
    }, 60_000)

    it('WAVE PIKE raises the pike, and never lowers a raised one', async () => {
      const lowered = await play([...RUNOUT_PREFIX, 'wave pike'])
      expect(lowered.at(-1)!.output).toContain('You raise the pike')
      expect(lowered.at(-1)!.output).toContain('[POKES: ---]')

      const raised = await play([...RUNOUT_PREFIX, 'raise pike', 'wave pike', 'point pike at verdlings'])
      for (const t of raised.slice(-2)) {
        expect(t.output).toContain('The pike is already raised')
        expect(t.output).not.toContain('(You lower the pike.)')
        expect(t.output).toContain('[POKES: ---]')
      }
    }, 60_000)
  })

  describe('the belted verdling understands other phrasings', () => {
    for (const cmd of ['open buckle with pin', 'put pin in pawl', 'push pin into pawl', 'press buckle with pin']) {
      it(`${cmd} frees the belt`, async () => {
        const turns = await play([...until('press pawl with pin'), cmd])
        expect(turns.at(-1)!.output).toContain("I won't need it up here")
      }, 60_000)
    }
    for (const cmd of ['pour oil', 'pour oil on buckle', 'empty can on buckle', 'put oil on buckle']) {
      it(`${cmd} oils the buckle`, async () => {
        const turns = await play([...until('oil buckle'), cmd])
        expect(turns.at(-1)!.output).toContain('hopeful creak')
      }, 60_000)
    }
  })

  it('understands the same phrasings as the other version', async () => {
    const expectLast = async (prefix: string[], cmds: string[], text: string) => {
      const turns = await play([...prefix, ...cmds])
      expectNoParserFailures(turns.slice(-cmds.length))
      expect(turns.at(-1)!.output, cmds.join(' / ')).toContain(text)
    }
    await expectLast(until('fill can'), ['fill can from pump'], 'until it is full')
    await expectLast(until('fill can'), ['fill can with oil'], 'until it is full')
    await expectLast(until('turn telescope'), ['move telescope'], 'straight down')
    await expectLast(until('turn telescope'), ['point telescope down'], 'straight down')
    await expectLast(until('turn telescope'), ['turn telescope down'], 'straight down')
    await expectLast(until('type nobody'), ['say nobody'], 'trustless value-capture')
    await expectLast(until('type they'), ['say they'], '1 OF 4')
    await expectLast(until('put notice in scanner'), ['put notice on scanner'], 'PROOF OF ADDRESS: RECEIVED')
    await expectLast(until('search transactions'), ['search drift'], 'a punch card')
    await expectLast(RUNOUT_PREFIX, ['fend verdlings'], 'You raise the pike')
    await expectLast(EDGE, ['swim'], 'No one crosses the Verdance')
    // The endorsement is a card, but CARD means the punch card.
    await expectLast(until('search transactions'), [
      'search transactions', 'take charter', 'south', 'take hard hat', 'sign charter',
      'give charter to steward', 'north', 'east', 'put card in slot',
    ], 'more efficient')
    // The mesa's notices point you to the doorbell; the doorbell always has one.
    await expectLast([], ['take notice'], 'caught on the doorbell')
    await expectLast(until('take notice'), ['take notice', 'take notice'], 'You already have one')
    await expectLast(until('take notice'), ['take notice', 'look'], 'caught on the doorbell')
  }, 120_000)

  it('understands phrasings beyond the walkthrough', async () => {
    const telescopeAt = walkthrough.indexOf('turn telescope')
    const scope = await play([...walkthrough.slice(0, telescopeAt), 'x telescopes', 'x telescope'])
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
  }, 60_000)
})

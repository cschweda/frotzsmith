/// <reference types="node" />
/**
 * Walkthrough test for the bundled longer sample, "The Architect's Legacy"
 * (samples/architect-legacy.inf). Compiles the sample with the real
 * inform6.wasm under Node, then replays the SHARED walkthrough
 * (app/modules/samples-shared/architect-legacy.walkthrough.txt — the ZIL
 * version is verified against the same file) on the headless Z-machine.
 *
 * It catches two kinds of breakage: the game no longer being winnable, and
 * walkthrough drift (a command the parser no longer understands).
 *
 * ENVIRONMENT: node (default per vitest.config.ts)
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runReplay } from './engine/replayCore'

const STD_LIB_DIR = fileURLToPath(new URL('./lib/std', import.meta.url))
const WASM_PATH = fileURLToPath(new URL('./wasm/inform6.wasm', import.meta.url))
const SAMPLE = fileURLToPath(new URL('./samples/architect-legacy.inf', import.meta.url))
const WALKTHROUGH = fileURLToPath(
  new URL('../samples-shared/architect-legacy.walkthrough.txt', import.meta.url),
)

const STD_ALIASES: Record<string, string> = {
  'Parser.h': 'parser.h',
  'VerbLib.h': 'verblib.h',
  'Grammar.h': 'grammar.h',
  'English.h': 'english.h',
  'Exits.h': 'exits.h',
}

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
  const raw = output.join('\n')
  expect(raw, 'compiler reported errors').not.toMatch(/\bError:|Fatal error/)
  expect(raw, 'compiler reported warnings').not.toMatch(/\bWarning:/)
  return m.FS.readFile('/work/story.z5')
}

const walkthrough = readFileSync(WALKTHROUGH, 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l.length > 0)

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

/** Replay `commands` and assert that none of them hit a parser failure. */
function expectNoParserFailures(turns: { command?: string; output: string }[]) {
  for (const t of turns.slice(1)) {
    for (const phrase of PARSER_FAILURES) {
      expect(t.output, `parser failure at "${t.command}":\n${t.output}`).not.toContain(phrase)
    }
  }
}

describe("The Architect's Legacy (I6 sample) — shared walkthrough", () => {
  let story: Uint8Array

  beforeAll(async () => {
    story = await compileStd(readFileSync(SAMPLE, 'utf8'))
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

    // Walkthrough drift: a command the parser no longer understands.
    expectNoParserFailures(turns)

    const last = turns.at(-1)!
    expect(last.command).toBe('read blueprint')
    expect(last.output).toContain('The work continues')
    expect(last.output).toMatch(/scored 40 out of a possible 50/)
  }, 60_000)

  it('EMPTY WASTEBASKET finds the right half, like SEARCH (both versions)', async () => {
    const at = walkthrough.indexOf('search wastebasket')
    const commands = [...walkthrough.slice(0, at), 'empty wastebasket', 'take half']
    const { turns } = await runReplay(fresh(), 'zmachine', commands)
    expectNoParserFailures(turns)
    expect(turns.at(-2)!.output).toContain('half of a torn blueprint')
  }, 60_000)

  it('CLIMB PANEL goes down the opened floor panel, like ENTER (both versions)', async () => {
    const commands = ['north', 'east', 'ring bell', 'strike chime', 'blow horn', 'climb panel']
    const { turns } = await runReplay(fresh(), 'zmachine', commands)
    expectNoParserFailures(turns)
    expect(turns.at(-1)!.output).toContain('Cellar Stairs')
  }, 60_000)

  it('a wrong brass order does not open the way to the Cellar Stairs', async () => {
    const commands = ['north', 'east', 'blow horn', 'ring bell', 'strike chime', 'down']
    const { turns } = await runReplay(fresh(), 'zmachine', commands)
    expect(turns).toHaveLength(commands.length + 1)
    expect(turns.at(-1)!.output).not.toContain('Cellar Stairs')
    // ...but the right order does.
    const right = ['north', 'east', 'ring bell', 'strike chime', 'blow horn', 'down']
    const ok = await runReplay(fresh(), 'zmachine', right)
    expect(ok.turns.at(-1)!.output).toContain('Cellar Stairs')
  }, 60_000)

  it('a wrong note mid-sequence is refused and resets the chord', async () => {
    // bell (right), horn (wrong: the chime comes second), chime (now alone).
    const commands = ['north', 'east', 'ring bell', 'blow horn', 'strike chime', 'down']
    const { turns } = await runReplay(fresh(), 'zmachine', commands)
    expect(turns).toHaveLength(commands.length + 1)
    expect(turns[4]!.output).toContain('collapses into a discord')
    expect(turns[5]!.output).toContain('It was not the note it was waiting for')
    expect(turns.at(-1)!.output).not.toContain('Cellar Stairs')
  }, 60_000)

  // Phrasings beyond the walkthrough that the sample promises to understand.
  it('understands TURN DIAL TO, PUT ... IN PEDESTAL and the stilled Shifting Room', async () => {
    const walk = (from: string, to?: string) =>
      walkthrough.slice(walkthrough.indexOf(from), to ? walkthrough.indexOf(to) : undefined)
    const commands = [
      ...walk('north', 'set dial to 8'),
      'turn dial to 8',
      ...walk('take journal', 'set dial to spiral'),
      'turn dial to spiral',
      ...walk('pull lever', 'put crystal on pedestal'),
      // Back through the Shifting Room after passing it: it has stilled.
      'south', 'wait', 'north',
      'put crystal in pedestal',
      'strike fork', 'north', 'read blueprint',
    ]
    const { turns } = await runReplay(fresh(), 'zmachine', commands)
    expectNoParserFailures(turns)
    const out = (cmd: string) => turns.find(t => t.command === cmd)!.output
    expect(out('turn dial to 8')).toContain('satisfied click')
    expect(out('turn dial to spiral')).toContain('clicks round to the spiral')
    const back = turns.findLastIndex(t => t.command === 'south')
    expect(turns[back]!.output).toContain('kept still')
    expect(turns[back + 1]!.output).toContain('the room has stilled')
    expect(turns[back + 1]!.output).not.toContain('grinding')
    expect(out('put crystal in pedestal')).toContain('on the basalt pedestal')
    expect(turns.at(-1)!.output).toContain('The work continues')
  }, 60_000)
})

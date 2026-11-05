/// <reference types="node" />
/**
 * Every bundled Inform 6 sample, compiled the way the app compiles it and
 * played through its walkthrough (app/modules/samples-shared/*.walkthrough.txt,
 * looked up with sampleWalkthrough, the registry Solutions uses).
 *
 * For each sample in SAMPLES it asserts:
 *   - the source the editor shows (formatI6'd unless `format: false`)
 *     compiles with ZERO errors and ZERO warnings, through the app's own
 *     compile path (runI6Compile) with the sample's library and target;
 *   - the walkthrough replays to its last command with no engine error;
 *   - no replayed command hits a parser failure (walkthrough drift);
 *   - the end is reached where the sample has one, and otherwise the
 *     last turn shows what the sample is there to teach.
 *
 * Bundled samples are canonical: a warning here is fixed in the sample.
 *
 * ENVIRONMENT: node (default per vitest.config.ts)
 */
import { describe, it, expect, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import { SAMPLES, loadSampleSource } from './samples'
import { PROFILES } from './profiles'
import { formatI6 } from '~/utils/format-i6'
import { sampleWalkthrough } from '~/modules/samples-shared/walkthroughs'
import { runReplay } from './engine/replayCore'

const WASM_PATH = fileURLToPath(new URL('./wasm/inform6.wasm', import.meta.url))

// The app's compile path, with the WASM read from disk instead of a Vite URL.
vi.mock('~/composables/useCompilerWasm', () => ({
  useCompilerWasm: () => ({
    createInstance: async (hooks: { print: (l: string) => void; printErr: (l: string) => void }) => {
      const mod = await import('./wasm/inform6.mjs')
      return mod.default({
        print: hooks.print,
        printErr: hooks.printErr,
        locateFile: (p: string) => (p.endsWith('.wasm') ? WASM_PATH : p),
      })
    },
  }),
}))

const { runI6Compile } = await import('./compile-main')

/** Parser failures from both libraries (std english.h Miscellany, PunyInform
 *  messages.h): a walkthrough command that hits one has drifted. */
const PARSER_FAILURES = [
  "I didn't understand that sentence.",
  'I only understood you as far as',
  "I didn't understand the way that finished.",
  "That's not a verb",
  'Which do you mean',
  'What do you want to',
  "I'm not sure what",
  "You can't see any such thing",
  "Sorry, I don't understand",
  "I don't understand",
]

/**
 * What each sample's last turn must show. `ended` samples reach their end
 * (the library prints the *** banner); the others are concept demos with no
 * end, so the check is the payoff the sample exists to show.
 */
const FINALE: Record<string, { text: string | RegExp; ended?: boolean }> = {
  'std-skeleton': { text: 'An empty room, waiting for your imagination' },
  'std-two-rooms': { text: 'brass lamp' },
  'std-dark-cellar': { text: 'rusty key' },
  'std-timed-candle': { text: 'The candle sputters out' },
  'std-hermit': { text: 'The hermit accepts the apple' },
  'std-chest': { text: 'gold coin' },
  'std-grammar': { text: 'The lamp flares brightly' },
  'std-switchable-lamp': { text: 'A cramped cellar' },
  'std-magic-8-ball': { text: 'It reveals:' },
  'std-list-exits': { text: 'Obvious exits: south' },
  'std-haunted-house': { text: 'A raging fire blocks the door to the south' },
  'std-architect-legacy': { text: 'The work continues', ended: true },
  'std-mingus-1': { text: 'You have reached the bottom of the Mingus', ended: true },
  'std-mingus-2': { text: 'You have gone further than anyone', ended: true },
  'puny-skeleton': { text: 'An empty room, waiting for your imagination' },
  'puny-two-rooms': { text: 'brass lamp' },
  'puny-dark-cellar': { text: 'rusty key' },
  'puny-timed-candle': { text: 'The candle sputters out' },
  'puny-hermit': { text: 'The hermit accepts the apple' },
  'puny-chest': { text: 'gold coin' },
  'puny-grammar': { text: 'The lamp flares brightly' },
  'puny-switchable-lamp': { text: 'A cramped cellar' },
  'puny-magic-8-ball': { text: 'It reveals:' },
  'puny-haunted-house': { text: 'A raging fire blocks the door to the south' },
}

/** Compile a sample exactly as the editor shows it; returns the story bytes. */
async function compileSample(id: string): Promise<Uint8Array> {
  const s = SAMPLES.find(x => x.id === id)!
  const raw = (await loadSampleSource(id))!
  const source = s.format === false ? raw : formatI6(raw)
  const result = await runI6Compile(source, { profileId: s.group, ext: s.target ?? PROFILES[s.group].defaultExt })
  expect(result.ok, `${id} compile`).toBe(true)
  return result.storyFile!
}

describe('Haunted House: the knife is only deadly while it floats (both libraries)', () => {
  for (const id of ['std-haunted-house', 'puny-haunted-house']) {
    it(`${id}: examining the floating knife kills; examining the held knife does not`, async () => {
      const story = await compileSample(id)
      const floating = await runReplay(story.slice(), 'zmachine', ['plugh', 'east', 'examine knife'])
      expect(floating.turns.at(-1)!.output).toContain('slits your throat')

      const held = ['plugh', 'east', 'take scroll', 'take knife', 'examine knife', 'push knife', 'take knife', 'west', 'examine knife']
      const { turns } = await runReplay(story.slice(), 'zmachine', held)
      expect(turns).toHaveLength(held.length + 1)
      for (const t of turns) expect(t.output, `"${t.command}"`).not.toContain('slits your throat')
      // TAKE on the knife you hold is the library's "already have it", not "out of reach".
      expect(turns[7]!.output).not.toContain('just out of your reach')
    }, 60_000)

    it(`${id}: a knife dropped outside the Living Room can be taken again, and still gets past the armour`, async () => {
      const story = await compileSample(id)
      const cmds = ['plugh', 'east', 'take scroll', 'take knife', 'west', 'drop knife', 'take knife', 'south', 'east', 'south']
      const { turns } = await runReplay(story.slice(), 'zmachine', cmds)
      expect(turns).toHaveLength(cmds.length + 1)
      for (const t of turns) expect(t.output, `"${t.command}"`).not.toContain('slits your throat')
      // turns[0] is the opening; turns[i] answers cmds[i - 1].
      expect(turns[6]!.output, 'drop knife in the Foyer').not.toContain('levitates')
      expect(turns[7]!.output, 'take knife again').not.toContain('just out of your reach')
      expect(turns[7]!.output, 'take knife again').toMatch(/Taken/i)
      expect(turns[10]!.output, 'south past the armour').toContain('flees')
      expect(turns[10]!.output, 'south past the armour').toContain('Breakfast')
    }, 60_000)

    it(`${id}: XYZZY works only in the first room, and plain and SAY forms agree`, async () => {
      const story = await compileSample(id)
      for (const word of ['xyzzy', 'say xyzzy']) {
        const first = await runReplay(story.slice(), 'zmachine', [word])
        expect(first.turns.at(-1)!.output, `${word} outside`).toContain('The Foyer')
        expect(first.turns.at(-1)!.output, `${word} outside`).toContain('score has')
        // Elsewhere (in by PLUGH, then the Living Room): nothing happens.
        const later = await runReplay(story.slice(), 'zmachine', ['plugh', 'east', word])
        expect(later.turns.at(-1)!.output.trim(), `${word} inside`).toBe('Nice try.')
      }
    }, 60_000)

    it(`${id}: the cheat commands GO <unvisited room> and ZAP <room> jump straight there`, async () => {
      const story = await compileSample(id)
      const { turns } = await runReplay(story.slice(), 'zmachine', ['plugh', 'go kitchen', 'zap foyer', 'zap master'])
      expect(turns[2]!.output).toContain('The Kitchen')
      expect(turns[3]!.output).toContain('The Foyer')
      expect(turns[4]!.output).toContain('Master Bedroom')
    }, 60_000)
  }
})

describe('every bundled Inform 6 sample compiles cleanly and plays its walkthrough', () => {
  it('every sample has a walkthrough and a finale check', () => {
    for (const s of SAMPLES) {
      expect(sampleWalkthrough(s.id), `walkthrough for ${s.id}`).not.toBeNull()
      expect(FINALE[s.id], `finale for ${s.id}`).toBeDefined()
    }
  })

  for (const s of SAMPLES) {
    it(`${s.id}: zero errors, zero warnings, walkthrough plays to the end`, async () => {
      const raw = await loadSampleSource(s.id)
      expect(raw, `body for ${s.id}`).not.toBeNull()
      // The source exactly as the editor shows it after Load sample.
      const source = s.format === false ? raw! : formatI6(raw!)
      const ext = s.target ?? PROFILES[s.group].defaultExt
      const result = await runI6Compile(source, { profileId: s.group, ext })
      const problems = result.diagnostics.map(d => `${d.severity} line ${d.line ?? '?'}: ${d.message}`)
      expect(problems, `${s.id} diagnostics`).toEqual([])
      expect(result.ok, `${s.id} compile\n${result.rawStderr}`).toBe(true)

      const commands = sampleWalkthrough(s.id)!
      const { turns } = await runReplay(result.storyFile!.slice(), 'zmachine', commands)
      // Every command was played: the game did not end or stop early.
      expect(turns, `${s.id} played every command`).toHaveLength(commands.length + 1)
      for (const t of turns.slice(1)) {
        for (const phrase of PARSER_FAILURES) {
          expect(t.output, `${s.id}: parser failure at "${t.command}":\n${t.output}`).not.toContain(phrase)
        }
      }
      const last = turns.at(-1)!.output
      const finale = FINALE[s.id]!
      if (typeof finale.text === 'string') expect(last, `${s.id} last turn`).toContain(finale.text)
      else expect(last, `${s.id} last turn`).toMatch(finale.text)
      if (finale.ended) expect(last, `${s.id} reaches its end`).toMatch(/\*\*\* .+ \*\*\*/)
      else expect(last, `${s.id} is not ended`).not.toMatch(/You have died/)
    }, 60_000)
  }
})

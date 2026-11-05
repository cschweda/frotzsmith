/**
 * Sample walkthroughs: the commands, one per line, that a sample's solution
 * is made from (Solutions: compile the sample, replay these). Keyed by sample
 * id; a sample written in both languages shares one walkthrough file.
 *
 * Every bundled sample has one, named after the sample's file stem (the ZIL
 * concept samples with a zil- prefix, so they never collide with an I6 stem). A
 * walkthrough is the shortest command list that shows the sample off,
 * winning where the sample can be won. The golden tests
 * (inform6/sample-walkthroughs.golden.test.ts, zil/sample-walkthroughs.golden.test.ts)
 * replay each one against the compiled sample.
 */
// The longer games: one walkthrough shared by the Inform 6 and ZIL versions.
import architectLegacy from './architect-legacy.walkthrough.txt?raw'
import mingus1 from './mingus-1.walkthrough.txt?raw'
import mingus2 from './mingus-2.walkthrough.txt?raw'
// Inform 6, Standard Library.
import stdSkeleton from './std-skeleton.walkthrough.txt?raw'
import demo from './demo.walkthrough.txt?raw'
import darkCellar from './dark-cellar.walkthrough.txt?raw'
import timedCandle from './timed-candle.walkthrough.txt?raw'
import hermit from './hermit.walkthrough.txt?raw'
import lockedChest from './locked-chest.walkthrough.txt?raw'
import grammar from './grammar.walkthrough.txt?raw'
import switchableLamp from './switchable-lamp.walkthrough.txt?raw'
import magic8Ball from './magic-8-ball.walkthrough.txt?raw'
import listExits from './list-exits.walkthrough.txt?raw'
import hauntedHouse from './haunted-house.walkthrough.txt?raw'
// Inform 6, PunyInform.
import punySkeleton from './puny-skeleton.walkthrough.txt?raw'
import punyTwoRooms from './puny-two-rooms.walkthrough.txt?raw'
import punyDarkCellar from './puny-dark-cellar.walkthrough.txt?raw'
import punyTimedCandle from './puny-timed-candle.walkthrough.txt?raw'
import punyHermit from './puny-hermit.walkthrough.txt?raw'
import punyLockedChest from './puny-locked-chest.walkthrough.txt?raw'
import punyGrammar from './puny-grammar.walkthrough.txt?raw'
import punySwitchableLamp from './puny-switchable-lamp.walkthrough.txt?raw'
import punyMagic8Ball from './puny-magic-8-ball.walkthrough.txt?raw'
import punyHauntedHouse from './puny-haunted-house.walkthrough.txt?raw'
// ZIL.
import zilSkeleton from './zil-skeleton.walkthrough.txt?raw'
import zilCloak from './zil-cloak.walkthrough.txt?raw'
import zilTwoRooms from './zil-two-rooms.walkthrough.txt?raw'
import zilNpc from './zil-npc.walkthrough.txt?raw'
import zilPuzzle from './zil-puzzle.walkthrough.txt?raw'
import zilLight from './zil-light.walkthrough.txt?raw'
import zilDaemon from './zil-daemon.walkthrough.txt?raw'

/** Null-prototype, so an id like "constructor" is never found by accident. */
const WALKTHROUGHS: Record<string, string> = Object.assign(Object.create(null) as Record<string, string>, {
  'std-architect-legacy': architectLegacy,
  'zil-architect-legacy': architectLegacy,
  'std-mingus-1': mingus1,
  'zil-mingus-1': mingus1,
  'std-mingus-2': mingus2,

  'std-skeleton': stdSkeleton,
  'std-two-rooms': demo,
  'std-dark-cellar': darkCellar,
  'std-timed-candle': timedCandle,
  'std-hermit': hermit,
  'std-chest': lockedChest,
  'std-grammar': grammar,
  'std-switchable-lamp': switchableLamp,
  'std-magic-8-ball': magic8Ball,
  'std-list-exits': listExits,
  'std-haunted-house': hauntedHouse,

  'puny-skeleton': punySkeleton,
  'puny-two-rooms': punyTwoRooms,
  'puny-dark-cellar': punyDarkCellar,
  'puny-timed-candle': punyTimedCandle,
  'puny-hermit': punyHermit,
  'puny-chest': punyLockedChest,
  'puny-grammar': punyGrammar,
  'puny-switchable-lamp': punySwitchableLamp,
  'puny-magic-8-ball': punyMagic8Ball,
  'puny-haunted-house': punyHauntedHouse,

  'zil-skeleton': zilSkeleton,
  'zil-cloak': zilCloak,
  'zil-two-rooms': zilTwoRooms,
  'zil-npc': zilNpc,
  'zil-puzzle': zilPuzzle,
  'zil-light': zilLight,
  'zil-daemon': zilDaemon,
})

/** A walkthrough file's commands: each line trimmed, blank lines skipped. */
function walkthroughCommands(text: string): string[] {
  return text.split(/\r\n|\r|\n/).map(l => l.trim()).filter(l => l.length > 0)
}

/** The sample's walkthrough commands (a fresh copy), or null when it has none. */
export function sampleWalkthrough(sampleId: string): string[] | null {
  if (!Object.hasOwn(WALKTHROUGHS, sampleId)) return null
  return walkthroughCommands(WALKTHROUGHS[sampleId]!)
}

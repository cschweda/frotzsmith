import type { ProfileId } from './profiles'
import type { StoryExt } from './types'
import stdSkeleton from './samples/std-skeleton.inf?raw'
import stdTwoRooms from './samples/demo.inf?raw'
import stdHermit from './samples/hermit.inf?raw'
import stdChest from './samples/locked-chest.inf?raw'
import punySkeleton from './samples/puny-skeleton.inf?raw'
import punyTwoRooms from './samples/puny-two-rooms.inf?raw'
import punyHermit from './samples/puny-hermit.inf?raw'
import punyChest from './samples/puny-locked-chest.inf?raw'
import stdGrammar from './samples/grammar.inf?raw'
import punyGrammar from './samples/puny-grammar.inf?raw'
import stdCellar from './samples/dark-cellar.inf?raw'
import punyCellar from './samples/puny-dark-cellar.inf?raw'
import stdCandle from './samples/timed-candle.inf?raw'
import punyCandle from './samples/puny-timed-candle.inf?raw'
import stdHaunted from './samples/haunted-house.inf?raw'
import punyHaunted from './samples/puny-haunted-house.inf?raw'
import stdLamp from './samples/switchable-lamp.inf?raw'
import punyLamp from './samples/puny-switchable-lamp.inf?raw'
import stdBall from './samples/magic-8-ball.inf?raw'
import punyBall from './samples/puny-magic-8-ball.inf?raw'
import stdExits from './samples/list-exits.inf?raw'

export interface Sample {
  id: string
  name: string
  description: string
  /** Which library the sample is written for (also its dropdown group). */
  group: ProfileId
  /** Preferred story-file version, auto-selected when the sample loads. */
  target?: StoryExt
  source: string
}

/**
 * The built-in sample library. Each concept exists in both an Inform 6 Standard
 * Library version and a PunyInform version, so authors can compare them. Every
 * sample is verified to compile cleanly.
 */
export const SAMPLES: Sample[] = [
  { id: 'std-skeleton', group: 'std', name: 'Skeleton', description: 'Bare, compilable starting point', source: stdSkeleton },
  { id: 'std-two-rooms', group: 'std', name: 'Two Rooms', description: 'Rooms, movement, a takeable object', source: stdTwoRooms },
  { id: 'std-dark-cellar', group: 'std', name: 'The Dark Cellar · light', description: 'Darkness and carrying a light source', source: stdCellar },
  { id: 'std-timed-candle', group: 'std', name: 'Timed Candle · daemons', description: 'Run an event every turn (a burning candle)', source: stdCandle },
  { id: 'std-hermit', group: 'std', name: 'The Hermit · NPC', description: 'A talking NPC (ask / tell / give)', source: stdHermit },
  { id: 'std-chest', group: 'std', name: 'The Locked Chest · puzzle', description: 'A lock-and-key container puzzle', source: stdChest },
  { id: 'std-grammar', group: 'std', name: 'Custom Grammar · verbs', description: 'Add your own verbs and grammar lines', source: stdGrammar },
  { id: 'std-switchable-lamp', group: 'std', name: 'Switchable Lamp · device', description: 'A switchable device and a carried light source', source: stdLamp },
  { id: 'std-magic-8-ball', group: 'std', name: 'Magic 8-Ball · random', description: 'A custom verb and random() for varied output', source: stdBall },
  { id: 'std-list-exits', group: 'std', name: 'List Exits · compass', description: 'A std-only EXITS verb (Compass + LanguageDirection)', source: stdExits },
  { id: 'std-haunted-house', group: 'std', name: 'Haunted House · first floor', description: "The first floor of a port of Radio Shack's 1979 adventure", source: stdHaunted },
  { id: 'puny-skeleton', group: 'puny', name: 'Skeleton', description: 'Bare, compilable starting point', source: punySkeleton },
  { id: 'puny-two-rooms', group: 'puny', name: 'Two Rooms', description: 'Rooms, movement, a takeable object', source: punyTwoRooms },
  { id: 'puny-dark-cellar', group: 'puny', name: 'The Dark Cellar · light', description: 'Darkness and carrying a light source', source: punyCellar },
  { id: 'puny-timed-candle', group: 'puny', name: 'Timed Candle · daemons', description: 'Run an event every turn (a burning candle)', source: punyCandle },
  { id: 'puny-hermit', group: 'puny', name: 'The Hermit · NPC', description: 'A talking NPC (ask / tell / give)', source: punyHermit },
  { id: 'puny-chest', group: 'puny', name: 'The Locked Chest · puzzle', description: 'A lock-and-key container puzzle', source: punyChest },
  { id: 'puny-grammar', group: 'puny', name: 'Custom Grammar · verbs', description: 'Add your own verbs and grammar lines', source: punyGrammar },
  { id: 'puny-switchable-lamp', group: 'puny', name: 'Switchable Lamp · device', description: 'A switchable device and a carried light source', source: punyLamp },
  { id: 'puny-magic-8-ball', group: 'puny', name: 'Magic 8-Ball · random', description: 'A custom verb and random() for varied output', source: punyBall },
  { id: 'puny-haunted-house', group: 'puny', name: 'Haunted House · first floor', description: "The first floor of a port of Radio Shack's 1979 adventure", target: 'z3', source: punyHaunted },
]

export function sampleById(id: string): Sample | undefined {
  return SAMPLES.find(s => s.id === id)
}

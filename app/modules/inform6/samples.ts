import type { ProfileId } from './profiles'
import stdSkeleton from './samples/std-skeleton.inf?raw'
import stdTwoRooms from './samples/demo.inf?raw'
import stdHermit from './samples/hermit.inf?raw'
import stdChest from './samples/locked-chest.inf?raw'
import punySkeleton from './samples/puny-skeleton.inf?raw'
import punyTwoRooms from './samples/puny-two-rooms.inf?raw'
import punyHermit from './samples/puny-hermit.inf?raw'
import punyChest from './samples/puny-locked-chest.inf?raw'

export interface Sample {
  id: string
  name: string
  description: string
  /** Which library the sample is written for (also its dropdown group). */
  group: ProfileId
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
  { id: 'std-hermit', group: 'std', name: 'The Hermit · NPC', description: 'A talking NPC (ask / tell / give)', source: stdHermit },
  { id: 'std-chest', group: 'std', name: 'The Locked Chest · puzzle', description: 'A lock-and-key container puzzle', source: stdChest },
  { id: 'puny-skeleton', group: 'puny', name: 'Skeleton', description: 'Bare, compilable starting point', source: punySkeleton },
  { id: 'puny-two-rooms', group: 'puny', name: 'Two Rooms', description: 'Rooms, movement, a takeable object', source: punyTwoRooms },
  { id: 'puny-hermit', group: 'puny', name: 'The Hermit · NPC', description: 'A talking NPC (ask / tell / give)', source: punyHermit },
  { id: 'puny-chest', group: 'puny', name: 'The Locked Chest · puzzle', description: 'A lock-and-key container puzzle', source: punyChest },
]

export function sampleById(id: string): Sample | undefined {
  return SAMPLES.find(s => s.id === id)
}

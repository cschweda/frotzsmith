import type { ProfileId } from './profiles'
import type { StoryExt } from './types'

export interface Sample {
  id: string
  name: string
  description: string
  /** Which library the sample is written for (also its dropdown group). */
  group: ProfileId
  /** Preferred story-file version, auto-selected when the sample loads. */
  target?: StoryExt
  /** Body filename under ./samples/ — loaded on demand via loadSampleSource(). */
  file: string
}

/**
 * Lazy per-sample bodies: each .inf becomes its own tiny chunk, fetched only
 * when that sample is picked. The old eager imports put ~220 KB of sample
 * text into the critical-path chunk of BOTH pages. Metadata below stays
 * eager so the picker renders instantly. (samples.test.ts loads every body
 * to keep the `file:` fields in sync with the real files.)
 */
const bodies = import.meta.glob('./samples/*.inf', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

/**
 * The built-in sample library. Each concept exists in both an Inform 6 Standard
 * Library version and a PunyInform version, so authors can compare them. Every
 * sample is verified to compile cleanly.
 */
export const SAMPLES: Sample[] = [
  { id: 'std-skeleton', group: 'std', name: 'Skeleton', description: 'Bare, compilable starting point', file: 'std-skeleton.inf' },
  { id: 'std-two-rooms', group: 'std', name: 'Two Rooms', description: 'Rooms, movement, a takeable object', file: 'demo.inf' },
  { id: 'std-dark-cellar', group: 'std', name: 'The Dark Cellar · light', description: 'Darkness and carrying a light source', file: 'dark-cellar.inf' },
  { id: 'std-timed-candle', group: 'std', name: 'Timed Candle · daemons', description: 'Run an event every turn (a burning candle)', file: 'timed-candle.inf' },
  { id: 'std-hermit', group: 'std', name: 'The Hermit · NPC', description: 'A talking NPC (ask / tell / give)', file: 'hermit.inf' },
  { id: 'std-chest', group: 'std', name: 'The Locked Chest · puzzle', description: 'A lock-and-key container puzzle', file: 'locked-chest.inf' },
  { id: 'std-grammar', group: 'std', name: 'Custom Grammar · verbs', description: 'Add your own verbs and grammar lines', file: 'grammar.inf' },
  { id: 'std-switchable-lamp', group: 'std', name: 'Switchable Lamp · device', description: 'A switchable device and a carried light source', file: 'switchable-lamp.inf' },
  { id: 'std-magic-8-ball', group: 'std', name: 'Magic 8-Ball · random', description: 'A custom verb and random() for varied output', file: 'magic-8-ball.inf' },
  { id: 'std-list-exits', group: 'std', name: 'List Exits · compass', description: 'A std-only EXITS verb (Compass + LanguageDirection)', file: 'list-exits.inf' },
  { id: 'std-haunted-house', group: 'std', name: 'Haunted House · first floor', description: "The first floor of a port of Radio Shack's 1979 adventure", file: 'haunted-house.inf' },
  { id: 'puny-skeleton', group: 'puny', name: 'Skeleton', description: 'Bare, compilable starting point', file: 'puny-skeleton.inf' },
  { id: 'puny-two-rooms', group: 'puny', name: 'Two Rooms', description: 'Rooms, movement, a takeable object', file: 'puny-two-rooms.inf' },
  { id: 'puny-dark-cellar', group: 'puny', name: 'The Dark Cellar · light', description: 'Darkness and carrying a light source', file: 'puny-dark-cellar.inf' },
  { id: 'puny-timed-candle', group: 'puny', name: 'Timed Candle · daemons', description: 'Run an event every turn (a burning candle)', file: 'puny-timed-candle.inf' },
  { id: 'puny-hermit', group: 'puny', name: 'The Hermit · NPC', description: 'A talking NPC (ask / tell / give)', file: 'puny-hermit.inf' },
  { id: 'puny-chest', group: 'puny', name: 'The Locked Chest · puzzle', description: 'A lock-and-key container puzzle', file: 'puny-locked-chest.inf' },
  { id: 'puny-grammar', group: 'puny', name: 'Custom Grammar · verbs', description: 'Add your own verbs and grammar lines', file: 'puny-grammar.inf' },
  { id: 'puny-switchable-lamp', group: 'puny', name: 'Switchable Lamp · device', description: 'A switchable device and a carried light source', file: 'puny-switchable-lamp.inf' },
  { id: 'puny-magic-8-ball', group: 'puny', name: 'Magic 8-Ball · random', description: 'A custom verb and random() for varied output', file: 'puny-magic-8-ball.inf' },
  { id: 'puny-haunted-house', group: 'puny', name: 'Haunted House · first floor', description: "The first floor of a port of Radio Shack's 1979 adventure", target: 'z3', file: 'puny-haunted-house.inf' },
]

export function sampleById(id: string): Sample | undefined {
  return SAMPLES.find(s => s.id === id)
}

/** Load a sample's body (its own lazy chunk). Resolves null for unknown ids. */
export async function loadSampleSource(id: string): Promise<string | null> {
  const s = sampleById(id)
  const load = s && bodies[`./samples/${s.file}`]
  return load ? load() : null
}

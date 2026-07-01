/**
 * ZIL sample set — concept demos for the Frotzsmith ZIL IDE.
 *
 * Mirrors the shape of app/modules/inform6/samples.ts (same field names:
 * id, name, description, target, source) so Task 10's ZIL_PROFILE can
 * consume it identically to the I6 samples.
 *
 * Provenance of adapted samples:
 *   Source: ZILF project sample/ and zillib/tests/ directories,
 *   revision 5262550, licensed under GPLv3.
 *   Files: sample/cloak/cloak.zil (Cloak of Darkness, converted by
 *   Tara McGrew, Jayson Smith, and Josh Lawrence), sample/empty/empty.zil
 *   (skeleton basis), zillib/tests/test-light.zil (light demo basis).
 *   Hand-written samples: two-rooms, npc, puzzle, daemon.
 */

import type { StoryExt } from '~/modules/languages/types'

import skeletonSrc from './samples/skeleton.zil?raw'
import cloakSrc from './samples/cloak.zil?raw'
import twoRoomsSrc from './samples/two-rooms.zil?raw'
import npcSrc from './samples/npc.zil?raw'
import puzzleSrc from './samples/puzzle.zil?raw'
import lightSrc from './samples/light.zil?raw'
import daemonSrc from './samples/daemon.zil?raw'

/** A single ZIL sample in the Frotzsmith sample library. */
export interface ZilSample {
  /** Stable identifier used for URL params and persistence. */
  id: string
  /** Human-readable name shown in the sample picker. */
  name: string
  /** Short description of the concept demonstrated. */
  description: string
  /**
   * Preferred Z-machine version to compile to when this sample is loaded.
   * All ZIL samples target z3 (VERSION ZIP) — the compact Zork format.
   */
  target: StoryExt
  /** Raw ZIL source text (imported with ?raw). */
  source: string
}

/**
 * The full ZIL sample set: one sample per concept, all compiling cleanly
 * against the committed ZILF bundle (public/zilf/_framework).
 * Every sample targets z3 (<VERSION ZIP>) — the standard for single-file
 * zillib games.
 */
export const ZIL_SAMPLES: ZilSample[] = [
  {
    id: 'zil-skeleton',
    name: 'Skeleton',
    description: 'Bare, compilable starting point — West of House style',
    target: 'z3',
    source: skeletonSrc,
  },
  {
    id: 'zil-cloak',
    name: 'Cloak of Darkness',
    description: 'The canonical IF demo: cloak, foyer, dark bar, scrawled message',
    target: 'z3',
    source: cloakSrc,
  },
  {
    id: 'zil-two-rooms',
    name: 'Two Rooms',
    description: 'Rooms, directional exits, and a takeable object',
    target: 'z3',
    source: twoRoomsSrc,
  },
  {
    id: 'zil-npc',
    name: 'The Hermit · NPC',
    description: 'A talking NPC with PERSONBIT and canned responses',
    target: 'z3',
    source: npcSrc,
  },
  {
    id: 'zil-puzzle',
    name: 'The Locked Chest · puzzle',
    description: 'A lock-and-key container puzzle (OPENABLEBIT, LOCKEDBIT, TOOLBIT)',
    target: 'z3',
    source: puzzleSrc,
  },
  {
    id: 'zil-light',
    name: 'The Dark Cellar · light',
    description: 'Darkness and a switchable lantern (DEVICEBIT, NOW-LIT?, NOW-DARK?)',
    target: 'z3',
    source: lightSrc,
  },
  {
    id: 'zil-daemon',
    name: 'The Burning Candle · daemon',
    description: 'A per-turn timed event using QUEUE from zillib/events.zil',
    target: 'z3',
    source: daemonSrc,
  },
]

/** Look up a sample by its stable id. Returns undefined if not found. */
export function sampleById(id: string): ZilSample | undefined {
  return ZIL_SAMPLES.find((s) => s.id === id)
}

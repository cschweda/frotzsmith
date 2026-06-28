import type { ProfileId } from './profiles'
import ordinals from './extensions/ordinals.h?raw'

/**
 * An Inform 6 extension: a `.h` file the author can mount into a compile and
 * then `Include`. Extensions are either bundled (a small curated catalog) or
 * uploaded by the author (drop a `.h`, or a `.zip` of `.h` files).
 */
export interface Extension {
  id: string
  /** The Include name without `.h` — `Include "<name>";`. */
  name: string
  /** Human-facing label (the original filename for uploads). */
  title: string
  description: string
  /** Which library it suits; `'any'` works in both. */
  library: ProfileId | 'any'
  content: string
  origin: 'bundled' | 'uploaded'
}

/** A small curated catalog. Each entry is self-contained and compiles cleanly. */
export const BUNDLED_EXTENSIONS: Extension[] = [
  {
    id: 'bundled:ordinals',
    name: 'ordinals',
    title: 'Ordinals',
    description: 'PrintOrdinal(n) prints 1st, 2nd, 3rd… Works in both libraries.',
    library: 'any',
    content: ordinals,
    origin: 'bundled',
  },
]

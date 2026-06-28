import type { StoryExt } from './types'
import stdStarter from './samples/demo.inf?raw'
import punyStarter from './samples/puny-minimal.inf?raw'

/** A file to mount in the compiler's virtual filesystem. */
export interface VirtualFile {
  path: string
  content: string
}

export type ProfileId = 'std' | 'puny'

/**
 * A library profile bundles everything that differs between Inform 6 dialects:
 * the include set, the default story version, and the starter template. The
 * compiler, editor, and UI only ever talk about the *active profile*.
 */
export interface LibraryProfile {
  id: ProfileId
  label: string
  shortLabel: string
  description: string
  /** MEMFS include path, e.g. `/lib/std`. */
  includePath: string
  /** Default story-file version for this profile. */
  defaultExt: StoryExt
  /** A minimal game that compiles cleanly under this profile. */
  starter: string
  /** Library files (with any case aliases) ready to mount. */
  files: VirtualFile[]
}

const stdRaw = import.meta.glob('./lib/std/*.h', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const punyRaw = import.meta.glob('./lib/puny/*.h', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * Builds the virtual file list for a library directory, adding capitalized
 * aliases where the library's own includes are mixed-case (the WASM filesystem
 * is case-sensitive).
 */
function buildFiles(
  raw: Record<string, string>,
  includePath: string,
  aliases: Record<string, string> = {},
): VirtualFile[] {
  const byName: Record<string, string> = {}
  const files: VirtualFile[] = []
  for (const [path, content] of Object.entries(raw)) {
    const name = path.split('/').pop() as string
    byName[name] = content
    files.push({ path: `${includePath}/${name}`, content })
  }
  for (const [alias, real] of Object.entries(aliases)) {
    if (byName[real]) files.push({ path: `${includePath}/${alias}`, content: byName[real] })
  }
  return files
}

export const PROFILES: Record<ProfileId, LibraryProfile> = {
  std: {
    id: 'std',
    label: 'Inform 6 Standard Library',
    shortLabel: 'Standard Library',
    description: 'The classic Inform 6 library — Parser, VerbLib, Grammar.',
    includePath: '/lib/std',
    defaultExt: 'z8',
    starter: stdStarter,
    files: buildFiles(stdRaw, '/lib/std', {
      'Parser.h': 'parser.h',
      'VerbLib.h': 'verblib.h',
      'Grammar.h': 'grammar.h',
      'English.h': 'english.h',
    }),
  },
  puny: {
    id: 'puny',
    label: 'PunyInform',
    shortLabel: 'PunyInform',
    description: 'A fast, compact replacement library for small Z-machine games.',
    includePath: '/lib/puny',
    defaultExt: 'z5',
    starter: punyStarter,
    files: buildFiles(punyRaw, '/lib/puny'),
  },
}

export const DEFAULT_PROFILE: ProfileId = 'std'

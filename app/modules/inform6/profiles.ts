import type { StoryExt } from './types'
import stdStarter from './samples/std-skeleton.inf?raw'
import punyStarter from './samples/puny-skeleton.inf?raw'

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
  /** Story-file versions (compile targets) that make sense for this library. */
  targets: StoryExt[]
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
    defaultExt: 'z5',
    targets: ['z5', 'z8'],
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
    targets: ['z3', 'z4', 'z5', 'z8'],
    starter: punyStarter,
    files: buildFiles(punyRaw, '/lib/puny'),
  },
}

export const DEFAULT_PROFILE: ProfileId = 'std'

/**
 * Strip Inform 6 comments so detection runs on code only. Removes every
 * !-initiated comment — full-line, `!%` option lines, and end-of-line — while
 * honouring "string" and 'char' literals (so a ! inside quotes is left alone).
 * Without this, a teaching comment that mentions the *other* library's includes
 * (e.g. a "Standard Library vs PunyInform" note) would mis-trigger detection.
 */
function stripI6Comments(source: string): string {
  let out = ''
  for (const line of source.split('\n')) {
    let inStr = false
    let inChar = false
    let cut = line.length
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (inStr) {
        if (c === '"') inStr = false
      } else if (inChar) {
        if (c === "'") inChar = false
      } else if (c === '"') {
        inStr = true
      } else if (c === "'") {
        inChar = true
      } else if (c === '!') {
        cut = i
        break
      }
    }
    out += line.slice(0, cut) + '\n'
  }
  return out
}

/**
 * Fuzzily detect which library a source targets so the compiler can choose the
 * right approach automatically. PunyInform sources pull in puny.h / globals.h
 * and use its config constants; Standard Library sources include Parser /
 * VerbLib / Grammar. Detection ignores comments (see stripI6Comments) so prose
 * mentioning the other library can't skew it. Defaults to Standard Library.
 */
export function detectProfile(source: string): ProfileId {
  const code = stripI6Comments(source)
  if (/\bInclude\s+"(puny|globals)\.h"/i.test(code)) return 'puny'
  if (/\$OMIT_UNUSED_ROUTINES|\$ZCODE_|\bINITIAL_LOCATION_VALUE\b|\bOPTIONAL_[A-Z]/.test(code)) return 'puny'
  if (/\bInclude\s+"(Parser|VerbLib|Grammar)"/i.test(code)) return 'std'
  return 'std'
}

/** Build a fresh skeleton for a new project, filling in the title and author. */
export function buildSkeleton(profile: ProfileId, title: string, author: string): string {
  const t = (title.trim() || 'My Game').replace(/"/g, '').toUpperCase()
  const a = (author.trim() || 'Anonymous').replace(/"/g, '')
  return PROFILES[profile].starter
    .replace(/Constant Story\s+"[^"]*"/, `Constant Story "${t}"`)
    .replace(/Constant Headline\s+"[^"]*"/, `Constant Headline "^An interactive fiction by ${a}.^"`)
}

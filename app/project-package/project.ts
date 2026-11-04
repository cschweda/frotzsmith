/**
 * Mapping between a project snapshot and a `.frotzsmith` package (spec §3-§7).
 * Pure: no Vue, no DOM. `readProjectPackage` takes UNTRUSTED bytes and only
 * ever loads text; nothing is compiled, played, or run.
 */
import { isValidTree, type SkeinTree } from '../composables/skein-tree'
import { slugify } from '../utils/slug'
import { LIMITS, MIMETYPE, readContainer, writeContainer } from './container'
import { PackageError, displayPath } from './errors'
import {
  FORMAT, MANIFEST_MAX_BYTES, MANIFEST_NAME, VERSION, parseManifest, serializeManifest, setOwn, sha256,
  type Language, type Library, type Target,
} from './manifest'
import { pathKey } from './paths'

export interface ProjectSnapshot {
  language: Language
  main: { name: string; text: string }
  includes: { path: string; text: string }[]
  extensions: string[]
  tests: { name: string; text: string }[]
  skein: SkeinTree | null
  settings: { target: Target; library?: Library }
  title?: string
  opaque: { path: string; bytes: Uint8Array }[]
  manifestExtra: Record<string, unknown>
  created?: string
}

const COMPILED = /\.(z3|z4|z5|z8|ulx|blb|zblorb)$/i
const MiB = 1024 * 1024
const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

const tooBig = (why = 'the limit is 32 MB') =>
  new PackageError('too-large', `This project is too large to save as a package (${why}).`)

function stemOf(path: string): string {
  const dot = path.lastIndexOf('.')
  return dot > path.lastIndexOf('/') ? path.slice(0, dot) : path
}

function checkText(path: string, text: string): void {
  if (text.includes('\u0000')) {
    throw new PackageError('nul-in-text', `Frotzsmith can’t save ${displayPath(path)}: it contains a NUL character.`)
  }
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export async function writeProjectPackage(
  p: ProjectSnapshot,
  o: { generator: string; now: Date },
): Promise<Uint8Array> {
  const mainExt = p.language === 'i6' ? '.inf' : '.zil'
  if (!p.main.name.toLowerCase().endsWith(mainExt)) {
    throw new PackageError('bad-main', `The main file of ${p.language === 'i6' ? 'an Inform 6' : 'a ZIL'} project must end ${mainExt}.`)
  }

  const entries: { path: string; bytes: Uint8Array }[] = []
  const used = new Set<string>([pathKey(MANIFEST_NAME), pathKey('mimetype')])
  const add = (path: string, bytes: Uint8Array) => {
    entries.push({ path, bytes })
    used.add(pathKey(path))
  }

  checkText(p.main.name, p.main.text)
  add(p.main.name, encoder.encode(p.main.text))
  for (const inc of p.includes) {
    checkText(inc.path, inc.text)
    add(inc.path, encoder.encode(inc.text))
  }

  let skeinPath: string | undefined
  if (p.skein) {
    skeinPath = `${stemOf(p.main.name)}.skein`
    const storyKey = slugify(p.title ?? '') || 'untitled'
    add(skeinPath, encoder.encode(JSON.stringify({ v: 1, lang: p.language, storyKey, tree: p.skein })))
  }

  const keptOpaque = p.opaque.filter(f => !COMPILED.test(f.path))
  for (const f of keptOpaque) add(f.path, f.bytes)

  // Tests last, so a generated name steps around any file already present.
  const tests: { name: string; path: string }[] = []
  for (const t of p.tests) {
    const slug = slugify(t.name) || 'script'
    let path = `tests/${slug}.txt`
    for (let n = 2; used.has(pathKey(path)); n++) path = `tests/${slug}-${n}.txt`
    checkText(path, t.text)
    add(path, encoder.encode(t.text))
    tests.push({ name: t.name, path })
  }

  const files: Record<string, string> = {}
  for (const e of entries) setOwn(files, e.path, await sha256(e.bytes))

  const now = o.now.toISOString()
  const manifest = serializeManifest({
    format: FORMAT,
    version: VERSION,
    generator: o.generator,
    created: p.created ?? now,
    modified: now,
    title: p.title,
    language: p.language,
    main: p.main.name,
    target: p.settings.target,
    library: p.settings.library,
    extensions: p.extensions,
    tests,
    skein: skeinPath,
    files,
  }, p.manifestExtra)

  // Never produce a package the reader would refuse.
  if (manifest.length > MANIFEST_MAX_BYTES) throw tooBig('its manifest is larger than 1 MB')
  const all = [...entries, { path: MANIFEST_NAME, bytes: manifest }]
  if (all.length + 1 > LIMITS.entries) throw tooBig('the limit is 2,000 files')
  let total = encoder.encode(MIMETYPE).length
  for (const e of all) {
    if (e.bytes.length > LIMITS.entryBytes) throw tooBig(`${displayPath(e.path)} is larger than the 8 MB limit for one file`)
    total += e.bytes.length
  }
  if (total > LIMITS.totalBytes) throw tooBig()
  const out = writeContainer([{ path: MANIFEST_NAME, bytes: manifest }, ...entries])
  if (out.length > LIMITS.archiveBytes) throw tooBig()
  return out
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function text(path: string, bytes: Uint8Array): string {
  let s: string
  try {
    s = decoder.decode(bytes)
  } catch {
    throw new PackageError('bad-text', `This project's file ${displayPath(path)} isn't valid UTF-8 text.`)
  }
  if (s.includes('\u0000')) {
    throw new PackageError('nul-in-text', `This project's file ${displayPath(path)} contains a NUL character, so it isn't text.`)
  }
  return s
}

export async function readProjectPackage(bytes: Uint8Array): Promise<{
  project: ProjectSnapshot
  ignored: string[]
  hashMismatches: string[]
}> {
  const container = readContainer(bytes)
  const manifestBytes = container.get(MANIFEST_NAME)
  if (!manifestBytes) {
    throw new PackageError('no-manifest', `That file isn't a Frotzsmith project: it has no ${MANIFEST_NAME}.`)
  }
  const m = parseManifest(manifestBytes)

  // Lookup by exact path (the manifest's spelling is authoritative).
  const missing = (path: string) =>
    new PackageError('missing-file', `The project's manifest points at a file that isn't in it: ${displayPath(path)}.`)
  const claimed = new Map<string, string>() // pathKey -> purpose
  const claim = (path: string, purpose: string): Uint8Array => {
    const data = container.get(path)
    if (!data || path === MANIFEST_NAME) throw missing(path)
    const key = pathKey(path)
    if (claimed.has(key)) {
      throw new PackageError('shared-file', `The project's manifest uses one file for two purposes: ${displayPath(path)}.`)
    }
    claimed.set(key, purpose)
    return data
  }

  const mainExt = m.language === 'i6' ? '.inf' : '.zil'
  const mainBytes = claim(m.main, 'main')
  if (!m.main.toLowerCase().endsWith(mainExt)) {
    throw new PackageError('bad-main', `This ${m.language === 'i6' ? 'Inform 6' : 'ZIL'} project's main file must end ${mainExt}, not ${displayPath(m.main)}.`)
  }
  const mainText = text(m.main, mainBytes)

  const tests: { name: string; text: string }[] = []
  for (const t of m.tests) tests.push({ name: t.name, text: text(t.path, claim(t.path, 'test')) })

  // Skein: the manifest is authoritative; else <stem>.skein when present.
  const ignored: string[] = []
  let skein: SkeinTree | null = null
  let skeinPath = m.skein
  if (skeinPath === undefined) {
    const guess = pathKey(`${stemOf(m.main)}.skein`)
    skeinPath = [...container.keys()].find(k => pathKey(k) === guess && !claimed.has(pathKey(k)))
  }
  if (skeinPath !== undefined) {
    const skeinBytes = claim(skeinPath, 'skein')
    skein = parseSkein(skeinBytes)
    if (!skein) {
      ignored.push(skeinPath)
      claimed.delete(pathKey(skeinPath)) // falls through to opaque below
    }
  }

  const includes: { path: string; text: string }[] = []
  const opaque: { path: string; bytes: Uint8Array }[] = []
  for (const [path, data] of container) {
    if (path === MANIFEST_NAME || claimed.has(pathKey(path))) continue
    if (m.language === 'i6' && path.toLowerCase().endsWith('.h')) {
      includes.push({ path, text: text(path, data) })
    } else if (path.startsWith('tests/') && path.toLowerCase().endsWith('.txt')) {
      const base = path.slice(path.lastIndexOf('/') + 1)
      tests.push({ name: base.slice(0, -4), text: text(path, data) })
    } else if (COMPILED.test(path)) {
      ignored.push(path)
    } else {
      opaque.push({ path, bytes: data })
    }
  }

  // Integrity: reported, never refused.
  const hashMismatches: string[] = []
  if (m.files) {
    for (const [path, expected] of Object.entries(m.files)) {
      const data = container.get(path)
      if (!data || (await sha256(data)) !== expected) hashMismatches.push(path)
    }
  }

  const project: ProjectSnapshot = {
    language: m.language,
    main: { name: m.main, text: mainText },
    includes,
    extensions: m.extensions,
    tests,
    skein,
    settings: m.library === undefined ? { target: m.target } : { target: m.target, library: m.library },
    opaque,
    manifestExtra: m.extra,
  }
  if (m.title !== undefined) project.title = m.title
  if (m.created !== undefined) project.created = m.created
  return { project, ignored, hashMismatches }
}

/** The tree of a Skein file, or null when it doesn't parse or its shape is wrong. */
function parseSkein(bytes: Uint8Array): SkeinTree | null {
  try {
    const doc: unknown = JSON.parse(decoder.decode(bytes))
    if (typeof doc !== 'object' || doc === null) return null
    const tree = (doc as { tree?: unknown }).tree
    return isValidTree(tree) ? tree : null
  } catch {
    return null
  }
}

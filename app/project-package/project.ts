/**
 * Mapping between a project snapshot and a `.frotzsmith` package (spec §3-§7).
 * Pure: no Vue, no DOM. `readProjectPackage` takes UNTRUSTED bytes and only
 * ever loads text; nothing is compiled, played, or run.
 */
import { parseSkeinFile, type SkeinTree } from '../composables/skein-tree'
import { slugify } from '../utils/slug'
import { LIMITS, MIMETYPE, readContainer, writeContainer } from './container'
import { PackageError, quotedPath } from './errors'
import {
  FORMAT, MANIFEST_MAX_BYTES, MANIFEST_NAME, VERSION, parseManifest, serializeManifest, setOwn, sha256,
  type Language, type Library, type Target,
} from './manifest'
import { pathKey, pathProblem, safeStem } from './paths'
import { planZilFiles } from '../modules/zil/zil-project'
import { SOLUTION_MAX } from '../composables/solution-text'

export interface ProjectSnapshot {
  language: Language
  main: { name: string; text: string }
  includes: { path: string; text: string }[]
  extensions: string[]
  tests: { name: string; text: string; extra?: Record<string, unknown> }[]
  skein: SkeinTree | null
  /** Where the Skein was in the package, when not the default `<stem>.skein`. */
  skeinPath?: string
  settings: { target: Target; library?: Library }
  title?: string
  /** The game's solution text (`solution.txt`): text only, never run. */
  solution?: string
  opaque: { path: string; bytes: Uint8Array }[]
  manifestExtra: Record<string, unknown>
  created?: string
}

/** Test scripts are kept in localStorage: a package may bring at most this
 *  many, with at most this much script text (UTF-8) in all (audit F13). */
export const TEST_LIMITS = Object.freeze({ scripts: 200, totalBytes: 1024 * 1024 })

/** Compiled stories: never written, ignored on read (spec §3). */
export const COMPILED = /\.(z3|z4|z5|z8|ulx|blb|zblorb)$/i
const MiB = 1024 * 1024
/** The solution file's preferred name (spec: at the package root). */
const SOLUTION_NAME = 'solution.txt'
const solutionTooBig = () =>
  new PackageError('solution-too-large', 'This project’s solution is over 1 MiB, which is more than Frotzsmith keeps for one game.')
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
    throw new PackageError('nul-in-text', `Frotzsmith can’t save ${quotedPath(path)}: it contains a NUL character.`)
  }
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * Split files about to be written into the ones a package can hold and the
 * ones the reader would refuse — kept by an older version of Frotzsmith whose
 * rules were looser (review I-2/m-6). A file is left out when its path is
 * unsafe (`pathProblem`), when it collides ignoring case with one already
 * taken or kept, or when it is a file where another path needs a folder (or
 * the reverse). `taken` are paths already in the package; `folders` are folders
 * it will have (e.g. `tests`). `sameAs`, when given, is a further key two
 * kept items must not share (e.g. the Include name a reader mounts a `.h`
 * under; null = no key). Order wins: earlier items are kept first.
 * Callers keep what is left out where it was (browser storage) and say so.
 */
export function splitPackable<T extends { path: string }>(
  items: readonly T[],
  taken: readonly string[] = [],
  folders: readonly string[] = [],
  sameAs?: (item: T) => string | null,
): { kept: T[]; leftOut: T[] } {
  const extraKeys = new Set<string>()
  const fileKeys = new Set([pathKey(MANIFEST_NAME), pathKey('mimetype')])
  const folderKeys = new Set(folders.map(pathKey))
  const prefixKeys = (path: string) => {
    const seg = path.split('/')
    return seg.slice(0, -1).map((_, i) => pathKey(seg.slice(0, i + 1).join('/')))
  }
  const take = (path: string) => {
    fileKeys.add(pathKey(path))
    for (const k of prefixKeys(path)) folderKeys.add(k)
  }
  for (const path of taken) take(path)
  const kept: T[] = []
  const leftOut: T[] = []
  for (const item of items) {
    const key = pathKey(item.path)
    const fits =
      pathProblem(item.path) === null &&
      !fileKeys.has(key) &&
      !folderKeys.has(key) &&
      !prefixKeys(item.path).some(k => fileKeys.has(k))
    const extra = fits && sameAs ? sameAs(item) : null
    if (fits && (extra === null || !extraKeys.has(extra))) {
      if (extra !== null) extraKeys.add(extra)
      take(item.path)
      kept.push(item)
    } else {
      leftOut.push(item)
    }
  }
  return { kept, leftOut }
}

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

  // A ZIL project's extra .zil files are its includes: never write a set the
  // editor would refuse to open (count, size, names).
  if (p.language === 'zil') {
    const plan = planZilFiles(p.includes, p.main.name)
    if (!plan.ok) throw new PackageError('zil-files', plan.message)
  }

  checkText(p.main.name, p.main.text)
  add(p.main.name, encoder.encode(p.main.text))
  for (const inc of p.includes) {
    checkText(inc.path, inc.text)
    add(inc.path, encoder.encode(inc.text))
  }

  const keptOpaque = p.opaque.filter(f => !COMPILED.test(f.path))
  for (const f of keptOpaque) add(f.path, f.bytes)

  // The Skein keeps its old path when free, else steps around what's there.
  let skeinPath: string | undefined
  if (p.skein) {
    const want = p.skeinPath ?? `${stemOf(p.main.name)}.skein`
    skeinPath = want
    for (let n = 2; used.has(pathKey(skeinPath)); n++) skeinPath = `${stemOf(want)}-${n}.skein`
    const storyKey = slugify(p.title ?? '') || 'untitled'
    add(skeinPath, encoder.encode(JSON.stringify({ v: 1, lang: p.language, storyKey, tree: p.skein })))
  }

  // The solution: `solution.txt` when free, else a name that steps around the
  // files and folders already there. Never one the reader would refuse.
  let solutionPath: string | undefined
  if (p.solution !== undefined) {
    if (p.solution.length > SOLUTION_MAX) throw solutionTooBig()
    const folders = new Set<string>()
    for (const e of entries) {
      const seg = e.path.split('/')
      for (let i = 1; i < seg.length; i++) folders.add(pathKey(seg.slice(0, i).join('/')))
    }
    const free = (path: string) => !used.has(pathKey(path)) && !folders.has(pathKey(path))
    solutionPath = SOLUTION_NAME
    for (let n = 2; !free(solutionPath); n++) solutionPath = `solution-${n}.txt`
    checkText(solutionPath, p.solution)
    add(solutionPath, encoder.encode(p.solution))
  }

  // Never write more scripts than the reader opens (TEST_LIMITS).
  if (p.tests.length > TEST_LIMITS.scripts) {
    throw new PackageError('too-many-tests', `Frotzsmith can’t save more than ${TEST_LIMITS.scripts} test scripts in one project.`)
  }
  if (p.tests.reduce((n, t) => n + encoder.encode(t.text).length, 0) > TEST_LIMITS.totalBytes) {
    throw new PackageError('tests-too-large', 'Frotzsmith can’t save more than 1 MB of test scripts in one project.')
  }

  // Tests last, so a generated name steps around any file already present.
  const tests: Record<string, unknown>[] = []
  for (const t of p.tests) {
    const slug = safeStem(slugify(t.name) || 'script')
    let path = `tests/${slug}.txt`
    for (let n = 2; used.has(pathKey(path)); n++) path = `tests/${slug}-${n}.txt`
    checkText(path, t.text)
    add(path, encoder.encode(t.text))
    const entry: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(t.extra ?? {})) setOwn(entry, k, v)
    setOwn(entry, 'name', t.name)
    setOwn(entry, 'path', path)
    tests.push(entry)
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
    solution: solutionPath,
    files,
  }, p.manifestExtra)

  // Never produce a package the reader would refuse.
  if (manifest.length > MANIFEST_MAX_BYTES) throw tooBig('its manifest is larger than 1 MB')
  const all = [...entries, { path: MANIFEST_NAME, bytes: manifest }]
  if (all.length + 1 > LIMITS.entries) throw tooBig('the limit is 2,000 files')
  let total = encoder.encode(MIMETYPE).length
  for (const e of all) {
    if (e.bytes.length > LIMITS.entryBytes) throw tooBig(`${quotedPath(e.path)} is larger than the 8 MB limit for one file`)
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
    throw new PackageError('bad-text', `This project's file ${quotedPath(path)} isn't valid UTF-8 text.`)
  }
  if (s.includes('\u0000')) {
    throw new PackageError('nul-in-text', `This project's file ${quotedPath(path)} contains a NUL character, so it isn't text.`)
  }
  return s
}

export async function readProjectPackage(bytes: Uint8Array): Promise<{
  project: ProjectSnapshot
  /** Compiled story files left out (they're rebuilt by compiling). */
  ignored: string[]
  hashMismatches: string[]
  /** The Skein's path when it was present but couldn't be opened (it is kept
   *  byte-for-byte in `opaque`), else null. */
  skeinNotOpened: string | null
}> {
  const container = readContainer(bytes)
  const manifestBytes = container.get(MANIFEST_NAME)
  if (!manifestBytes) {
    throw new PackageError('no-manifest', `That file isn't a Frotzsmith project: it has no ${MANIFEST_NAME}.`)
  }
  const m = parseManifest(manifestBytes)

  // Lookup by exact path (the manifest's spelling is authoritative).
  const missing = (path: string) =>
    new PackageError('missing-file', `The project's manifest points at a file that isn't in it: ${quotedPath(path)}.`)
  const claimed = new Map<string, string>() // pathKey -> purpose
  const claim = (path: string, purpose: string): Uint8Array => {
    const data = container.get(path)
    if (!data || path === MANIFEST_NAME) throw missing(path)
    const key = pathKey(path)
    if (claimed.has(key)) {
      throw new PackageError('shared-file', `The project's manifest uses one file for two purposes: ${quotedPath(path)}.`)
    }
    claimed.set(key, purpose)
    return data
  }

  const mainExt = m.language === 'i6' ? '.inf' : '.zil'
  const mainBytes = claim(m.main, 'main')
  if (!m.main.toLowerCase().endsWith(mainExt)) {
    throw new PackageError('bad-main', `This ${m.language === 'i6' ? 'Inform 6' : 'ZIL'} project's main file must end ${mainExt}, not ${quotedPath(m.main)}.`)
  }
  const mainText = text(m.main, mainBytes)

  const tests: { name: string; text: string }[] = []
  for (const t of m.tests) {
    const test: { name: string; text: string; extra?: Record<string, unknown> } = {
      name: t.name, text: text(t.path, claim(t.path, 'test')),
    }
    if (t.extra) test.extra = t.extra
    tests.push(test)
  }

  // The solution: only the file the manifest names, UTF-8 text of at most
  // 1 MiB (UTF-16 length, the store's unit); anything else refuses the open.
  let solution: string | undefined
  if (m.solution !== undefined) {
    // A .txt only — never a story, an include, or a Skein's file — and
    // claimed before the Skein, so an unopened Skein can't be re-claimed.
    if (!m.solution.toLowerCase().endsWith('.txt')) {
      throw new PackageError('bad-solution', `This project's solution file must end .txt, not ${quotedPath(m.solution)}.`)
    }
    const data = claim(m.solution, 'solution')
    if (data.length > SOLUTION_MAX * 3) throw solutionTooBig() // can't be ≤ 1 Mi UTF-16 units
    solution = text(m.solution, data)
    if (solution.length > SOLUTION_MAX) throw solutionTooBig()
  }

  // Skein: the manifest is authoritative; else <stem>.skein when present.
  const ignored: string[] = []
  let skeinNotOpened: string | null = null
  let skein: SkeinTree | null = null
  let skeinPath = m.skein
  let skeinPathOut: string | undefined
  if (skeinPath === undefined) {
    const guess = pathKey(`${stemOf(m.main)}.skein`)
    skeinPath = [...container.keys()].find(k => pathKey(k) === guess && !claimed.has(pathKey(k)))
  }
  if (skeinPath !== undefined) {
    const skeinBytes = claim(skeinPath, 'skein')
    skein = parseSkein(skeinBytes)
    if (skein) {
      if (skeinPath !== `${stemOf(m.main)}.skein`) skeinPathOut = skeinPath
    } else {
      skeinNotOpened = skeinPath
      claimed.delete(pathKey(skeinPath)) // falls through to opaque below
    }
  }

  const includes: { path: string; text: string }[] = []
  const opaque: { path: string; bytes: Uint8Array }[] = []
  for (const [path, data] of container) {
    if (path === MANIFEST_NAME || claimed.has(pathKey(path))) continue
    // Includes: `.h` for Inform 6; for ZIL every `.zil` but the main file
    // (packages written before multi-file ZIL kept these as opaque entries).
    if (path.toLowerCase().endsWith(m.language === 'i6' ? '.h' : '.zil')) {
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

  if (tests.length > TEST_LIMITS.scripts) {
    throw new PackageError('too-many-tests', `This project has more test scripts than Frotzsmith can open (${TEST_LIMITS.scripts}).`)
  }
  if (tests.reduce((n, t) => n + encoder.encode(t.text).length, 0) > TEST_LIMITS.totalBytes) {
    throw new PackageError('tests-too-large', 'This project’s test scripts are larger than Frotzsmith can keep (1 MB in all).')
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
  if (skeinPathOut !== undefined) project.skeinPath = skeinPathOut
  if (m.title !== undefined) project.title = m.title
  if (solution !== undefined) project.solution = solution
  if (m.created !== undefined) project.created = m.created
  return { project, ignored, hashMismatches, skeinNotOpened }
}

/** The tree of a Skein file — rebuilt from known fields only (sanitizeTree)
 *  — or null when it doesn't parse, nests too deeply, or its shape is wrong. */
function parseSkein(bytes: Uint8Array): SkeinTree | null {
  try {
    return parseSkeinFile(decoder.decode(bytes))?.tree ?? null
  } catch {
    return null
  }
}

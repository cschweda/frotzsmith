/**
 * The `frotzsmith.json` manifest (spec §4): parsing UNTRUSTED bytes into a
 * validated, typed shape, and serialising one back. The manifest is data only:
 * nothing in it is executed, fetched, or used to decide where to write.
 */
import { PackageError, displayPath, quotedPath } from './errors'
import { pathProblem } from './paths'

export const FORMAT = 'frotzsmith-package'
export const VERSION = '0.1'
export const MANIFEST_NAME = 'frotzsmith.json'
export const MANIFEST_MAX_BYTES = 1024 * 1024
/** Deepest array/object nesting allowed (spec §12); the manifest object is depth 1. */
export const MANIFEST_MAX_DEPTH = 64

export type Language = 'i6' | 'zil'
export type Target = 'auto' | 'z3' | 'z4' | 'z5' | 'z8'
export type Library = 'auto' | 'std' | 'puny'

const TARGETS: readonly string[] = ['auto', 'z3', 'z4', 'z5', 'z8']
const LIBRARIES: readonly string[] = ['auto', 'std', 'puny']

/** Manifest fields this implementation understands; everything else is kept as-is. */
const KNOWN = new Set([
  'format', 'version', 'generator', 'created', 'modified', 'title', 'language', 'main',
  'target', 'library', 'extensions', 'tests', 'skein', 'files',
])

export interface ParsedManifest {
  language: Language
  main: string
  created?: string
  title?: string
  target: Target
  library?: Library
  extensions: string[]
  tests: { name: string; path: string; extra?: Record<string, unknown> }[]
  skein?: string
  files?: Record<string, string>
  /** Unknown fields (and `library` for ZIL), verbatim. */
  extra: Record<string, unknown>
}

const bad = (msg: string) => new PackageError('bad-manifest', msg)

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Set an own property without ever triggering the `__proto__` setter. */
export function setOwn(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true })
}

function checkPath(field: string, value: unknown): string {
  if (typeof value !== 'string') throw bad(`This project's manifest has a ${field} that isn't text.`)
  if (pathProblem(value) !== null) {
    throw bad(`This project's manifest names a file with an unsafe name: ${quotedPath(value)}.`)
  }
  return value
}

/** Deepest array/object nesting in a parsed JSON value, iteratively, stopping
 *  as soon as `limit` is exceeded (a 200k-deep array would otherwise break
 *  structuredClone/JSON.stringify later, far from the cause). */
function exceedsDepth(value: unknown, limit: number): boolean {
  const stack: [unknown, number][] = [[value, 1]]
  while (stack.length) {
    const [v, depth] = stack.pop()!
    if (typeof v !== 'object' || v === null) continue
    if (depth > limit) return true
    for (const child of Array.isArray(v) ? v : Object.values(v)) {
      if (typeof child === 'object' && child !== null) stack.push([child, depth + 1])
    }
  }
  return false
}

export function parseManifest(bytes: Uint8Array): ParsedManifest {
  if (bytes.length > MANIFEST_MAX_BYTES) throw bad('This project\'s manifest (frotzsmith.json) is larger than 1 MB.')
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw bad('This project\'s manifest (frotzsmith.json) starts with a byte-order mark, which isn\'t allowed.')
  }
  let doc: unknown
  try {
    doc = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes))
  } catch {
    throw bad("This project's manifest (frotzsmith.json) isn't valid JSON text.")
  }
  if (!isPlainObject(doc)) throw bad("This project's manifest (frotzsmith.json) isn't a JSON object.")
  if (exceedsDepth(doc, MANIFEST_MAX_DEPTH)) throw bad("This project's manifest (frotzsmith.json) is nested too deeply.")

  if (doc.format !== FORMAT) {
    throw bad(`That file isn't a Frotzsmith project: its manifest's format isn't "${FORMAT}".`)
  }
  if (typeof doc.version !== 'string') throw bad("This project's manifest has no valid version.")
  const v = /^(\d{1,9})\.(\d{1,9})$/.exec(doc.version)
  if (!v) throw bad("This project's manifest has no valid version.")
  if (Number(v[1]) > 0) {
    throw bad(`This project was made by a newer Frotzsmith (format ${displayPath(doc.version, 20)}). Update Frotzsmith to open it.`)
  }

  if (doc.language !== 'i6' && doc.language !== 'zil') {
    throw bad('This project\'s manifest must say its language is "i6" or "zil".')
  }
  const language: Language = doc.language
  const main = checkPath('main file', doc.main)

  const out: ParsedManifest = { language, main, target: 'auto', extensions: [], tests: [], extra: {} }

  if (doc.created !== undefined) {
    if (typeof doc.created !== 'string') throw bad("This project's manifest has a created date that isn't text.")
    out.created = doc.created
  }
  if (doc.title !== undefined) {
    if (typeof doc.title !== 'string') throw bad("This project's manifest has a title that isn't text.")
    out.title = doc.title
  }
  if (doc.target !== undefined) {
    if (typeof doc.target !== 'string' || !TARGETS.includes(doc.target)) {
      throw bad('This project\'s manifest has a target that isn\'t one of auto, z3, z4, z5 or z8.')
    }
    out.target = doc.target as Target
  }
  if (doc.library !== undefined && language === 'i6') {
    if (typeof doc.library !== 'string' || !LIBRARIES.includes(doc.library)) {
      throw bad('This project\'s manifest has a library that isn\'t one of auto, std or puny.')
    }
    out.library = doc.library as Library
  }
  if (doc.extensions !== undefined) {
    if (!Array.isArray(doc.extensions) || !doc.extensions.every(e => typeof e === 'string')) {
      throw bad("This project's manifest has an extensions list that isn't a list of names.")
    }
    out.extensions = [...doc.extensions] as string[]
  }
  if (doc.tests !== undefined) {
    if (!Array.isArray(doc.tests)) throw bad("This project's manifest has a tests list that isn't a list.")
    for (const t of doc.tests as unknown[]) {
      if (!isPlainObject(t) || typeof t.name !== 'string') {
        throw bad('This project\'s manifest has a test without a name.')
      }
      const entry: { name: string; path: string; extra?: Record<string, unknown> } = {
        name: t.name, path: checkPath('test path', t.path),
      }
      for (const [k, val] of Object.entries(t)) {
        if (k === 'name' || k === 'path') continue
        entry.extra ??= {}
        setOwn(entry.extra, k, val)
      }
      out.tests.push(entry)
    }
  }
  if (doc.skein !== undefined) out.skein = checkPath('skein path', doc.skein)
  if (doc.files !== undefined) {
    if (!isPlainObject(doc.files)) throw bad("This project's manifest has a files list that isn't a map of paths to hashes.")
    const files: Record<string, string> = {}
    for (const [k, h] of Object.entries(doc.files)) setOwn(files, k, typeof h === 'string' ? h : '')
    out.files = files
  }

  for (const [k, val] of Object.entries(doc)) {
    if (!KNOWN.has(k) || (k === 'library' && language !== 'i6')) setOwn(out.extra, k, val)
  }
  return out
}

/** Keys the writer always sets itself; extras by these names are dropped. */
export const WRITER_KEYS = new Set(KNOWN)

export function serializeManifest(fields: Record<string, unknown>, extra: Record<string, unknown>): Uint8Array {
  const doc: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) setOwn(doc, k, v)
  for (const [k, v] of Object.entries(extra)) {
    if (!Object.hasOwn(doc, k) && (!WRITER_KEYS.has(k) || k === 'library')) setOwn(doc, k, v)
  }
  return new TextEncoder().encode(`${JSON.stringify(doc, null, 2)}\n`)
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource))
  let hex = ''
  for (const b of digest) hex += b.toString(16).padStart(2, '0')
  return `sha256:${hex}`
}

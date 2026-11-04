/**
 * Path rules for names inside a `.frotzsmith` package (spec §2).
 *
 * `pathProblem` returns `null` for a safe path, or a short reason. Paths are
 * refused, never repaired.
 */

const MAX_SEGMENT_BYTES = 255
const MAX_PATH_BYTES = 1024

// C0 controls (incl. NUL), DEL, and C1 controls.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/
// A high surrogate not followed by a low one, or a low one not preceded by a high one.
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/
const DRIVE_LETTER = /^[A-Za-z]:/

const utf8 = new TextEncoder()

export function pathProblem(path: string): string | null {
  if (path.length === 0) return 'the path is empty'
  if (CONTROL.test(path)) return 'the path contains a control character'
  if (LONE_SURROGATE.test(path)) return 'the path is not valid Unicode'
  if (path.includes('\\')) return 'the path contains a backslash'
  if (path.startsWith('/')) return 'the path starts with /'
  if (DRIVE_LETTER.test(path)) return 'the path starts with a drive letter'
  if (utf8.encode(path).length > MAX_PATH_BYTES) return `the path is longer than ${MAX_PATH_BYTES} bytes`
  for (const segment of path.split('/')) {
    if (segment === '') return 'the path has an empty segment'
    if (segment === '.' || segment === '..') return `the path has a "${segment}" segment`
    if (utf8.encode(segment).length > MAX_SEGMENT_BYTES) return `a path segment is longer than ${MAX_SEGMENT_BYTES} bytes`
  }
  return null
}

/** The key two paths are compared by: equal keys collide (spec §2). */
export function pathKey(path: string): string {
  return path.normalize('NFC').toLowerCase()
}

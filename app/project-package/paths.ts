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
/** Characters Windows can't hold in a name (`\\` and `/` are handled apart). */
const WINDOWS_FORBIDDEN = /[:<>|?*"]/
/**
 * Characters that can't be seen, or that change how the rest of a name
 * displays: format characters (bidi controls, zero-width characters, the BOM,
 * soft hyphen, tags, invisible operators, …), line and paragraph separators,
 * private-use characters, the Hangul fillers that render as blank space, and
 * lookalikes of `/` and `\\` (division slash, fraction slash, fullwidth and big
 * solidus, reverse solidus operator, fullwidth reverse solidus).
 */
const DECEPTIVE = /[\p{Cf}\p{Zl}\p{Zp}\p{Co}\u115f\u1160\u3164\uffa0\u2044\u2215\u29f5\u29f8\uff0f\uff3c]/u
/**
 * Windows device names, which name a device instead of a file in any folder
 * and with any extension (`CON`, `nul.txt`, `COM1.inf`, `LPT¹`, `CONIN$`).
 * Matched against the part of a segment before its first dot, with trailing
 * spaces dropped, ignoring case.
 */
const DEVICE_NAME = /^(con|prn|aux|nul|com[0-9\u00b9\u00b2\u00b3]|lpt[0-9\u00b9\u00b2\u00b3]|conin\$|conout\$)$/i

const utf8 = new TextEncoder()

/** Whether `stem` (a name's part before its first dot) is a Windows device name. */
export function isDeviceName(stem: string): boolean {
  return DEVICE_NAME.test(stem.replace(/ +$/, ''))
}

/**
 * A stem frotzsmith generates a file name from, made safe from the device-name
 * rule: a Windows device name gets a `_` (`con` → `con_`, so `tests/con_.txt`),
 * anything else is returned as is. Every writer-side name builder uses it, so
 * the writer never makes a name `pathProblem` refuses (review I-1).
 */
export function safeStem(stem: string): string {
  return isDeviceName(stem) ? `${stem}_` : stem
}

export function pathProblem(path: string): string | null {
  if (path.length === 0) return 'the path is empty'
  if (CONTROL.test(path)) return 'the path contains a control character'
  if (LONE_SURROGATE.test(path)) return 'the path is not valid Unicode'
  if (path.includes('\\')) return 'the path contains a backslash'
  if (path.startsWith('/')) return 'the path starts with /'
  if (DRIVE_LETTER.test(path)) return 'the path starts with a drive letter'
  if (WINDOWS_FORBIDDEN.test(path)) return 'the path contains a character Windows doesn’t allow in names'
  if (DECEPTIVE.test(path)) return 'the path contains an invisible or look-alike character'
  if (utf8.encode(path).length > MAX_PATH_BYTES) return `the path is longer than ${MAX_PATH_BYTES} bytes`
  for (const segment of path.split('/')) {
    if (segment === '') return 'the path has an empty segment'
    if (segment === '.' || segment === '..') return `the path has a "${segment}" segment`
    if (utf8.encode(segment).length > MAX_SEGMENT_BYTES) return `a path segment is longer than ${MAX_SEGMENT_BYTES} bytes`
    if (segment.endsWith('.') || segment.endsWith(' ')) return 'a name in the path ends with a dot or a space'
    if (segment.startsWith(' ')) return 'a name in the path starts with a space'
    if (isDeviceName(segment.split('.')[0]!)) return 'the path uses a name Windows reserves for a device'
  }
  return null
}

/**
 * The key two paths are compared by: equal keys collide (spec §2). NFKC folds
 * compatibility forms (`ﬀ` → `ff`, fullwidth `Ａ` → `A`, `ſ` → `s`), and
 * upper-casing before lower-casing, done twice, is a full case fold (`ß` →
 * `ss`, `ı` → `i`, `ς` → `σ`; the second round catches what the first only
 * moves along, `ẞ` → `ß` → `ss`), so names a case-insensitive file system or
 * another unzipper would treat as one collide here too.
 */
export function pathKey(path: string): string {
  const once = (s: string) => s.toUpperCase().toLowerCase()
  return once(once(path.normalize('NFKC'))).normalize('NFKC')
}

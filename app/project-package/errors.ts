/**
 * The one error a `.frotzsmith` package reader or writer throws.
 *
 * `message` is a single plain sentence meant to be shown to the user as is.
 * `code` is a stable machine-readable reason (for tests and callers that want
 * to branch); it never appears in the UI.
 */
export class PackageError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'PackageError'
    this.code = code
  }
}

/**
 * Characters that could make a quoted name display misleadingly: controls
 * (Cc), format characters (Cf: bidi controls, zero-width characters, the BOM,
 * soft hyphen, tags, invisible operators …), line and paragraph separators
 * (Zl, Zp), private-use (Co) and unassigned (Cn) code points, the Hangul
 * fillers that render as blank space, and LONE surrogates. With the `u` flag a
 * valid surrogate pair is one code point outside \u{D800}-\u{DFFF}, so emoji
 * survive.
 */
const UNSAFE_DISPLAY = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cn}\u115f\u1160\u3164\uffa0\u{d800}-\u{dfff}]/gu
/** A run of combining marks after the first `MAX_MARKS`. */
const MAX_MARKS = 2
const EXCESS_MARKS = new RegExp(`(?<=\\p{M}{${MAX_MARKS}})\\p{M}+`, 'gu')
/** Default length (in code points) a displayed name is cut to. */
export const DISPLAY_MAX = 60

/**
 * A package path made safe to quote inside a user-facing sentence: invisible,
 * bidi, separator and lone-surrogate characters become U+FFFD, combining marks
 * are capped at two per character, and long names are shortened to `max`
 * code points plus "…". Never use the result as a path.
 */
export function displayPath(path: string, max = DISPLAY_MAX): string {
  const clean = path.replace(UNSAFE_DISPLAY, '\ufffd').replace(EXCESS_MARKS, '')
  const chars = Array.from(clean)
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : clean
}

/** `displayPath` in curly quotes, so a name can't read as part of the sentence around it. */
export function quotedPath(path: string, max = DISPLAY_MAX): string {
  return `“${displayPath(path, max)}”`
}

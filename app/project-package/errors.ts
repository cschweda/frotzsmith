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

/** Control, bidi, zero-width and BOM characters that could make a name display
 *  misleadingly, plus LONE surrogates. With the `u` flag a valid surrogate pair
 *  is one code point outside the \u{D800}-\u{DFFF} range, so emoji survive. */
// eslint-disable-next-line no-control-regex
const UNSAFE_DISPLAY = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff\u{d800}-\u{dfff}]/gu

/**
 * A package path made safe to quote inside a user-facing sentence: control,
 * bidi and lone-surrogate characters become U+FFFD and long names are
 * shortened. Never use the result as a path.
 */
export function displayPath(path: string, max = 80): string {
  const clean = path.replace(UNSAFE_DISPLAY, '\ufffd')
  const chars = Array.from(clean)
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : clean
}

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

/** Bidi controls and other format characters that could make a name display misleadingly. */
// eslint-disable-next-line no-control-regex
const UNSAFE_DISPLAY = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿\ud800-\udfff]/g

/**
 * A package path made safe to quote inside a user-facing sentence: control,
 * bidi and lone-surrogate characters become U+FFFD and long names are
 * shortened. Never use the result as a path.
 */
export function displayPath(path: string, max = 80): string {
  const clean = path.replace(UNSAFE_DISPLAY, '�')
  const chars = Array.from(clean)
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : clean
}

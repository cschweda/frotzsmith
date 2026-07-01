import { LanguageSupport, StreamLanguage, type StreamParser } from '@codemirror/language'

// ZIL (Zork Implementation Language) is a dialect of MDL — Lisp-like, with
// angle-bracket delimited forms: <ROUTINE GO () ...>, <OBJECT LANTERN ...>.
// The first atom after < is typically the directive / function name.

/** Directives and built-in functions highlighted as keywords (uppercase lookup). */
const KEYWORDS = new Set([
  // Core directives from the language spec
  'ROUTINE', 'OBJECT', 'ROOM', 'GLOBAL', 'CONSTANT', 'VERSION', 'SYNTAX',
  'TELL', 'COND', 'SET', 'SETG',
  // Additional common directives / built-ins
  'PROPDEF', 'INSERT-FILE', 'PRINCI',
  'RTRUE', 'RFALSE', 'RETURN', 'AGAIN', 'REPEAT', 'DO',
  'MAP-CONTENTS', 'VERB?', 'FSET?', 'GETP', 'PUTP', 'MOVE', 'REMOVE',
])

/**
 * StreamParser for ZIL source files.
 *
 * Exported so that unit tests can drive the `token()` function directly via a
 * `StringStream` — the same pattern used by the I6 mode in
 * `app/modules/inform6/editor/i6-language.ts`.
 */
export const zilParser: StreamParser<unknown> = {
  name: 'zil',

  token(stream, _state) {
    if (stream.eatSpace()) return null

    const ch = stream.peek()

    // ── ZIL comments ─────────────────────────────────────────────────────────
    // A ZIL comment is a semicolon followed by a single MDL object.
    // Most commonly: ;"a string comment" or ;ATOM or ;<a commented-out form>.
    // v1 approximation: ; + immediately-following string → comment;
    //                   bare ; → eat to end of line.
    if (ch === ';') {
      stream.next() // consume ';'
      if (stream.peek() === '"') {
        // ;"string comment"
        stream.next() // consume opening '"'
        while (!stream.eol()) if (stream.next() === '"') break
        return 'comment'
      }
      // bare ; or ;ATOM / ;<FORM> — treat rest of line as comment (safe v1 approx)
      stream.skipToEnd()
      return 'comment'
    }

    // ── double-quoted strings ─────────────────────────────────────────────────
    if (ch === '"') {
      stream.next() // consume opening '"'
      while (!stream.eol()) if (stream.next() === '"') break
      return 'string'
    }

    // ── integer literals (decimal only for v1) ────────────────────────────────
    if (stream.match(/^\d+/)) return 'number'

    // ── brackets: < > ( ) [ ] ─────────────────────────────────────────────────
    if (stream.match(/^[<>()\[\]]/)) return 'bracket'

    // ── local variable refs: .NAME (leading dot) ──────────────────────────────
    if (ch === '.') {
      stream.next() // consume '.'
      stream.match(/^[A-Za-z][A-Za-z0-9\-?!]*/)
      return 'variableName'
    }

    // ── global variable refs: ,NAME (leading comma) ───────────────────────────
    if (ch === ',') {
      stream.next() // consume ','
      stream.match(/^[A-Za-z][A-Za-z0-9\-?!]*/)
      return 'variableName'
    }

    // ── atoms / directives ────────────────────────────────────────────────────
    // ZIL atoms are uppercase by convention, may contain hyphens, ?, and !.
    // MDL atoms are case-insensitive — we normalise to uppercase for the lookup.
    const word = stream.match(/^[A-Za-z][A-Za-z0-9\-?!]*/)
    if (word) {
      const upper = (word as RegExpMatchArray)[0].toUpperCase()
      if (KEYWORDS.has(upper)) return 'keyword'
      return 'variableName'
    }

    // consume any unrecognised character (operator, %, #, etc.)
    stream.next()
    return null
  },
}

/** CodeMirror 6 language support for ZIL (Zork Implementation Language). */
export function zil(): LanguageSupport {
  return new LanguageSupport(StreamLanguage.define(zilParser))
}

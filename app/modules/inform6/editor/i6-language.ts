import { LanguageSupport, StreamLanguage, type StreamParser } from '@codemirror/language'

// Inform 6's lexical surface is small. A StreamLanguage mode gives solid
// keyword/string/comment highlighting; a full Lezer grammar is a later stretch.

const DIRECTIVES = new Set([
  'object', 'class', 'verb', 'constant', 'global', 'array', 'include', 'attribute',
  'property', 'replace', 'default', 'fake_action', 'lowstring', 'message', 'statusline',
  'switches', 'abbreviate', 'dictionary', 'ifdef', 'ifndef', 'ifnot', 'endif', 'iftrue',
  'iffalse', 'import', 'system_file', 'zcharacter', 'stub', 'trace', 'undef', 'end',
  'extend', 'link', 'nearby', 'release', 'serial', 'version', 'origsource',
])

const KEYWORDS = new Set([
  'with', 'has', 'private', 'if', 'else', 'for', 'while', 'do', 'until', 'switch',
  'return', 'rtrue', 'rfalse', 'print', 'print_ret', 'new_line', 'give', 'remove',
  'move', 'to', 'objectloop', 'jump', 'box', 'font', 'style', 'spaces', 'read',
  'string', 'self', 'child', 'children', 'parent', 'sibling', 'random', 'metaclass',
  'quit', 'restart', 'restore', 'save', 'provides', 'in', 'notin', 'ofclass', 'or',
  'and', 'not', 'has', 'hasnt',
])

const ATOMS = new Set(['true', 'false', 'nothing'])

const parser: StreamParser<unknown> = {
  token(stream) {
    if (stream.eatSpace()) return null

    // ! line comment
    if (stream.peek() === '!') {
      stream.skipToEnd()
      return 'comment'
    }

    // "double-quoted strings"
    if (stream.match('"')) {
      while (!stream.eol()) if (stream.next() === '"') break
      return 'string'
    }

    // 'dictionary words' / single-quoted
    if (stream.match("'")) {
      while (!stream.eol()) if (stream.next() === "'") break
      return 'string'
    }

    // $hex, $$binary, decimal
    if (stream.match(/^\$\$[01]+/) || stream.match(/^\$[0-9a-fA-F]+/) || stream.match(/^\d+/)) {
      return 'number'
    }

    // object-tree arrow
    if (stream.match('->')) return 'operator'

    const word = stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)
    if (word) {
      const lower = (word as RegExpMatchArray)[0].toLowerCase()
      if (DIRECTIVES.has(lower) || KEYWORDS.has(lower)) return 'keyword'
      if (ATOMS.has(lower)) return 'atom'
      return 'variableName'
    }

    stream.next()
    return null
  },
}

/** CodeMirror language support for Inform 6. */
export function inform6() {
  return new LanguageSupport(StreamLanguage.define(parser))
}

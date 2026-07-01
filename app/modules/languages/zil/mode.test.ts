import { describe, it, expect } from 'vitest'
import { StringStream } from '@codemirror/language'
import { zilParser } from './mode'

/**
 * Run the ZIL StreamParser token function across a single line, collecting
 * every token type returned (including nulls for whitespace / unrecognized chars).
 */
function tokenizeLine(line: string): (string | null)[] {
  const stream = new StringStream(line, 4, 2)
  const tokens: (string | null)[] = []
  while (!stream.eol()) {
    tokens.push(zilParser.token(stream, undefined))
  }
  return tokens
}

describe('ZIL StreamParser tokenizer', () => {
  // ── keywords ──────────────────────────────────────────────────────────────
  describe('keywords', () => {
    it('tokenizes ROUTINE as keyword', () => {
      expect(tokenizeLine('ROUTINE')).toContain('keyword')
    })

    it('tokenizes OBJECT as keyword', () => {
      expect(tokenizeLine('OBJECT')).toContain('keyword')
    })

    it('tokenizes ROOM as keyword', () => {
      expect(tokenizeLine('ROOM')).toContain('keyword')
    })

    it('tokenizes TELL as keyword', () => {
      expect(tokenizeLine('TELL')).toContain('keyword')
    })

    it('tokenizes COND as keyword', () => {
      expect(tokenizeLine('COND')).toContain('keyword')
    })

    it('tokenizes CONSTANT as keyword', () => {
      expect(tokenizeLine('CONSTANT')).toContain('keyword')
    })

    it('tokenizes GLOBAL as keyword', () => {
      expect(tokenizeLine('GLOBAL')).toContain('keyword')
    })

    it('tokenizes SET as keyword', () => {
      expect(tokenizeLine('SET')).toContain('keyword')
    })

    it('tokenizes RTRUE as keyword', () => {
      expect(tokenizeLine('RTRUE')).toContain('keyword')
    })

    it('tokenizes RFALSE as keyword', () => {
      expect(tokenizeLine('RFALSE')).toContain('keyword')
    })

    it('tokenizes MOVE as keyword', () => {
      expect(tokenizeLine('MOVE')).toContain('keyword')
    })

    it('tokenizes RETURN as keyword', () => {
      expect(tokenizeLine('RETURN')).toContain('keyword')
    })

    it('recognizes keywords case-insensitively (MDL atoms are case-insensitive)', () => {
      expect(tokenizeLine('routine')).toContain('keyword')
    })
  })

  // ── strings ───────────────────────────────────────────────────────────────
  describe('strings', () => {
    it('tokenizes a double-quoted string', () => {
      expect(tokenizeLine('"hello world"')).toContain('string')
    })

    it('tokenizes an empty string', () => {
      expect(tokenizeLine('""')).toContain('string')
    })

    it('tokenizes a string with punctuation inside', () => {
      expect(tokenizeLine('"You are in the West of the House."')).toContain('string')
    })
  })

  // ── comments ──────────────────────────────────────────────────────────────
  describe('comments', () => {
    it('tokenizes ;"string" as comment', () => {
      expect(tokenizeLine(';"this is a comment"')).toContain('comment')
    })

    it('tokenizes bare ; to end-of-line as comment', () => {
      expect(tokenizeLine('; rest of line comment')).toContain('comment')
    })
  })

  // ── brackets / punctuation ────────────────────────────────────────────────
  describe('brackets', () => {
    it('tokenizes < as bracket', () => {
      expect(tokenizeLine('<')).toContain('bracket')
    })

    it('tokenizes > as bracket', () => {
      expect(tokenizeLine('>')).toContain('bracket')
    })

    it('tokenizes ( and ) as bracket', () => {
      const tokens = tokenizeLine('()')
      expect(tokens).toContain('bracket')
    })

    it('tokenizes [ and ] as bracket', () => {
      const tokens = tokenizeLine('[]')
      expect(tokens).toContain('bracket')
    })
  })

  // ── numbers ───────────────────────────────────────────────────────────────
  describe('numbers', () => {
    it('tokenizes an integer literal', () => {
      expect(tokenizeLine('42')).toContain('number')
    })

    it('tokenizes zero', () => {
      expect(tokenizeLine('0')).toContain('number')
    })

    it('tokenizes a multi-digit number', () => {
      expect(tokenizeLine('1024')).toContain('number')
    })
  })

  // ── atoms / identifiers ───────────────────────────────────────────────────
  describe('atoms / identifiers', () => {
    it('tokenizes an unknown uppercase atom as variableName', () => {
      expect(tokenizeLine('WINNER')).toContain('variableName')
    })

    it('tokenizes a hyphenated atom as variableName', () => {
      expect(tokenizeLine('FOO-BAR')).toContain('variableName')
    })

    it('tokenizes an atom with ? suffix as variableName', () => {
      // Non-keyword atoms with ? suffix are variableNames
      expect(tokenizeLine('P?LDESC')).toContain('variableName')
    })

    it('does not split a hyphenated keyword like INSERT-FILE across tokens', () => {
      // INSERT-FILE should tokenize as a single keyword token
      expect(tokenizeLine('INSERT-FILE')).toContain('keyword')
      // And the token list should not also contain a variableName (no split)
      const tokens = tokenizeLine('INSERT-FILE')
      const kwCount = tokens.filter(t => t === 'keyword').length
      expect(kwCount).toBe(1)
    })
  })

  // ── local / global variable refs ──────────────────────────────────────────
  describe('variable refs', () => {
    it('tokenizes .LOCAL as variableName', () => {
      expect(tokenizeLine('.LOCAL')).toContain('variableName')
    })

    it('tokenizes .LOCAL-VAR with hyphen as variableName', () => {
      expect(tokenizeLine('.LOCAL-VAR')).toContain('variableName')
    })

    it('tokenizes ,GLOBAL as variableName', () => {
      expect(tokenizeLine(',GLOBAL')).toContain('variableName')
    })

    it('tokenizes ,GLOBAL-NAME with hyphen as variableName', () => {
      expect(tokenizeLine(',GLOBAL-NAME')).toContain('variableName')
    })
  })

  // ── composite / integration ────────────────────────────────────────────────
  describe('composite form tokenization', () => {
    it('tokenizes a ZIL form: <ROUTINE GO ()>', () => {
      const tokens = tokenizeLine('<ROUTINE GO ()')
      expect(tokens).toContain('bracket')      // < and ( and )
      expect(tokens).toContain('keyword')      // ROUTINE
      expect(tokens).toContain('variableName') // GO
    })

    it('tokenizes a TELL form with string', () => {
      const tokens = tokenizeLine('<TELL "You are here.">')
      expect(tokens).toContain('bracket')  // < and >
      expect(tokens).toContain('keyword')  // TELL
      expect(tokens).toContain('string')   // "You are here."
    })

    it('tokenizes a COND clause with number', () => {
      const tokens = tokenizeLine('<COND (.X 42)>')
      expect(tokens).toContain('bracket')
      expect(tokens).toContain('keyword')      // COND
      expect(tokens).toContain('variableName') // .X
      expect(tokens).toContain('number')       // 42
    })
  })
})

import { describe, it, expect } from 'vitest'
import { formatZil } from './format-zil'

// Helper: build a source string from an array of lines (join with \n).
const src = (...lines: string[]) => lines.join('\n')

describe('formatZil – form indentation', () => {
  it('indents the body of a <ROUTINE> form one level', () => {
    const input = src('<ROUTINE FOO ()', '<BAR>>')
    const expected = src('<ROUTINE FOO ()', '    <BAR>>')
    expect(formatZil(input)).toBe(expected)
  })

  it('leaves a self-contained single-line form at column 0', () => {
    const input = '<CONSTANT X 42>'
    expect(formatZil(input)).toBe(input)
  })

  it('emits a standalone closing > at column 0 when it closes the outermost form', () => {
    const input = src('<ROUTINE FOO ()', '<BAR>', '>')
    const expected = src('<ROUTINE FOO ()', '    <BAR>', '>')
    expect(formatZil(input)).toBe(expected)
  })
})

describe('formatZil – nested form indentation', () => {
  it('indents nested forms by bracket depth', () => {
    const input = src(
      '<ROUTINE FOO ()',
      '<COND (<VERB? BAR>',
      '<TELL "x" CR>)>>',
    )
    // <ROUTINE: depth 0, opens to 1
    // <COND (<VERB? BAR>: depth 1 → opens by +2 → bracket 3
    // <TELL "x" CR>)>>: depth 3 (12 spaces)
    const expected = src(
      '<ROUTINE FOO ()',
      '    <COND (<VERB? BAR>',
      '            <TELL "x" CR>)>>',
    )
    expect(formatZil(input)).toBe(expected)
  })

  it('a line starting with ) dedents one level', () => {
    // Parenthesised condition on its own closing line
    const input = src('<ROUTINE FOO ()', '<COND (<BAR>', ')>>')
    // After <ROUTINE: bracket=1; after <COND (<BAR>: bracket=3; ) is CLOSER → level 2
    const expected = src('<ROUTINE FOO ()', '    <COND (<BAR>', '        )>>')
    expect(formatZil(input)).toBe(expected)
  })
})

describe('formatZil – blank line collapsing', () => {
  it('collapses multiple consecutive blank lines into one', () => {
    const input = src('<CONSTANT X 42>', '', '', '<CONSTANT Y 43>')
    expect(formatZil(input)).toBe(src('<CONSTANT X 42>', '', '<CONSTANT Y 43>'))
  })

  it('drops leading blank lines', () => {
    const input = src('', '', '<CONSTANT X 42>')
    expect(formatZil(input)).toBe('<CONSTANT X 42>')
  })

  it('drops a trailing blank line', () => {
    const input = src('<CONSTANT X 42>', '')
    expect(formatZil(input)).toBe('<CONSTANT X 42>')
  })

  it('preserves exactly one blank line between top-level forms', () => {
    const input = src(
      '<CONSTANT X 42>',
      '',
      '<CONSTANT Y 43>',
    )
    expect(formatZil(input)).toBe(input)
  })
})

describe('formatZil – whitespace handling', () => {
  it('converts leading tabs to the indent-space equivalent', () => {
    const input = src('<ROUTINE FOO ()', '\t<BAR>>')
    expect(formatZil(input)).toBe(src('<ROUTINE FOO ()', '    <BAR>>'))
  })

  it('trims trailing whitespace on code lines', () => {
    const input = '<CONSTANT X 42>   '
    expect(formatZil(input)).toBe('<CONSTANT X 42>')
  })

  it('respects a custom indent size', () => {
    const input = src('<ROUTINE FOO ()', '<BAR>>')
    expect(formatZil(input, 2)).toBe(src('<ROUTINE FOO ()', '  <BAR>>'))
  })
})

describe('formatZil – comment and string handling', () => {
  it('does not count brackets inside ; comments', () => {
    // A `;` comment with angle-brackets must NOT shift the indent of what follows.
    const input = src(
      '<ROUTINE FOO ()',
      ';"comment with <brackets>"',
      '<BAR>>',
    )
    const expected = src(
      '<ROUTINE FOO ()',
      '    ;"comment with <brackets>"',
      '    <BAR>>',
    )
    expect(formatZil(input)).toBe(expected)
  })

  it('does not count brackets inside "strings"', () => {
    // Brackets inside a string literal must NOT affect the bracket depth.
    const input = src('<ROUTINE FOO ()', '<TELL "x < y > (z)" CR>>')
    const expected = src('<ROUTINE FOO ()', '    <TELL "x < y > (z)" CR>>')
    expect(formatZil(input)).toBe(expected)
  })

  it('emits multi-line string continuation lines untouched', () => {
    // The continuation lines of a multi-line string are emitted verbatim.
    // The closing `>` of the <TELL> form (after the closing `"`) is accounted for.
    const input = src(
      '<TELL "Hello',
      'world" CR>',
    )
    // At depth 0; continuation emitted as-is.
    expect(formatZil(input)).toBe(input)
  })

  it('correctly accounts for brackets after a multi-line string closes', () => {
    // In `<ROUTINE … <TELL "…\n…" CR>>`, the closing `>` that ends the TELL form
    // appears on the continuation line. After the string exits, that `>` must be
    // counted so the next statement is indented correctly.
    const input = src(
      '<ROUTINE FOO ()',
      '<TELL "Hello',
      'world" CR>',
      '<BAR>>',
    )
    const expected = src(
      '<ROUTINE FOO ()',
      '    <TELL "Hello',
      'world" CR>',    // continuation — emitted verbatim
      '    <BAR>>',    // back at depth 1, not depth 2
    )
    expect(formatZil(input)).toBe(expected)
  })
})

describe('formatZil – content preservation', () => {
  it('only changes whitespace — non-whitespace characters are never mangled', () => {
    const input = src(
      '<ROUTINE FOO ()',
      '<COND (<VERB? BAR>',
      '<TELL "hello < world >" CR>)>>',
    )
    const strip = (s: string) => s.replace(/\s+/g, '')
    expect(strip(formatZil(input))).toBe(strip(input))
  })
})

describe('formatZil – idempotence', () => {
  it('formatting already-formatted code is a no-op', () => {
    const source = src(
      '<CONSTANT RELEASEID 2>',
      '',
      '<ROUTINE GO ()',
      '    <CRLF> <CRLF>',
      '    <INIT-STATUS-LINE>',
      '    <MAIN-LOOP>>',
    )
    const once = formatZil(source)
    expect(formatZil(once)).toBe(once)
  })

  it('formatting a messy source twice gives the same result as once', () => {
    const messy = src(
      '   <CONSTANT X 42>',
      '',
      '',
      '\t\t<ROUTINE FOO ()',
      '<BAR>>',
    )
    const once = formatZil(messy)
    expect(formatZil(once)).toBe(once)
  })
})

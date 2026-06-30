import { describe, it, expect } from 'vitest'
import { formatI6 } from './format-i6'

// Helper: build a source string from an array of lines (join with \n).
const src = (...lines: string[]) => lines.join('\n')

describe('formatI6 – routine indentation', () => {
  it('indents the body of a [ ] routine one level', () => {
    const input = src('[ Initialise;', 'print "Welcome!";', ']')
    const expected = src('[ Initialise;', '    print "Welcome!";', ']')
    expect(formatI6(input)).toBe(expected)
  })

  it('emits the closing ] at column 0', () => {
    const input = src('[ Foo;', 'return 0;', ']')
    expect(formatI6(input)).toBe(src('[ Foo;', '    return 0;', ']'))
  })

  it('handles an empty routine body', () => {
    const input = src('[ Noop;', ']')
    expect(formatI6(input)).toBe(src('[ Noop;', ']'))
  })
})

describe('formatI6 – nested block indentation', () => {
  it('indents { } blocks inside a routine', () => {
    const input = src(
      '[ Foo;',
      'if (x) {',
      'print "yes";',
      '}',
      ']',
    )
    const expected = src(
      '[ Foo;',
      '    if (x) {',
      '        print "yes";',
      '    }',
      ']',
    )
    expect(formatI6(input)).toBe(expected)
  })

  it('handles } else { with correct depth (net bracket delta is 0)', () => {
    const input = src(
      '[ Foo;',
      'if (x) {',
      'print "yes";',
      '} else {',
      'print "no";',
      '}',
      ']',
    )
    const expected = src(
      '[ Foo;',
      '    if (x) {',
      '        print "yes";',
      '    } else {',
      '        print "no";',
      '    }',
      ']',
    )
    expect(formatI6(input)).toBe(expected)
  })
})

describe('formatI6 – object / class declarations', () => {
  it('indents an Object property block one level under the header', () => {
    const input = src(
      'Object StartRoom "Start Room"',
      'with description "You are here.",',
      'has light;',
    )
    const expected = src(
      'Object StartRoom "Start Room"',
      '    with description "You are here.",',
      '    has light;',
    )
    expect(formatI6(input)).toBe(expected)
  })

  it('works with the Class keyword', () => {
    const input = src('Class Room(20)', 'with name "room",', 'has light;')
    const expected = src('Class Room(20)', '    with name "room",', '    has light;')
    expect(formatI6(input)).toBe(expected)
  })

  it('works with the Nearby keyword', () => {
    const input = src('Nearby key "small key"', 'with name "key",', 'has scored;')
    const expected = src('Nearby key "small key"', '    with name "key",', '    has scored;')
    expect(formatI6(input)).toBe(expected)
  })

  it('treats a custom-class instance (e.g. Room) as an object header', () => {
    const input = src(
      'Room StartRoom "Starting Room"',
      'with description "An empty room.",',
      'has light;',
    )
    const expected = src(
      'Room StartRoom "Starting Room"',
      '    with description "An empty room.",',
      '    has light;',
    )
    expect(formatI6(input)).toBe(expected)
  })

  it('does NOT treat a directive (Constant, Include, etc.) as an object header', () => {
    // "Constant Story" matches INSTANCE_RE but is listed in DIRECTIVE_RE → no indent
    const input = src('Constant Story "My Game";', 'Include "Parser";')
    expect(formatI6(input)).toBe(input)
  })

  it('skips object mode for a one-liner object (ends with ; on the same line)', () => {
    const input = 'Object box "box" with name "box", has container;'
    // Single line, ends with semicolon → stays at column 0, no object mode
    expect(formatI6(input)).toBe(input)
  })
})

describe('formatI6 – blank line collapsing', () => {
  it('collapses multiple consecutive blank lines into one', () => {
    const input = src('Global x = 0;', '', '', 'Global y = 0;')
    expect(formatI6(input)).toBe(src('Global x = 0;', '', 'Global y = 0;'))
  })

  it('drops leading blank lines', () => {
    const input = src('', '', 'Global x = 0;')
    expect(formatI6(input)).toBe('Global x = 0;')
  })

  it('drops a trailing blank line', () => {
    const input = src('Global x = 0;', '')
    expect(formatI6(input)).toBe('Global x = 0;')
  })

  it('preserves exactly one blank line between sections', () => {
    const input = src(
      '[ Foo;', 'return 0;', ']',
      '',
      '[ Bar;', 'return 1;', ']',
    )
    const expected = src(
      '[ Foo;', '    return 0;', ']',
      '',
      '[ Bar;', '    return 1;', ']',
    )
    expect(formatI6(input)).toBe(expected)
  })
})

describe('formatI6 – whitespace handling', () => {
  it('converts leading tabs to the indent-space equivalent', () => {
    const input = src('[ Foo;', '\tprint "hi";', ']')
    expect(formatI6(input)).toBe(src('[ Foo;', '    print "hi";', ']'))
  })

  it('trims trailing whitespace on code lines', () => {
    const input = '[ Foo;   '
    // trailing spaces stripped; single-line routine (no body), formatter outputs at level 0
    expect(formatI6(input)).toBe('[ Foo;')
  })

  it('respects a custom indent size', () => {
    const input = src('[ Foo;', 'print x;', ']')
    expect(formatI6(input, 2)).toBe(src('[ Foo;', '  print x;', ']'))
  })
})

describe('formatI6 – comment and string handling', () => {
  it('does not count brackets inside ! comments', () => {
    const input = src('! Opens [brackets] in comment', '[ Foo;', 'print 0;', ']')
    const expected = src('! Opens [brackets] in comment', '[ Foo;', '    print 0;', ']')
    expect(formatI6(input)).toBe(expected)
  })

  it('does not count brackets inside "strings"', () => {
    const input = src('[ Foo;', 'print "This [bracket] in string";', ']')
    const expected = src('[ Foo;', '    print "This [bracket] in string";', ']')
    expect(formatI6(input)).toBe(expected)
  })

  it('does not count brackets inside single-quoted char literals', () => {
    const input = src("[ Foo;", "if (c == '[') {", "print 0;", "}", "]")
    // The '[' is a char literal → bracket depth is not affected by it
    const expected = src("[ Foo;", "    if (c == '[') {", "        print 0;", "    }", "]")
    expect(formatI6(input)).toBe(expected)
  })
})

describe('formatI6 – idempotence', () => {
  it('formatting already-formatted code is a no-op', () => {
    const once = formatI6(src(
      '[ Initialise;',
      '    location = StartRoom;',
      '];',
      '',
      'Object StartRoom "Starting Room"',
      '    with description "An empty room.",',
      '    has light;',
    ))
    expect(formatI6(once)).toBe(once)
  })

  it('formatting a routine twice gives the same result as once', () => {
    const messy = src(
      '   [ Greet;',
      '\t\tprint "Hello";',
      '   ]',
    )
    const once = formatI6(messy)
    expect(formatI6(once)).toBe(once)
  })
})

describe('formatI6 – multi-statement / realistic snippets', () => {
  it('formats a realistic short I6 program', () => {
    const input = src(
      'Constant Story "Demo";',
      '',
      '',
      'Include "Parser";',
      '',
      '[ Initialise;',
      'location = StartRoom;',
      '];',
      '',
      'Object StartRoom "Start Room"',
      'with description "A plain room.",',
      'has light;',
    )
    const out = formatI6(input)
    // Blank-line collapses: two → one
    expect(out).toContain('Constant Story "Demo";\n\nInclude "Parser";')
    // Routine body is indented
    expect(out).toContain('    location = StartRoom;')
    // Object body is indented
    expect(out).toContain('    with description "A plain room.",')
    expect(out).toContain('    has light;')
  })
})

import { describe, it, expect } from 'vitest'
import { parseDiagnostics, parseStats } from './parse-diagnostics'

describe('parseDiagnostics – LINE_RE format', () => {
  it('parses a line-numbered error', () => {
    const { diagnostics } = parseDiagnostics(
      'line 6: Error:  Expected directive, "[" or class name but found x',
    )
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]).toMatchObject({
      line: 6,
      severity: 'error',
      message: 'Expected directive, "[" or class name but found x',
    })
    expect(diagnostics[0]!.file).toBeUndefined()
  })

  it('parses a line-numbered warning', () => {
    const { diagnostics } = parseDiagnostics(
      'line 12: Warning:  String may be unterminated',
    )
    expect(diagnostics[0]).toMatchObject({ line: 12, severity: 'warning' })
  })

  it('parses a line-numbered Fatal error', () => {
    const { diagnostics } = parseDiagnostics(
      'line 3: Fatal error:  Too many errors',
    )
    expect(diagnostics[0]).toMatchObject({ line: 3, severity: 'fatal' })
  })
})

describe('parseDiagnostics – FILE_LINE_RE format', () => {
  it('parses a file+line error (Inform 6 format)', () => {
    const { diagnostics } = parseDiagnostics(
      "story.inf(42): Error:  Expected ';' but found 'rock'",
    )
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]).toMatchObject({
      file: 'story.inf',
      line: 42,
      severity: 'error',
      message: "Expected ';' but found 'rock'",
    })
  })

  it('parses a warning from a filename with a path', () => {
    const { diagnostics } = parseDiagnostics('/lib/std/parser.h(100): Warning:  Deprecated usage')
    expect(diagnostics[0]).toMatchObject({
      file: '/lib/std/parser.h',
      line: 100,
      severity: 'warning',
    })
  })
})

describe('parseDiagnostics – BARE_RE format (no line number)', () => {
  it('parses a bare Fatal error', () => {
    const { diagnostics, errorCount } = parseDiagnostics(
      "Fatal error: Couldn't open source file",
    )
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]).toMatchObject({
      severity: 'fatal',
      message: "Couldn't open source file",
    })
    expect(diagnostics[0]!.line).toBeUndefined()
    expect(errorCount).toBe(1)
  })

  it('parses a bare Warning', () => {
    const { diagnostics } = parseDiagnostics('Warning: Obsolete usage')
    expect(diagnostics[0]).toMatchObject({ severity: 'warning', message: 'Obsolete usage' })
  })

  it('parses a bare Error', () => {
    const { diagnostics } = parseDiagnostics('Error: Unknown directive')
    expect(diagnostics[0]).toMatchObject({ severity: 'error', message: 'Unknown directive' })
  })
})

describe('parseDiagnostics – summary line', () => {
  it('uses the summary error count when present', () => {
    const raw = [
      'line 6: Error:  Expected something',
      'line 7: Error:  Another problem',
      'Compiled with 2 errors',
    ].join('\n')
    const { errorCount } = parseDiagnostics(raw)
    expect(errorCount).toBe(2)
  })

  it('summary overrides the counted diagnostic total', () => {
    // 2 errors and 1 warning in diagnostics, but summary says 3
    const raw = [
      'line 1: Error:  Foo',
      'line 2: Error:  Bar',
      'line 3: Warning:  Baz',
      'Compiled with 3 errors',
    ].join('\n')
    const { errorCount } = parseDiagnostics(raw)
    expect(errorCount).toBe(3)
  })

  it('counts non-warning diagnostics when there is no summary line', () => {
    const raw = ['line 1: Error:  Foo', 'line 2: Warning:  Bar'].join('\n')
    const { errorCount } = parseDiagnostics(raw)
    expect(errorCount).toBe(1)
  })
})

describe('parseDiagnostics – noise filtering', () => {
  it('skips blank lines', () => {
    const { diagnostics } = parseDiagnostics('\n\nline 1: Error:  Oops\n\n')
    expect(diagnostics).toHaveLength(1)
  })

  it('skips lines that start with > (source-echo lines)', () => {
    const raw = '> Global x;\nline 1: Error:  Something'
    const { diagnostics } = parseDiagnostics(raw)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]!.message).toBe('Something')
  })

  it('ignores unrecognized lines without producing spurious diagnostics', () => {
    const raw = [
      'Inform 6 compiler, version 6.44',
      'line 2: Error:  Oops',
      'Compiled with 1 error',
    ].join('\n')
    const { diagnostics } = parseDiagnostics(raw)
    expect(diagnostics).toHaveLength(1)
  })
})

describe('parseDiagnostics – multiple diagnostics & CRLF', () => {
  it('returns diagnostics in order across several lines', () => {
    const raw = [
      'line 3: Error:  E1',
      'line 7: Warning:  W1',
      'line 10: Error:  E2',
    ].join('\n')
    const { diagnostics } = parseDiagnostics(raw)
    expect(diagnostics).toHaveLength(3)
    expect(diagnostics[0]!.line).toBe(3)
    expect(diagnostics[1]!.line).toBe(7)
    expect(diagnostics[2]!.line).toBe(10)
  })

  it('handles Windows CRLF line endings', () => {
    const raw = 'line 1: Error:  Foo\r\nline 2: Warning:  Bar\r\n'
    const { diagnostics } = parseDiagnostics(raw)
    expect(diagnostics).toHaveLength(2)
  })

  it('returns zero errorCount and empty diagnostics for empty input', () => {
    const { diagnostics, errorCount } = parseDiagnostics('')
    expect(diagnostics).toHaveLength(0)
    expect(errorCount).toBe(0)
  })
})

describe('parseStats', () => {
  it('parses readable-memory stats', () => {
    const stats = parseStats('12345 bytes readable memory used (maximum 65536)')
    expect(stats).toEqual({ readableMem: 12345, readableMax: 65536 })
  })

  it('parses Z-machine memory stats', () => {
    const stats = parseStats('10000 bytes used in Z-machine 55536 bytes free')
    expect(stats).toEqual({ zUsed: 10000, zFree: 55536 })
  })

  it('returns an empty object for unrecognized input', () => {
    expect(parseStats('')).toEqual({})
    expect(parseStats('Inform 6 compiler output')).toEqual({})
  })

  it('parses combined stats output (both patterns on different lines)', () => {
    const raw = [
      '12345 bytes readable memory used (maximum 65536)',
      '10000 bytes used in Z-machine 55536 bytes free',
    ].join('\n')
    const stats = parseStats(raw)
    expect(stats.readableMem).toBe(12345)
    expect(stats.readableMax).toBe(65536)
    expect(stats.zUsed).toBe(10000)
    expect(stats.zFree).toBe(55536)
  })
})

/**
 * Unit tests for the ZILF diagnostic string parser.
 *
 * The actual diagnostic format was discovered by running test-smoke.mjs against
 * the committed public/zilf/_framework bundle.  The real string produced by ZILF
 * for a broken source is:
 *
 *   "/game.zil:2: error ZIL0122: unrecognized routine or instruction: UNDEFINED-FUNCTION"
 *
 * Pattern: <file>:<line>: <severity> <CODE>: <message>
 *
 * ENVIRONMENT: node (default per vitest.config.ts)
 */
import { describe, it, expect } from 'vitest'
import { parseZilDiagnostics } from './zil-diagnostics'

describe('parseZilDiagnostics — file:line format (the real ZILF output)', () => {
  it('parses the exact string produced by the committed bundle for an undefined routine', () => {
    const diags = parseZilDiagnostics([
      '/game.zil:2: error ZIL0122: unrecognized routine or instruction: UNDEFINED-FUNCTION',
    ])

    expect(diags).toHaveLength(1)
    expect(diags[0]).toMatchObject({
      severity: 'error',
      line: 2,
      file: '/game.zil',
    })
    // The message should include the ZIL code and the human text.
    expect(diags[0]!.message).toContain('ZIL0122')
    expect(diags[0]!.message).toContain('UNDEFINED-FUNCTION')
  })

  it('parses an error on line 5', () => {
    const diags = parseZilDiagnostics([
      '/game.zil:5: error ZIL0001: some error message here',
    ])
    expect(diags[0]).toMatchObject({ severity: 'error', line: 5, file: '/game.zil' })
    expect(diags[0]!.message).toContain('ZIL0001')
    expect(diags[0]!.message).toContain('some error message here')
  })

  it('parses a warning diagnostic', () => {
    const diags = parseZilDiagnostics([
      '/game.zil:10: warning ZIL0200: unused variable FOO',
    ])
    expect(diags[0]).toMatchObject({ severity: 'warning', line: 10 })
  })

  it('parses multiple diagnostics in order', () => {
    const diags = parseZilDiagnostics([
      '/game.zil:3: error ZIL0010: first error',
      '/game.zil:7: warning ZIL0020: some warning',
      '/game.zil:12: error ZIL0030: another error',
    ])
    expect(diags).toHaveLength(3)
    expect(diags[0]!.line).toBe(3)
    expect(diags[0]!.severity).toBe('error')
    expect(diags[1]!.line).toBe(7)
    expect(diags[1]!.severity).toBe('warning')
    expect(diags[2]!.line).toBe(12)
    expect(diags[2]!.severity).toBe('error')
  })
})

describe('parseZilDiagnostics — graceful degradation (no line number)', () => {
  it('returns line undefined when the string has no line number', () => {
    // A bare message without the file:line: prefix
    const diags = parseZilDiagnostics([
      'error ZIL0099: something went wrong globally',
    ])
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('error')
    expect(diags[0]!.line).toBeUndefined()
    expect(diags[0]!.message).toContain('ZIL0099')
  })

  it('handles a file-only prefix without a line number', () => {
    const diags = parseZilDiagnostics([
      '/game.zil: error ZIL0050: could not open include file',
    ])
    expect(diags[0]!.severity).toBe('error')
    expect(diags[0]!.line).toBeUndefined()
    expect(diags[0]!.message).toContain('ZIL0050')
  })
})

describe('parseZilDiagnostics — edge cases', () => {
  it('returns an empty array for an empty input list', () => {
    expect(parseZilDiagnostics([])).toHaveLength(0)
  })

  it('skips empty / whitespace-only strings', () => {
    const diags = parseZilDiagnostics(['', '   ', '\t'])
    expect(diags).toHaveLength(0)
  })

  it('treats an unrecognized string as an error with the raw text as message', () => {
    const diags = parseZilDiagnostics(['something completely unrecognized'])
    // Should still produce one diagnostic rather than silently dropping it.
    expect(diags).toHaveLength(1)
    expect(diags[0]!.severity).toBe('error')
    expect(diags[0]!.message).toContain('something completely unrecognized')
  })

  it('maps "fatal" severity to "fatal"', () => {
    const diags = parseZilDiagnostics([
      '/game.zil:1: fatal ZIL0001: catastrophic failure',
    ])
    expect(diags[0]!.severity).toBe('fatal')
  })
})

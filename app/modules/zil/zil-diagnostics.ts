import type { Diagnostic, Severity } from '~/modules/inform6/types'

/**
 * Parses an array of raw ZILF diagnostic strings into the shared Diagnostic
 * shape (same type used by the Inform 6 path) so the editor's click-to-jump
 * and Results panel work identically for both languages.
 *
 * The real ZILF diagnostic format (observed from the committed bundle):
 *
 *   /game.zil:2: error ZIL0122: unrecognized routine or instruction: UNDEFINED-FUNCTION
 *
 * Pattern: <file>:<line>: <severity> <CODE>: <message text>
 *
 * When a string does not match the full pattern the parser degrades gracefully:
 * bare `<severity> <CODE>: <msg>` is accepted (no file/line), and completely
 * unrecognized strings are surfaced as errors with the raw text as the message
 * rather than silently dropped.
 */

// Full format: /path/file.zil:42: error ZIL0122: human message
// Captures: [file, line, severity, code+message]
const FILE_LINE_RE = /^(.+?):(\d+):\s*(error|warning|fatal|note|info)\s+((?:[A-Z]+\d+):\s*.+)$/

// Bare format without file or line: error ZIL0122: human message
const BARE_RE = /^(error|warning|fatal|note|info)\s+((?:[A-Z]+\d+):\s*.+)$/

// File-only prefix without a line number: /path/file.zil: error ZIL0050: message
const FILE_ONLY_RE = /^(.+?):\s*(error|warning|fatal|note|info)\s+((?:[A-Z]+\d+):\s*.+)$/

function toSeverity(raw: string): Severity {
  if (raw === 'warning' || raw === 'note') return 'warning'
  if (raw === 'fatal') return 'fatal'
  return 'error'
}

/**
 * Converts an array of raw ZILF diagnostic strings (from `ZilfExports.Compile`)
 * into structured `Diagnostic` objects that match the Inform 6 `CompileResult`
 * shape exactly.
 *
 * @param raw - The `diagnostics` array from the ZILF JSON result.
 * @returns An array of `Diagnostic` objects, one per non-empty input string.
 */
export function parseZilDiagnostics(raw: string[]): Diagnostic[] {
  const result: Diagnostic[] = []

  for (const line of raw) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Try the most specific pattern first: file + line number.
    const flm = FILE_LINE_RE.exec(trimmed)
    if (flm) {
      result.push({
        file: flm[1],
        line: Number(flm[2]),
        severity: toSeverity(flm[3] ?? ''),
        message: flm[4] ?? '',
      })
      continue
    }

    // Try bare severity (no file, no line).
    const bm = BARE_RE.exec(trimmed)
    if (bm) {
      result.push({
        severity: toSeverity(bm[1] ?? ''),
        message: bm[2] ?? '',
      })
      continue
    }

    // Try file-only prefix (no line).
    const fm = FILE_ONLY_RE.exec(trimmed)
    if (fm) {
      result.push({
        file: fm[1],
        severity: toSeverity(fm[2] ?? ''),
        message: fm[3] ?? '',
      })
      continue
    }

    // Unrecognized format — surface as an error with the raw text so nothing
    // is silently lost.
    result.push({ severity: 'error', message: trimmed })
  }

  return result
}

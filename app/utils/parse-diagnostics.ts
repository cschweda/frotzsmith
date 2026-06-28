import type { Diagnostic, Severity, CompileStats } from '~/modules/inform6/types'

// Inform 6.44: "line 6: Error:  Expected directive, '[' or class name but found x"
const LINE_RE = /^line (\d+):\s*(Error|Warning|Fatal error):\s*(.*)$/
// Older / alternate format: "story.inf(42): Error:  Expected ';' but found 'rock'"
const FILE_LINE_RE = /^(.*?)\((\d+)\):\s*(Error|Warning|Fatal error)(?:\s*\([^)]*\))?:\s*(.*)$/
// "Fatal error: Couldn't open source file ..." (no line)
const BARE_RE = /^(Error|Warning|Fatal error):\s*(.*)$/
// "Compiled with 1 error (and 2 warnings)"
const SUMMARY_RE = /Compiled with (\d+) error/i

function toSeverity(label: string): Severity {
  if (label === 'Warning') return 'warning'
  if (label === 'Fatal error') return 'fatal'
  return 'error'
}

export interface ParsedDiagnostics {
  diagnostics: Diagnostic[]
  /** Errors + fatals (used to decide compile success). */
  errorCount: number
}

/**
 * Parses Inform 6 compiler output into structured diagnostics. The compiler's
 * format is stable and line-oriented; anything unrecognized is left to the raw
 * output toggle rather than guessed at.
 */
export function parseDiagnostics(raw: string): ParsedDiagnostics {
  const diagnostics: Diagnostic[] = []
  let summaryErrors: number | null = null

  for (const rawLine of raw.split(/\r?\n/)) {
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith('>')) continue // skip blanks + source-echo lines

    const m = LINE_RE.exec(trimmed)
    if (m) {
      diagnostics.push({ line: Number(m[1]), severity: toSeverity(m[2]), message: m[3] })
      continue
    }

    const fm = FILE_LINE_RE.exec(trimmed)
    if (fm) {
      diagnostics.push({
        file: fm[1],
        line: Number(fm[2]),
        severity: toSeverity(fm[3]),
        message: fm[4],
      })
      continue
    }

    const b = BARE_RE.exec(trimmed)
    if (b) {
      diagnostics.push({ severity: toSeverity(b[1]), message: b[2] })
      continue
    }

    const s = SUMMARY_RE.exec(trimmed)
    if (s) summaryErrors = Number(s[1])
  }

  const errorCount =
    summaryErrors ?? diagnostics.filter(d => d.severity !== 'warning').length

  return { diagnostics, errorCount }
}

const READABLE_RE = /(\d+)\s+bytes readable memory used \(maximum (\d+)\)/
const ZMEM_RE = /(\d+)\s+bytes used in Z-machine\s+(\d+)\s+bytes free/

/** Parses the compiler's `-s` statistics output into structured stats. */
export function parseStats(raw: string): CompileStats {
  const stats: CompileStats = {}
  const r = READABLE_RE.exec(raw)
  if (r) {
    stats.readableMem = Number(r[1])
    stats.readableMax = Number(r[2])
  }
  const z = ZMEM_RE.exec(raw)
  if (z) {
    stats.zUsed = Number(z[1])
    stats.zFree = Number(z[2])
  }
  return stats
}

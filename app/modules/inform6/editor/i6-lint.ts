import { linter, lintGutter, type Diagnostic as CmDiagnostic } from '@codemirror/lint'
import type { Extension } from '@codemirror/state'

/**
 * A lightweight, live Inform 6 linter that runs as you type. It does fast
 * structural checks the compiler would otherwise only report on a full build —
 * unbalanced routine brackets `[ ]`, braces `{ }`, and an unterminated string.
 * String contents (including multi-line strings) are skipped so they never
 * trigger false positives. The compiler remains the authority for everything
 * else; this is instant feedback, not a second compiler.
 */
function lintSource(text: string): CmDiagnostic[] {
  const diagnostics: CmDiagnostic[] = []
  let routine = 0
  let brace = 0
  let inString = false
  let stringStart = 0

  for (let i = 0; i < text.length; i++) {
    const c = text[i]

    if (inString) {
      if (c === '"') inString = false
      continue
    }
    if (c === '!') {
      // comment to end of line
      while (i < text.length && text[i] !== '\n') i++
      continue
    }
    if (c === '"') {
      inString = true
      stringStart = i
      continue
    }
    if (c === "'") {
      i++
      while (i < text.length && text[i] !== "'") i++
      continue
    }
    if (c === '[') routine++
    else if (c === ']') {
      if (routine === 0)
        diagnostics.push({ from: i, to: i + 1, severity: 'error', message: "Unmatched ']' — no open routine." })
      else routine--
    } else if (c === '{') brace++
    else if (c === '}') {
      if (brace === 0)
        diagnostics.push({ from: i, to: i + 1, severity: 'error', message: "Unmatched '}'." })
      else brace--
    }
  }

  const end = text.length
  if (inString)
    diagnostics.push({ from: stringStart, to: end, severity: 'warning', message: 'Unterminated string — missing closing ".' })
  if (routine > 0)
    diagnostics.push({ from: end, to: end, severity: 'warning', message: `${routine} unclosed routine bracket '[' — missing ']'.` })
  if (brace > 0)
    diagnostics.push({ from: end, to: end, severity: 'warning', message: `${brace} unclosed brace '{'.` })

  return diagnostics
}

/** The Inform 6 live-linter extensions (gutter markers + underlines). */
export function i6Lint(): Extension {
  return [
    lintGutter(),
    linter(view => lintSource(view.state.doc.toString()), { delay: 400 }),
  ]
}

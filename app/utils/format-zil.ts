/**
 * ZIL source formatter ("prettify"). Re-indents by bracket depth:
 *   - `<`, `(`, `[` increase depth; `>`, `)`, `]` decrease depth.
 *   - A line that STARTS with a closer (`>`, `)`, `]`) is emitted one level up.
 *
 * It never touches the inside of strings (ZIL strings can span lines, so those
 * lines are emitted exactly as written), trims trailing whitespace on code
 * lines, and converts leading tabs to spaces. The result is undoable in the
 * editor with one Cmd/Ctrl+Z.
 *
 * ZIL is whitespace-insensitive outside strings, so re-indenting is always
 * semantically safe — only leading/trailing whitespace ever changes.
 *
 * Comment approximation: a `;` that is not inside a string is treated as
 * starting a comment to end-of-line. This matches the ZIL editor mode and is
 * correct for the most common patterns (`;ATOM`, `;"string comment"`, bare `;`).
 */

interface Scan {
  delta: number
  inString: boolean
}

/** Net bracket change on a line, ignoring strings and `;` comments. */
function scan(text: string, startInString: boolean): Scan {
  let inString = startInString
  let delta = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (c === '"') inString = false
      continue
    }
    if (c === ';') {
      // `;` comments out the next datum. `;"…"` comments a string that may span
      // lines: enter string mode so its continuation lines are tracked and its
      // brackets ignored, then resume normal scanning after the closing quote.
      // Any other `;` (`;ATOM`, `;<form>`, bare `;`) comments to end-of-line.
      const m = /^\s*"/.exec(text.slice(i + 1))
      if (m) {
        i += m[0].length // advance onto the opening quote; the loop's i++ steps inside
        inString = true
        continue
      }
      break
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === '<' || c === '(' || c === '[') delta++
    else if (c === '>' || c === ')' || c === ']') delta--
  }
  return { delta, inString }
}

/** A line whose first non-blank character is a closer (`>`, `)`, `]`) dedents. */
const CLOSER_RE = /^[>)\]]/

export function formatZil(source: string, indentSize = 4): string {
  const unit = ' '.repeat(indentSize)
  const lines = source.split('\n')
  const out: string[] = []

  let bracket = 0
  let inString = false
  let lastBlank = false

  for (const raw of lines) {
    // Continuation lines of a multi-line string are emitted untouched.
    if (inString) {
      out.push(raw)
      const cont = scan(raw, true)
      inString = cont.inString
      // If the string closed on this line, account for any brackets that appear
      // after the closing quote (e.g. the `>` in `…" CR CR>` closing a <TELL>).
      if (!inString) bracket = Math.max(0, bracket + cont.delta)
      lastBlank = false
      continue
    }

    const endsInString = scan(raw.replace(/^[ \t]+/, ''), false).inString
    const trimmedTrailing = endsInString ? raw : raw.replace(/[ \t]+$/, '')
    if (trimmedTrailing.trim() === '') {
      // Collapse runs of blank lines to a single blank; drop leading blanks.
      if (out.length > 0 && !lastBlank) {
        out.push('')
        lastBlank = true
      }
      continue
    }

    const content = trimmedTrailing.replace(/^[ \t]+/, '')

    // Indent = bracket nesting; a line starting with a closer dedents one level.
    const level = CLOSER_RE.test(content) ? bracket - 1 : bracket
    out.push(unit.repeat(Math.max(0, level)) + content)
    lastBlank = false

    // Update structural state.
    const s = scan(content, false)
    bracket = Math.max(0, bracket + s.delta)
    inString = s.inString
  }

  // Drop a trailing blank line.
  if (out.length && out[out.length - 1] === '') out.pop()

  return out.join('\n')
}

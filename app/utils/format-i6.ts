/**
 * Inform 6 source formatter ("prettify"). Re-indents by structural depth:
 *   - routine and block bodies (`[ … ]`, `{ … }`) nest by bracket depth;
 *   - object / class declarations indent their property block (with / has / …)
 *     one level under the header, until the terminating semicolon.
 *
 * It never touches the inside of strings (I6 strings can span lines, so those
 * lines are emitted exactly as written), trims trailing whitespace on code
 * lines, and converts leading tabs to spaces. The result is undoable in the
 * editor with one Cmd/Ctrl+Z.
 */

interface Scan {
  delta: number
  inString: boolean
}

/** Net bracket/brace change on a line, ignoring strings/comments/char-literals. */
function scan(text: string, startInString: boolean): Scan {
  let inString = startInString
  let delta = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (c === '"') inString = false
      continue
    }
    if (c === '!') break // comment to end of line
    if (c === '"') {
      inString = true
      continue
    }
    if (c === "'") {
      i++
      while (i < text.length && text[i] !== "'") i++
      continue
    }
    if (c === '[' || c === '{') delta++
    else if (c === ']' || c === '}') delta--
  }
  return { delta, inString }
}

const OBJ_RE = /^(Object|Class|Nearby)\b/
const CLOSER_RE = /^[\]}]/

export function formatI6(source: string, indentSize = 4): string {
  const unit = ' '.repeat(indentSize)
  const lines = source.split('\n')
  const out: string[] = []

  let bracket = 0 // [ ] and { } nesting
  let inObject = false // inside an Object/Class property block
  let objectBracket = 0 // bracket depth at which the current object started
  let inString = false

  for (const raw of lines) {
    // Continuation lines of a multi-line string are emitted untouched.
    if (inString) {
      out.push(raw)
      inString = scan(raw, true).inString
      continue
    }

    const endsInString = scan(raw.replace(/^[ \t]+/, ''), false).inString
    const trimmedTrailing = endsInString ? raw : raw.replace(/[ \t]+$/, '')
    if (trimmedTrailing.trim() === '') {
      out.push('')
      continue
    }

    const content = trimmedTrailing.replace(/^[ \t]+/, '')

    // Indent = bracket nesting (+1 while inside an object body), closers dedent.
    const base = bracket + (inObject ? 1 : 0)
    const level = CLOSER_RE.test(content) ? base - 1 : base
    out.push(unit.repeat(Math.max(0, level)) + content)

    // Update structural state.
    const s = scan(content, false)
    const endsWithSemicolon = /;\s*$/.test(content.replace(/!.*$/, ''))
    bracket = Math.max(0, bracket + s.delta)
    inString = s.inString

    if (inObject && bracket === objectBracket && endsWithSemicolon) {
      inObject = false // the object's terminating semicolon
    } else if (!inObject && OBJ_RE.test(content)) {
      // Enter object-body mode, unless this is a complete one-line object.
      if (!(endsWithSemicolon && s.delta === 0)) {
        inObject = true
        objectBracket = bracket
      }
    }
  }

  return out.join('\n')
}

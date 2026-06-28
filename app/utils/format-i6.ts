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
// Top-level directives shaped like "<Word> <name>" that are NOT objects.
const DIRECTIVE_RE =
  /^(Constant|Global|Array|Include|Verb|Extend|Attribute|Property|Default|Replace|Import|Link|Lowstring|Message|Stub|Switches|System_file|Trace|Dictionary|Abbreviate|Fake_action|Ifv?def|Ifndef|Ifnot|Iftrue|Iffalse|Endif|Undef|End|Statusline|Zcharacter|Release|Origsource)\b/
// A "<Class> name …" object/instance declaration, including custom classes (e.g. Room).
const INSTANCE_RE = /^[A-Z][A-Za-z0-9_]*\s+[A-Za-z_]/

export function formatI6(source: string, indentSize = 4): string {
  const unit = ' '.repeat(indentSize)
  const lines = source.split('\n')
  const out: string[] = []

  let bracket = 0 // [ ] and { } nesting
  let inObject = false // inside an Object/Class property block
  let objectBracket = 0 // bracket depth at which the current object started
  let inString = false
  let lastBlank = false // last emitted line was a (collapsible) blank

  for (const raw of lines) {
    // Continuation lines of a multi-line string are emitted untouched.
    if (inString) {
      out.push(raw)
      inString = scan(raw, true).inString
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

    // Indent = bracket nesting (+1 while inside an object body), closers dedent.
    const base = bracket + (inObject ? 1 : 0)
    const level = CLOSER_RE.test(content) ? base - 1 : base
    out.push(unit.repeat(Math.max(0, level)) + content)
    lastBlank = false

    // Update structural state.
    const s = scan(content, false)
    const endsWithSemicolon = /;\s*$/.test(content.replace(/!.*$/, ''))
    bracket = Math.max(0, bracket + s.delta)
    inString = s.inString

    // An object header: Object/Class/Nearby, or a top-level "<Class> name …"
    // declaration that isn't a known directive (catches custom classes like Room).
    const isObjectHeader =
      OBJ_RE.test(content) ||
      (bracket === 0 && INSTANCE_RE.test(content) && !DIRECTIVE_RE.test(content))

    if (inObject && bracket === objectBracket && endsWithSemicolon) {
      inObject = false // the object's terminating semicolon
    } else if (!inObject && isObjectHeader) {
      // Enter object-body mode, unless this is a complete one-line object.
      if (!(endsWithSemicolon && s.delta === 0)) {
        inObject = true
        objectBracket = bracket
      }
    }
  }

  // Drop a trailing blank line.
  if (out.length && out[out.length - 1] === '') out.pop()

  return out.join('\n')
}

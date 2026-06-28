/**
 * Conservative Inform 6 "prettify".
 *
 * It trims trailing whitespace and re-indents the bodies of routines `[ … ]` and
 * code blocks `{ … }` by structural depth. It deliberately does NOT touch:
 *   - the inside of strings (I6 strings may span lines — those lines are left
 *     exactly as written, so descriptions never get mangled);
 *   - top-level object/directive indentation (objects rely on convention, not
 *     brackets, so naive re-indenting would flatten them).
 *
 * The result is always undoable in the editor (one Cmd/Ctrl+Z).
 */

interface Scan {
  delta: number
  inString: boolean
}

/** Net bracket/brace depth change on a line, plus whether it ends inside a string. */
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

export function formatI6(source: string, indentSize = 4): string {
  const unit = ' '.repeat(indentSize)
  const lines = source.split('\n')
  const out: string[] = []
  let depth = 0
  let inString = false

  for (const raw of lines) {
    // Lines fully inside a multi-line string are left exactly as written.
    if (inString) {
      out.push(raw)
      inString = scan(raw, true).inString
      continue
    }

    const endsInString = scan(raw.replace(/^[ \t]+/, ''), false).inString
    // Only trim trailing whitespace when the line doesn't end inside a string.
    const trimmedTrailing = endsInString ? raw : raw.replace(/[ \t]+$/, '')

    if (trimmedTrailing.trim() === '') {
      out.push('')
      continue
    }

    const content = trimmedTrailing.replace(/^[ \t]+/, '')

    if (depth > 0) {
      // Routine / block body: re-indent by depth (dedent lines that close one).
      const lineDepth = /^[\]}]/.test(content) ? Math.max(0, depth - 1) : depth
      out.push(unit.repeat(lineDepth) + content)
    } else {
      // Top level: keep the author's indentation, just convert leading tabs.
      const lead = trimmedTrailing.match(/^[ \t]*/)?.[0] ?? ''
      out.push(lead.replace(/\t/g, unit) + content)
    }

    const s = scan(content, false)
    depth = Math.max(0, depth + s.delta)
    inString = s.inString
  }

  return out.join('\n')
}

/**
 * Parse author script text into a command list (doc 04 §2.1). Lenient on
 * purpose so a long test reads naturally:
 *  - newline- and/or period-separated,
 *  - `!` lines are comments (kept in the editor, ignored here),
 *  - blank/empty segments ignored,
 *  - a leading `> ` is stripped (so a pasted transcript round-trips).
 */
export function parseScript(text: string): string[] {
  const out: string[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('!')) continue
    for (const seg of line.split('.')) {
      const cmd = seg.trim().replace(/^>\s*/, '').trim()
      if (cmd) out.push(cmd)
    }
  }
  return out
}

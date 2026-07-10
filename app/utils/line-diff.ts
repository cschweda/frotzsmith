/**
 * Minimal LCS line diff for the Skein's blessed-vs-current view.
 *
 * Presentation only: whether a node IS a regression is decided by exact
 * string equality in skein-tree; this renders where the texts diverge.
 * Inputs are single turn outputs (small), so the O(n·m) DP table is fine.
 */

export type DiffLine = { type: 'same' | 'add' | 'del'; text: string }

function toLines(s: string): string[] {
  // A single trailing newline is formatting, not content.
  const trimmed = s.endsWith('\n') ? s.slice(0, -1) : s
  return trimmed === '' ? [] : trimmed.split('\n')
}

/** Diff `before` (blessed) against `after` (current). */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = toLines(before)
  const b = toLines(after)

  // LCS length table.
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }

  // Walk the table emitting del (blessed-only) before add (current-only).
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i]! })
      i++
      j++
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ type: 'del', text: a[i]! })
      i++
    } else {
      out.push({ type: 'add', text: b[j]! })
      j++
    }
  }
  while (i < m) out.push({ type: 'del', text: a[i++]! })
  while (j < n) out.push({ type: 'add', text: b[j++]! })
  return out
}

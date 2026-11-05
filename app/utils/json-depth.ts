/**
 * Whether a parsed JSON value nests arrays/objects more than `limit` levels
 * deep (the value itself is level 1). Iterative, and stops as soon as the
 * limit is passed: a 200,000-deep array would otherwise break
 * structuredClone / JSON.stringify later, far from the cause.
 */
export function exceedsDepth(value: unknown, limit: number): boolean {
  const stack: [unknown, number][] = [[value, 1]]
  while (stack.length) {
    const [v, depth] = stack.pop()!
    if (typeof v !== 'object' || v === null) continue
    if (depth > limit) return true
    for (const child of Array.isArray(v) ? v : Object.values(v)) {
      if (typeof child === 'object' && child !== null) stack.push([child, depth + 1])
    }
  }
  return false
}

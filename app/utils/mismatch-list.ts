import { displayPath } from '~/project-package/errors'
import { pathProblem } from '~/project-package/paths'

/** "a, b, c" for up to `max` names, then "and N more". Names come from an
 *  untrusted manifest, so the list is capped to keep the toast readable. */
export function formatNameList(names: readonly string[], max = 5): string {
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`
}

/** Hash-mismatch keys fit to quote: only safe package paths (anything else
 *  can't name a file in the package), each made display-safe and shortened. */
export function mismatchNames(names: readonly string[]): string[] {
  return names.filter(n => pathProblem(n) === null).map(n => displayPath(n, 60))
}

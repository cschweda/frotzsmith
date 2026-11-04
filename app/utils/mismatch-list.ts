/** "a, b, c" for up to `max` names, then "and N more". Names come from an
 *  untrusted manifest, so the list is capped to keep the toast readable. */
export function formatNameList(names: readonly string[], max = 5): string {
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`
}

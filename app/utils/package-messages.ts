/**
 * The sentences the toolbar shows for `.frotzsmith` Open / Download. Pure, so
 * the routing (which error text the user sees, singular vs plural) is tested
 * without mounting the toolbar.
 */
import { PackageError } from '~/project-package/errors'
import { ZipLimitError } from '~/utils/zip-limits'

export const OPEN_FAILED = 'That file couldn’t be read as a Frotzsmith project.'
export const DOWNLOAD_FAILED = 'Something went wrong building the .frotzsmith file.'

/** A refusal's own one-sentence message when it has one; else `fallback`
 *  (an unexpected error's text is never shown). */
export function refusalSentence(err: unknown, fallback: string): string {
  return err instanceof PackageError || err instanceof ZipLimitError ? err.message : fallback
}

/** The "Project opened" toast's notes. */
export function openedNotes(p: { hiddenCount: number; ignored: readonly string[]; skeinNotOpened: string | null }): string[] {
  const notes: string[] = []
  // An unopened Skein is kept as a hidden file, but gets its own line.
  const hidden = p.hiddenCount - (p.skeinNotOpened !== null ? 1 : 0)
  if (hidden === 1) {
    notes.push("1 file in this project isn't shown here — it's kept and included when you download it.")
  } else if (hidden > 1) {
    notes.push(`${hidden} files in this project aren't shown here — they're kept and included when you download it.`)
  }
  if (p.skeinNotOpened !== null) {
    notes.push("The project's Skein couldn't be opened; it was kept and will be included when you download.")
  }
  if (p.ignored.length > 0) notes.push('Compiled story files in the package were ignored — compile to rebuild them.')
  return notes
}

/** "a", "a and b", "a, b and c". */
export function joinPhrases(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

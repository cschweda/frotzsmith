/**
 * The sentences the toolbar shows for `.frotzsmith` Open / Download. Pure, so
 * the routing (which error text the user sees, singular vs plural) is tested
 * without mounting the toolbar.
 */
import { PackageError } from '~/project-package/errors'
import { ZipLimitError } from '~/utils/zip-limits'
import { displayPath } from '~/project-package/errors'
import { formatNameList } from '~/utils/mismatch-list'

export const OPEN_FAILED = 'That file couldn’t be read as a Frotzsmith project.'
export const DOWNLOAD_FAILED = 'Something went wrong building the .frotzsmith file.'

/** A refusal's own one-sentence message when it has one; else `fallback`
 *  (an unexpected error's text is never shown). */
export function refusalSentence(err: unknown, fallback: string): string {
  return err instanceof PackageError || err instanceof ZipLimitError ? err.message : fallback
}

/** Untrusted names, display-safe, quoted and capped: “a”, “b” and 3 more. */
const names = (list: readonly string[]) => formatNameList(list.map(n => displayPath(n)))

/** The open dialog's notes: the extensions a package installs or enables
 *  (they reach every Inform 6 game, not just this one) and the files it
 *  carries that the IDE doesn't show. */
export function openDialogNotes(p: { extensions: readonly string[]; hiddenNames: readonly string[] }): string[] {
  const notes: string[] = []
  const e = p.extensions.length
  if (e > 0) {
    notes.push(`It adds ${e === 1 ? 'an extension' : `${e} extensions`} used by every Inform 6 game in this browser: ${names(p.extensions)}.`)
  }
  const h = p.hiddenNames.length
  if (h > 0) {
    notes.push(`It carries ${h === 1 ? 'a file' : `${h} files`} Frotzsmith doesn’t show, kept and included when you download: ${names(p.hiddenNames)}.`)
  }
  return notes
}

/** The download toast's note when the package carries hidden files, else null. */
export function downloadedNote(hidden: readonly string[]): string | null {
  const h = hidden.length
  if (h === 0) return null
  return `It includes ${h === 1 ? 'a file' : `${h} files`} Frotzsmith doesn’t show: ${names(hidden)}.`
}

/** The "Project opened" toast's notes. */
export function openedNotes(p: {
  hiddenCount: number
  ignored: readonly string[]
  skeinNotOpened: string | null
  /** The hidden files' names (without the unopened Skein), when known. */
  hiddenNames?: readonly string[]
  /** Extensions the open installed or enabled. */
  extensions?: readonly string[]
}): string[] {
  const notes: string[] = []
  // An unopened Skein is kept as a hidden file, but gets its own line.
  const hidden = p.hiddenCount - (p.skeinNotOpened !== null ? 1 : 0)
  const listed = p.hiddenNames?.length ? `: ${names(p.hiddenNames)}.` : '.'
  if (hidden === 1) {
    notes.push(`1 file in this project isn't shown here — it's kept and included when you download it${listed}`)
  } else if (hidden > 1) {
    notes.push(`${hidden} files in this project aren't shown here — they're kept and included when you download it${listed}`)
  }
  if (p.extensions?.length) notes.push(`Extensions added for every Inform 6 game in this browser: ${names(p.extensions)}.`)
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

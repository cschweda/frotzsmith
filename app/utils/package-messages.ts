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
export function openDialogNotes(p: {
  extensions: readonly string[]
  hiddenNames: readonly string[]
  /** ZIL: the extra `.zil` files the project brings (this project only). */
  sourceFiles?: readonly string[]
}): string[] {
  const notes: string[] = []
  const e = p.extensions.length
  if (e > 0) {
    notes.push(`It adds ${e === 1 ? 'an extension' : `${e} extensions`} used by every Inform 6 game in this browser: ${names(p.extensions)}.`)
  }
  const s = p.sourceFiles?.length ?? 0
  if (s > 0) notes.push(`It adds ${s === 1 ? 'a source file' : `${s} source files`}: ${names(p.sourceFiles!)}.`)
  const h = p.hiddenNames.length
  if (h > 0) {
    notes.push(`It carries ${h === 1 ? 'a file' : `${h} files`} Frotzsmith doesn’t show, kept and included when you download: ${names(p.hiddenNames)}.`)
  }
  return notes
}

/** The download toast's note: the hidden files the package carries and the
 *  files it had to leave out (kept in this browser), or null when neither. */
export function downloadedNote(hidden: readonly string[], leftOut: readonly string[] = []): string | null {
  const notes: string[] = []
  const h = hidden.length
  if (h > 0) notes.push(`It includes ${h === 1 ? 'a file' : `${h} files`} Frotzsmith doesn’t show: ${names(hidden)}.`)
  const l = leftOut.length
  if (l > 0) {
    notes.push(`It leaves out ${l === 1 ? 'a file whose name' : `${l} files whose names`} a project can’t hold, kept in this browser: ${names(leftOut)}.`)
  }
  return notes.length ? notes.join(' ') : null
}

/** The download toast's note for uploads saved under a new name (a Windows
 *  device name gets `_`): their Include line needs updating after reopening. */
export function renamedNote(renamed: readonly { from: string; to: string }[]): string | null {
  const n = renamed.length
  if (n === 0) return null
  const q = (s: string) => `“${displayPath(s)}”`
  if (n === 1) {
    return `${q(renamed[0]!.from)} is saved as ${q(renamed[0]!.to)} — Windows can’t hold that name; update its Include line after reopening.`
  }
  const shown = renamed.slice(0, 5).map(r => `${q(r.from)} as ${q(r.to)}`).join(', ')
  const more = n > 5 ? ` and ${n - 5} more` : ''
  return `${n} extensions are saved under names Windows can hold (${shown}${more}); update their Include lines after reopening.`
}

/** The one-time note for uploads stored before audit F1 that are named like
 *  a library file: the library now wins, so they aren't used. Null when none. */
export function libraryNamedNote(files: readonly string[]): string | null {
  if (files.length === 0) return null
  const one = files.length === 1
  return one
    ? `${names(files)} has the same name as a library file, so it no longer replaces the standard library and isn’t used when you compile. It stays in this browser but is left out of project downloads; to use it, upload it again under another name.`
    : `${names(files)} have the same names as library files, so they no longer replace the standard library and aren’t used when you compile. They stay in this browser but are left out of project downloads; to use them, upload them again under other names.`
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
  /** ZIL: the extra `.zil` files the open added. */
  sourceFiles?: readonly string[]
}): string[] {
  const notes: string[] = []
  const s = p.sourceFiles?.length ?? 0
  if (s > 0) notes.push(`It added ${s === 1 ? 'a source file' : `${s} source files`}: ${names(p.sourceFiles!)}.`)
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

/** What a plain open or a share link would take from a ZIL project with extra
 *  files: “the project’s other .zil file” / “the project’s 3 other .zil files”. */
export function otherZilFilesPhrase(count: number): string {
  return count === 1 ? 'the project’s other .zil file' : `the project’s ${count} other .zil files`
}

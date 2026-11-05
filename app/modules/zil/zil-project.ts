import { pathProblem, pathKey } from '~/project-package/paths'
import { quotedPath } from '~/project-package/errors'

/** One extra `.zil` file of a ZIL project (path is project-relative, e.g. `lib/rooms.zil`). */
export type ZilProjectFile = { path: string; text: string }

/** The name the main file gets in the compile when the caller gives none. */
export const ZIL_DEFAULT_MAIN_PATH = 'story.zil'

/**
 * The `{ path: text }` file set the worker compiles: the main file plus the
 * extra files. The main file always wins a name clash with an extra file.
 */
export function buildZilFileSet(
  source: string,
  mainPath: string,
  files: ZilProjectFile[] = [],
): Record<string, string> {
  const set: Record<string, string> = {}
  for (const f of files) set[f.path] = f.text
  set[mainPath] = source
  return set
}

/** Limits for a project's extra ZIL files (UTF-16 length, as `planUploaded` measures). */
export const ZIL_FILES_MAX_COUNT = 100
export const ZIL_FILE_MAX_CHARS = 1024 * 1024
export const ZIL_FILES_TOTAL_MAX_CHARS = 4 * 1024 * 1024

/**
 * Whether `files` can be a project's extra files next to `mainPath`: at most
 * 100 files, each at most 1 MiB, 4 MiB in all; every path safe, ending in
 * `.zil`, and distinct (by `pathKey`) from the main file and from each other.
 */
export function planZilFiles(
  files: ZilProjectFile[],
  mainPath: string,
): { ok: true } | { ok: false; message: string } {
  const refuse = (message: string) => ({ ok: false as const, message })
  if (files.length > ZIL_FILES_MAX_COUNT) {
    return refuse(`A project can have at most ${ZIL_FILES_MAX_COUNT} extra ZIL files.`)
  }
  const seen = new Map<string, string>([[pathKey(mainPath), mainPath]])
  let total = 0
  for (const f of files) {
    const problem = pathProblem(f.path)
    if (problem !== null) return refuse(`${quotedPath(f.path)} can't be used as a ZIL file name: ${problem}.`)
    if (!/\.zil$/i.test(f.path)) return refuse(`${quotedPath(f.path)} isn't a ZIL file: its name must end in .zil.`)
    if (f.text.length > ZIL_FILE_MAX_CHARS) {
      return refuse(`${quotedPath(f.path)} is larger than the 1 MB the browser editor can keep for one ZIL file.`)
    }
    total += f.text.length
    const key = pathKey(f.path)
    const other = seen.get(key)
    if (other !== undefined) {
      return refuse(
        other === mainPath
          ? `${quotedPath(f.path)} has the same name as the main file.`
          : `${quotedPath(other)} and ${quotedPath(f.path)} have names the browser editor can't keep apart.`,
      )
    }
    seen.set(key, f.path)
  }
  if (total > ZIL_FILES_TOTAL_MAX_CHARS) {
    return refuse("This project's extra ZIL files are larger than the 4 MB the browser editor can keep.")
  }
  return { ok: true }
}

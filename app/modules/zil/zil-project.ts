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

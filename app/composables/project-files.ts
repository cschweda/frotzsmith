/**
 * Pure, framework-free logic for the file explorer. No Vue/Nuxt auto-imports
 * live here so it can be unit-tested directly with Vitest; the `useProjectFiles`
 * composable wraps these functions with reactive state and the backing stores.
 */
import { pathKey } from '~/project-package/paths'

export interface ProjectFileMeta {
  id: string
  /** Display/Include filename, e.g. `story.inf`, `ordinals.h`, `Parser.h`. */
  name: string
  group: 'project' | 'library'
  editable: boolean
}

/** The explorer id of the game's solution file. */
export const SOLUTION_ID = 'solution'

const baseName = (path: string) => path.split('/').pop() ?? path
const hasUpper = (s: string) => /[A-Z]/.test(s)

/**
 * The compiler mounts mixed-case aliases (e.g. both `parser.h` and `Parser.h`)
 * to satisfy the case-sensitive MEMFS. For display we want one entry per file,
 * under the name authors actually `Include` — prefer the capitalized variant.
 */
export function canonicalLibraryFiles(
  files: { path: string; content: string }[],
): { name: string; content: string }[] {
  const byKey = new Map<string, { name: string; content: string }>()
  for (const f of files) {
    const name = baseName(f.path)
    const key = name.toLowerCase()
    const existing = byKey.get(key)
    if (!existing || (!hasUpper(existing.name) && hasUpper(name))) {
      byKey.set(key, { name, content: f.content })
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
  )
}

export function buildProjectFileList(input: {
  sourceName: string
  enabledExtensions: { id: string; name: string; origin: 'bundled' | 'uploaded' }[]
  libraryNames: string[]
  /** Extra editable project files (a ZIL project's `zil:<path>` files), listed
   *  after the main file sorted by name. */
  projectFiles?: { id: string; name: string }[]
  /** The game's solution (`solution.txt`, id `solution`), listed last among
   *  the project files; absent when the game has none. */
  solution?: { editable: boolean }
}): ProjectFileMeta[] {
  const extras = [...(input.projectFiles ?? [])].sort((a, b) =>
    a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0,
  )
  const project: ProjectFileMeta[] = [
    { id: 'source', name: input.sourceName, group: 'project', editable: true },
    ...extras.map(f => ({ id: f.id, name: f.name, group: 'project' as const, editable: true })),
    ...input.enabledExtensions.map(e => ({
      id: e.id,
      name: `${e.name}.h`,
      group: 'project' as const,
      editable: e.origin === 'uploaded',
    })),
    ...(input.solution
      ? [{ id: SOLUTION_ID, name: 'solution.txt', group: 'project' as const, editable: input.solution.editable }]
      : []),
  ]
  const library: ProjectFileMeta[] = input.libraryNames.map(name => ({
    id: `lib:${name}`,
    name,
    group: 'library' as const,
    editable: false,
  }))
  return [...project, ...library]
}

/** The file id a ZIL diagnostic opens: the main file (or no file) → `'source'`,
 *  one of the extra files → `zil:<its stored path>` (matched by `pathKey`, as
 *  ZILF finds files case-insensitively), anything else (a zillib file) → null. */
export function diagnosticFileId(
  file: string | undefined,
  mainPath: string,
  extraPaths: readonly string[],
): string | null {
  if (file === undefined || file === '') return 'source'
  const key = pathKey(file)
  if (key === pathKey(mainPath)) return 'source'
  const hit = extraPaths.find(p => pathKey(p) === key)
  return hit === undefined ? null : `zil:${hit}`
}

export interface TabState {
  activeId: string
  openTabs: string[]
}

const isValid = (id: string, validIds: Set<string>) => id === 'source' || validIds.has(id)

/** Drop tabs/active that no longer resolve; `source` is always present. */
export function reconcileOpen(current: TabState, validIds: Set<string>): TabState {
  const openTabs = current.openTabs.filter(id => isValid(id, validIds))
  if (!openTabs.includes('source')) openTabs.unshift('source')
  const activeId = isValid(current.activeId, validIds) && openTabs.includes(current.activeId)
    ? current.activeId
    : 'source'
  return { activeId, openTabs }
}

/** Close a tab (never `source`); re-select the left neighbor when needed. */
export function closeTabState(current: TabState, id: string): TabState {
  if (id === 'source') return current
  const idx = current.openTabs.indexOf(id)
  if (idx === -1) return current
  const openTabs = current.openTabs.filter(t => t !== id)
  let activeId = current.activeId
  if (activeId === id) activeId = current.openTabs[idx - 1] ?? 'source'
  return { activeId, openTabs }
}

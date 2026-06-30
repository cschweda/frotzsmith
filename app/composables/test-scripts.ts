/**
 * Pure, framework-free logic for test scripts (mirrors project-files.ts). The
 * `useTestScripts` composable wraps these with reactive state + localStorage.
 */
export interface TestScript {
  id: string
  name: string
  text: string
}

export interface PersistedV2 {
  v: 2
  buckets: Record<string, { scripts: TestScript[]; activeId: string }>
}

/**
 * Migrate a raw parsed localStorage value to the v2 bucketed shape.
 *  - v2 passthrough: returned as-is.
 *  - Old flat v1 shape (data.scripts is an array, data.v absent): converted to v2
 *    under `currentKey` so existing scripts are preserved for the current game.
 *  - Corrupt / unrecognised input: returns an empty v2 store.
 */
export function migrateScriptStore(raw: unknown, currentKey: string): PersistedV2 {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { v: 2, buckets: {} }
  }
  const data = raw as Record<string, unknown>

  // Already v2
  if (
    data.v === 2 &&
    data.buckets !== null &&
    typeof data.buckets === 'object' &&
    !Array.isArray(data.buckets)
  ) {
    return {
      v: 2,
      buckets: data.buckets as Record<string, { scripts: TestScript[]; activeId: string }>,
    }
  }

  // Old flat v1 shape (data.scripts is an array and data.v is absent)
  if (Array.isArray(data.scripts)) {
    return {
      v: 2,
      buckets: {
        [currentKey]: {
          scripts: data.scripts as TestScript[],
          activeId: typeof data.activeId === 'string' ? data.activeId : '',
        },
      },
    }
  }

  // Corrupt / unrecognised
  return { v: 2, buckets: {} }
}

export function upsertScript(list: TestScript[], script: TestScript): TestScript[] {
  const i = list.findIndex(s => s.id === script.id)
  if (i === -1) return [...list, script]
  const copy = list.slice()
  copy[i] = script
  return copy
}

export function renameScript(list: TestScript[], id: string, name: string): TestScript[] {
  return list.map(s => (s.id === id ? { ...s, name } : s))
}

export function deleteScript(list: TestScript[], id: string): TestScript[] {
  return list.filter(s => s.id !== id)
}

export function setScriptText(list: TestScript[], id: string, text: string): TestScript[] {
  return list.map(s => (s.id === id ? { ...s, text } : s))
}

/** Keep a still-valid active id; else the first script; else ''. */
export function nextActiveId(list: TestScript[], currentActive: string): string {
  if (list.some(s => s.id === currentActive)) return currentActive
  return list[0]?.id ?? ''
}

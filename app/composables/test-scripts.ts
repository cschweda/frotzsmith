/**
 * Pure, framework-free logic for test scripts (mirrors project-files.ts). The
 * `useTestScripts` composable wraps these with reactive state + localStorage.
 */
export interface TestScript {
  id: string
  name: string
  text: string
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

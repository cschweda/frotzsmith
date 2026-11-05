import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'
import { safeGetItem, safeRemoveItem, safeSetItem } from '~/utils/safe-storage'
import { notifyStorageFull } from '~/composables/useStorageNotice'
import { planZilFiles, ZIL_DEFAULT_MAIN_PATH, type ZilProjectFile } from '~/modules/zil/zil-project'

type Plan = { ok: true } | { ok: false; message: string }

/**
 * The open ZIL project's extra source files (`rooms.zil`, `lib/items.zil`, …)
 * and the name the main file compiles under. ZIL-only state: it is stored
 * under the zil language key whatever language is active, a language switch
 * leaves it alone, and I6 compiles never see it. It belongs to the open game:
 * the callers that load a different source call `clear()`.
 *
 * Storage failures never throw: the files stay usable in memory and the
 * author gets the storage-full cue (once per session).
 */
export function useZilProjectFiles() {
  const files = useState<readonly ZilProjectFile[]>('frotz:zil-files', () => [])
  const mainPath = useState<string>('frotz:zil-main-path', () => ZIL_DEFAULT_MAIN_PATH)

  const key = () => buildStorageKey('zil', frotzsmith.storageKeys.zilFiles)

  function persist() {
    if (!import.meta.client) return
    if (files.value.length === 0 && mainPath.value === ZIL_DEFAULT_MAIN_PATH) {
      safeRemoveItem(key())
      return
    }
    const record = { v: 1, mainPath: mainPath.value, files: files.value }
    if (!safeSetItem(key(), JSON.stringify(record))) notifyStorageFull()
  }

  /** Load the stored record. One that fails `planZilFiles` is dropped with a
   *  plain notice, never half-loaded. */
  function restore() {
    if (!import.meta.client) return
    files.value = []
    mainPath.value = ZIL_DEFAULT_MAIN_PATH
    const raw = safeGetItem(key())
    if (raw === null) return
    let valid = false
    let loaded: { mainPath: string; files: ZilProjectFile[] } | null = null
    try {
      const d = JSON.parse(raw) as { v?: unknown; mainPath?: unknown; files?: unknown }
      if (
        d && d.v === 1 && typeof d.mainPath === 'string' && Array.isArray(d.files)
        && d.files.every((f: unknown) => !!f && typeof (f as ZilProjectFile).path === 'string' && typeof (f as ZilProjectFile).text === 'string')
      ) {
        const list = (d.files as ZilProjectFile[]).map(f => ({ path: f.path, text: f.text }))
        if (planZilFiles(list, d.mainPath).ok) {
          loaded = { mainPath: d.mainPath, files: list }
          valid = true
        }
      }
    } catch {
      /* corrupt JSON: dropped below */
    }
    if (valid && loaded) {
      files.value = loaded.files
      mainPath.value = loaded.mainPath
      return
    }
    safeRemoveItem(key())
    try {
      useToast().add({
        title: 'Extra ZIL files were not restored',
        description: "The extra ZIL files saved in this browser couldn't be used, so they were dropped.",
        color: 'warning',
        icon: 'i-lucide-triangle-alert',
      })
    } catch {
      console.warn('[frotzsmith] The saved extra ZIL files were invalid and were dropped.')
    }
  }

  /** Replace every extra file and the main file's name. A set that fails
   *  `planZilFiles` changes nothing. */
  function replaceAll(next: ZilProjectFile[], main: string): Plan {
    const plan = planZilFiles(next, main)
    if (!plan.ok) return plan
    files.value = next.map(f => ({ path: f.path, text: f.text }))
    mainPath.value = main
    persist()
    return plan
  }

  /** Add a file; a path that already exists (by exact path) replaces it. */
  function add(file: ZilProjectFile): Plan {
    const next = [...files.value.filter(f => f.path !== file.path), { path: file.path, text: file.text }]
    const plan = planZilFiles(next, mainPath.value)
    if (!plan.ok) return plan
    files.value = next
    persist()
    return plan
  }

  function update(path: string, text: string) {
    if (!files.value.some(f => f.path === path)) return
    files.value = files.value.map(f => (f.path === path ? { path, text } : f))
    persist()
  }

  function remove(path: string) {
    files.value = files.value.filter(f => f.path !== path)
    persist()
  }

  /** Forget the project's extra files and put the main file's name back. */
  function clear() {
    files.value = []
    mainPath.value = ZIL_DEFAULT_MAIN_PATH
    persist()
  }

  return { files, mainPath, restore, replaceAll, add, update, remove, clear }
}

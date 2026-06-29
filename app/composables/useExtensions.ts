import type { Extension } from '~/modules/inform6/extensions'
import { BUNDLED_EXTENSIONS } from '~/modules/inform6/extensions'
import { frotzsmith } from '~~/frotzsmith.config'

/**
 * Manages Inform 6 extensions: the bundled catalog plus the author's uploaded
 * `.h` files, and which are enabled. Enabled extensions are mounted into the
 * compile (see `useCompiler`) so the source can `Include` them. Uploads and the
 * enabled set persist in localStorage.
 */
export function useExtensions() {
  const uploaded = useState<Extension[]>('frotz:ext-uploaded', () => [])
  const enabledIds = useState<string[]>('frotz:ext-enabled', () => [])

  function persist() {
    if (!import.meta.client) return
    const data = {
      uploaded: uploaded.value.map(u => ({ id: u.id, name: u.name, title: u.title, content: u.content })),
      enabled: enabledIds.value,
    }
    try {
      localStorage.setItem(frotzsmith.storageKeys.extensions, JSON.stringify(data))
    } catch {
      // QuotaExceededError — keep working in memory
    }
  }

  function restore() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(frotzsmith.storageKeys.extensions)
      if (!raw) return
      const data = JSON.parse(raw) as { uploaded?: Extension[]; enabled?: string[] }
      if (Array.isArray(data.uploaded)) {
        uploaded.value = data.uploaded.map(u => ({
          ...u,
          description: 'Uploaded extension.',
          library: 'any' as const,
          origin: 'uploaded' as const,
        }))
      }
      if (Array.isArray(data.enabled)) enabledIds.value = data.enabled
    } catch {
      // corrupt — ignore, start clean
    }
  }

  const all = computed<Extension[]>(() => [...BUNDLED_EXTENSIONS, ...uploaded.value])
  const isEnabled = (id: string) => enabledIds.value.includes(id)

  function toggle(id: string) {
    enabledIds.value = isEnabled(id)
      ? enabledIds.value.filter(x => x !== id)
      : [...enabledIds.value, id]
    persist()
  }

  /** Add (or replace) an uploaded extension from a filename + its `.h` content. */
  function addUploaded(filename: string, content: string): Extension {
    const name = (filename.replace(/\.h$/i, '').replace(/[^A-Za-z0-9_]/g, '_') || 'ext')
    const id = `uploaded:${name}`
    const ext: Extension = {
      id,
      name,
      title: filename,
      description: 'Uploaded extension.',
      library: 'any',
      content,
      origin: 'uploaded',
    }
    uploaded.value = [...uploaded.value.filter(e => e.id !== id), ext]
    if (!isEnabled(id)) enabledIds.value = [...enabledIds.value, id] // auto-enable on add
    persist()
    return ext
  }

  function removeUploaded(id: string) {
    uploaded.value = uploaded.value.filter(e => e.id !== id)
    enabledIds.value = enabledIds.value.filter(x => x !== id)
    persist()
  }

  /** Persist an edit to an uploaded extension's `.h` content (no-op if unknown). */
  function updateUploaded(id: string, content: string) {
    const idx = uploaded.value.findIndex(e => e.id === id)
    if (idx === -1) return
    uploaded.value = uploaded.value.map(e => (e.id === id ? { ...e, content } : e))
    persist()
  }

  /** The files to mount for a compile: each enabled extension as { name, content }. */
  const enabledFiles = computed(() =>
    all.value.filter(e => isEnabled(e.id)).map(e => ({ name: e.name, content: e.content })),
  )
  const enabledCount = computed(() => enabledFiles.value.length)

  return {
    uploaded,
    all,
    isEnabled,
    toggle,
    addUploaded,
    removeUploaded,
    updateUploaded,
    enabledFiles,
    enabledCount,
    restore,
  }
}

import type { Extension } from '~/modules/inform6/extensions'
import { BUNDLED_EXTENSIONS } from '~/modules/inform6/extensions'
import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'
import { safeSetItem } from '~/utils/safe-storage'
import { ZipLimitError, EXTENSIONS_TOTAL_MAX_BYTES } from '~/utils/zip-limits'
import { notifyStorageFull } from '~/composables/useStorageNotice'

/**
 * Manages Inform 6 extensions: the bundled catalog plus the author's uploaded
 * `.h` files, and which are enabled. Enabled extensions are mounted into the
 * compile (see `useCompiler`) so the source can `Include` them. Uploads and the
 * enabled set persist in localStorage.
 */
export function useExtensions() {
  const uploaded = useState<Extension[]>('frotz:ext-uploaded', () => [])
  const enabledIds = useState<string[]>('frotz:ext-enabled', () => [])
  const { profile } = useLanguage()

  /** Namespaced localStorage key for the active language (e.g. frotzsmith:i6:extensions). */
  function getKey(): string {
    return buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.extensions)
  }

  function persist() {
    if (!import.meta.client) return
    const data = {
      uploaded: uploaded.value.map(u => ({ id: u.id, name: u.name, title: u.title, content: u.content })),
      enabled: enabledIds.value,
    }
    // QuotaExceededError → keep working in memory, but tell the author once.
    if (!safeSetItem(getKey(), JSON.stringify(data))) notifyStorageFull()
  }

  function restore() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(getKey())
      if (!raw) {
        // No stored value for this language → reset, so the other language's
        // uploads/enabled set don't leak into this language (or its compiles).
        uploaded.value = []
        enabledIds.value = []
        return
      }
      const data = JSON.parse(raw) as { uploaded?: Extension[]; enabled?: string[] }
      uploaded.value = Array.isArray(data.uploaded)
        ? data.uploaded.map(u => ({
            ...u,
            description: 'Uploaded extension.',
            library: 'any' as const,
            origin: 'uploaded' as const,
          }))
        : []
      enabledIds.value = Array.isArray(data.enabled) ? data.enabled : []
    } catch {
      // corrupt — start clean
      uploaded.value = []
      enabledIds.value = []
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

  /** Add (or replace) an uploaded extension from a filename + its `.h` content.
   *  Throws ZipLimitError when the upload would push the cumulative stored
   *  total past EXTENSIONS_TOTAL_MAX_BYTES (ExtensionsModal surfaces it). */
  function addUploaded(filename: string, content: string): Extension {
    const name = (filename.replace(/\.h$/i, '').replace(/[^A-Za-z0-9_]/g, '_') || 'ext')
    const id = `uploaded:${name}`
    // Replacing the same id counts its old size out.
    const otherBytes = uploaded.value.filter(e => e.id !== id).reduce((n, e) => n + e.content.length, 0)
    if (otherBytes + content.length > EXTENSIONS_TOTAL_MAX_BYTES) {
      const mb = Math.round(EXTENSIONS_TOTAL_MAX_BYTES / 1024 / 1024)
      throw new ZipLimitError(
        `Storing ${filename} would exceed the ${mb} MB total for uploaded extensions — remove one first.`,
      )
    }
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

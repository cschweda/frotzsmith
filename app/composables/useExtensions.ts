import type { Extension } from '~/modules/inform6/extensions'
import { BUNDLED_EXTENSIONS } from '~/modules/inform6/extensions'
import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'
import { safeSetItem } from '~/utils/safe-storage'
import { ZipLimitError, EXTENSIONS_TOTAL_MAX_BYTES } from '~/utils/zip-limits'
import { notifyStorageFull } from '~/composables/useStorageNotice'
import { PackageError, quotedPath } from '~/project-package/errors'
import { pathProblem } from '~/project-package/paths'

/** The Include name a packaged `.h` file mounts under: its file name without
 *  `.h`, sanitized like an upload (`ext/lamp.h` → `lamp`). */
export function includeNameOf(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1)
  return base.replace(/\.h$/i, '').replace(/[^A-Za-z0-9_]/g, '_') || 'ext'
}

/** Where an uploaded extension sits in a `.frotzsmith` package: its original
 *  file name (a package path, for one opened from a package) when that is a
 *  valid `.h` path, else `<name>.h`. */
export function includePathOf(ext: Pick<Extension, 'name' | 'title'>): string {
  return /\.h$/i.test(ext.title) && pathProblem(ext.title) === null ? ext.title : `${ext.name}.h`
}

/**
 * Plan replacing every uploaded extension with a package's include files —
 * pure, so a caller can check a package BEFORE anything changes. Throws
 * `ZipLimitError` past EXTENSIONS_TOTAL_MAX_BYTES and `PackageError` when two
 * files would mount under one Include name (the browser mounts them flat).
 * `enabledNames` are manifest names: a bundled extension's name or an
 * include's package path; any other name comes back in `unknown`.
 */
export function planUploaded(
  files: { path: string; text: string }[],
  enabledNames: string[],
): { uploaded: Extension[]; enabledIds: string[]; unknown: string[] } {
  // Same measure as addUploaded (UTF-16 length of the stored text).
  const total = files.reduce((n, f) => n + f.text.length, 0)
  if (total > EXTENSIONS_TOTAL_MAX_BYTES) {
    const mb = Math.round(EXTENSIONS_TOTAL_MAX_BYTES / 1024 / 1024)
    throw new ZipLimitError(
      `This project's include files are larger than the ${mb} MB the browser editor can keep for uploaded extensions.`,
    )
  }
  const byId = new Map<string, string>()
  const uploaded: Extension[] = []
  for (const f of files) {
    const name = includeNameOf(f.path)
    const id = `uploaded:${name}`
    const other = byId.get(id)
    if (other !== undefined) {
      throw new PackageError(
        'include-name-clash',
        `This project has two include files the browser editor can't keep apart: ${quotedPath(other)} and ${quotedPath(f.path)}.`,
      )
    }
    byId.set(id, f.path)
    uploaded.push({
      id, name, title: f.path, description: 'Uploaded extension.', library: 'any', content: f.text, origin: 'uploaded',
    })
  }
  const enabledIds: string[] = []
  const unknown: string[] = []
  for (const n of enabledNames) {
    const id = BUNDLED_EXTENSIONS.find(b => b.name === n)?.id ?? uploaded.find(u => u.title === n)?.id
    if (id === undefined) unknown.push(n)
    else if (!enabledIds.includes(id)) enabledIds.push(id)
  }
  return { uploaded, enabledIds, unknown }
}

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

  /** Replace every uploaded extension and the enabled set at once (opening a
   *  `.frotzsmith` project). Validates first — over-budget throws
   *  `ZipLimitError` with nothing changed. Returns the enabled names that match
   *  no extension here, for the caller to keep. */
  function replaceUploaded(files: { path: string; text: string }[], enabledNames: string[]): string[] {
    const plan = planUploaded(files, enabledNames)
    uploaded.value = plan.uploaded
    enabledIds.value = plan.enabledIds
    persist()
    return plan.unknown
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
    replaceUploaded,
    removeUploaded,
    updateUploaded,
    enabledFiles,
    enabledCount,
    restore,
  }
}

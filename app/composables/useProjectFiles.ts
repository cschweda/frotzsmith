import {
  buildProjectFileList,
  canonicalLibraryFiles,
  closeTabState,
  diagnosticFileId,
  reconcileOpen,
  type ProjectFileMeta,
  type TabState,
} from '~/composables/project-files'
import type { ProfileMode } from '~/composables/useIde'
import { PROFILES, detectProfile, type ProfileId } from '~/modules/inform6/profiles'
import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'
import { safeSetItem } from '~/utils/safe-storage'
import { notifyStorageFull } from '~/composables/useStorageNotice'
import { registerSessionOnce } from '~/composables/session-once'
import { displayPath, quotedPath } from '~/project-package/errors'
import { useZilProjectFiles } from '~/composables/useZilProjectFiles'
import { pathKey } from '~/project-package/paths'

const ZIL_ID = 'zil:'

/**
 * Reactive model behind the file explorer + editor tabs. The file list mirrors
 * the compilation bundle (source, enabled extensions, the active library's
 * files); the pure helpers in `project-files.ts` carry the real logic.
 */
export function useProjectFiles() {
  const { source } = useSourceDocument()
  const { all, isEnabled, updateUploaded } = useExtensions()
  const { profile } = useLanguage()
  const zil = useZilProjectFiles()
  const isZil = computed(() => profile.value.id === 'zil')
  const sourceName = computed(() =>
    isZil.value ? displayPath(zil.mainPath.value) : `story.${profile.value.fileExt}`,
  )

  /** Namespaced localStorage key for the active language (e.g. frotzsmith:i6:explorer). */
  function getKey(): string {
    return buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.explorer)
  }

  // Active library: same derivation as useIde (auto-detect vs forced), read from
  // the shared `profileMode` state so we don't depend on (and cycle through) useIde.
  const profileMode = useState<ProfileMode>('frotz:profile-mode', () => 'auto')
  const activeProfile = computed(() =>
    PROFILES[profileMode.value === 'auto' ? detectProfile(source.value) : profileMode.value],
  )

  // Library file NAMES come from the light, curated manifest (profiles.ts) so
  // the explorer list renders without the ~900 KB of library text. The BODIES
  // (profile-files.ts) are fetched lazily the first time a library tab's
  // content is actually read, then cached reactively per profile — SourcePane
  // watches readFile() output, so the open tab fills in when the chunk lands.
  const libContents = useState<Partial<Record<ProfileId, Record<string, string>>>>(
    'frotz:lib-contents',
    () => ({}),
  )
  function ensureLibraryContent(pid: ProfileId) {
    if (libContents.value[pid]) return
    void import('~/modules/inform6/profile-files')
      .then(({ PROFILE_FILES }) => {
        const map: Record<string, string> = {}
        for (const f of canonicalLibraryFiles(PROFILE_FILES[pid])) map[f.name] = f.content
        libContents.value = { ...libContents.value, [pid]: map }
      })
      .catch(() => {
        // Chunk failed to load (offline?) — the tab keeps its placeholder; a
        // later readFile retries the import.
      })
  }

  const enabledExtensions = computed(() => all.value.filter(e => isEnabled(e.id)))

  const files = computed<ProjectFileMeta[]>(() =>
    buildProjectFileList({
      sourceName: sourceName.value,
      enabledExtensions: enabledExtensions.value.map(e => ({
        id: e.id,
        name: e.name,
        origin: e.origin,
      })),
      // ZIL uses zillib embedded in the WASM bundle — no I6 library files belong
      // in the ZIL project view.
      libraryNames: profile.value.id === 'i6' ? activeProfile.value.libraryFileNames : [],
      // A ZIL project's extra files (I6 has none). Names come from packages
      // too, so they are shown display-safe.
      projectFiles: isZil.value
        ? zil.files.value.map(f => ({ id: `${ZIL_ID}${f.path}`, name: displayPath(f.path) }))
        : [],
    }),
  )
  const validIds = computed(() => new Set(files.value.map(f => f.id)))

  const tabs = useState<TabState>('frotz:tabs', () => ({ activeId: 'source', openTabs: ['source'] }))
  // Default open on desktop, closed on mobile — the slide-over drawer shouldn't
  // auto-open on a first mobile visit. Persisted state overrides this on restore().
  const panelOpen = useState<boolean>('frotz:panel-open', () =>
    import.meta.client ? window.matchMedia('(min-width: 1024px)').matches : true,
  )

  const activeId = computed(() => tabs.value.activeId)
  const activeFile = computed<ProjectFileMeta>(
    () => files.value.find(f => f.id === tabs.value.activeId) ?? files.value[0]!,
  )
  const openTabs = computed<ProjectFileMeta[]>(() =>
    tabs.value.openTabs
      .map(id => files.value.find(f => f.id === id))
      .filter((f): f is ProjectFileMeta => !!f),
  )

  function persist() {
    if (!import.meta.client) return
    // QuotaExceededError — keep working in memory, but cue the author once.
    if (!safeSetItem(getKey(), JSON.stringify({ open: panelOpen.value, ...tabs.value }))) notifyStorageFull()
  }

  function openFile(id: string) {
    if (!validIds.value.has(id)) return
    const openTabsNext = tabs.value.openTabs.includes(id)
      ? tabs.value.openTabs
      : [...tabs.value.openTabs, id]
    tabs.value = { activeId: id, openTabs: openTabsNext }
    persist()
  }

  function closeTab(id: string) {
    tabs.value = closeTabState(tabs.value, id)
    persist()
  }

  function togglePanel() {
    panelOpen.value = !panelOpen.value
    persist()
  }

  function readFile(id: string): string {
    if (id === 'source') return source.value
    if (id.startsWith(ZIL_ID)) {
      const path = id.slice(ZIL_ID.length)
      return zil.files.value.find(f => f.path === path)?.text ?? ''
    }
    if (id.startsWith('lib:')) {
      const name = id.slice(4)
      const pid = activeProfile.value.id
      const cached = libContents.value[pid]
      if (cached) return cached[name] ?? ''
      ensureLibraryContent(pid) // kicks the lazy chunk; reactive fill on arrival
      return ''
    }
    return all.value.find(e => e.id === id)?.content ?? ''
  }

  function writeActive(text: string) {
    const file = activeFile.value
    if (!file.editable) return
    if (file.id === 'source') source.value = text
    // In memory at once (the next compile sees it); stored after a pause in typing.
    else if (file.id.startsWith(ZIL_ID)) zil.edit(file.id.slice(ZIL_ID.length), text)
    else updateUploaded(file.id, text)
  }

  /** The stored path of the extra file this name matches, ignoring case (by
   *  pathKey, as planZilFiles compares them), or null. */
  function findZilFile(path: string): string | null {
    const key = pathKey(path)
    return zil.files.value.find(f => pathKey(f.path) === key)?.path ?? null
  }

  /** Whether the ZIL project already has an extra file with this name (ignoring case). */
  function hasZilFile(path: string): boolean {
    return findZilFile(path) !== null
  }

  /** Add (or, for an existing name in any case, replace) an extra ZIL file. A
   *  replace takes the new spelling, and an open tab of the old one follows it.
   *  Text with a NUL in it isn't source; everything else is checked by `planZilFiles`. */
  function addZilFile(path: string, text: string): { ok: true } | { ok: false; message: string } {
    if (text.includes('\u0000')) {
      return { ok: false, message: `${quotedPath(path)} isn’t a text file, so it can’t be added.` }
    }
    const existing = findZilFile(path)
    const res = zil.add({ path, text })
    if (res.ok && existing !== null && existing !== path) {
      const from = `${ZIL_ID}${existing}`
      const to = `${ZIL_ID}${path}`
      const t = tabs.value
      if (t.openTabs.includes(from)) {
        tabs.value = {
          activeId: t.activeId === from ? to : t.activeId,
          openTabs: t.openTabs.map(id => (id === from ? to : id)),
        }
        persist()
      }
    }
    return res
  }

  /** Remove an extra ZIL file; its tab closes with it (the validIds watcher). */
  function removeZilFile(path: string) {
    zil.remove(path)
  }

  /** The tab a diagnostic's `file` opens, or null for a file outside the
   *  project (zillib). I6 diagnostics always target the source. */
  function diagnosticTarget(file: string | undefined): string | null {
    if (!isZil.value) return 'source'
    return diagnosticFileId(file, zil.mainPath.value, zil.files.value.map(f => f.path))
  }

  function restore() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(getKey())
      if (!raw) {
        // No stored value for this language → default tab state; the previous
        // language's open tabs reference files that don't exist here.
        tabs.value = { activeId: 'source', openTabs: ['source'] }
        return
      }
      const data = JSON.parse(raw) as { open?: boolean; activeId?: string; openTabs?: string[] }
      if (typeof data.open === 'boolean') panelOpen.value = data.open
      tabs.value = reconcileOpen(
        {
          activeId: data.activeId ?? 'source',
          openTabs: Array.isArray(data.openTabs) ? data.openTabs : ['source'],
        },
        validIds.value,
      )
    } catch {
      // corrupt — start clean
      tabs.value = { activeId: 'source', openTabs: ['source'] }
    }
  }

  // Reactively close tabs whose backing file leaves the bundle (extension
  // disabled/removed, or the active library switched). Registered once per
  // app: useProjectFiles() runs inside useIde(), which runCompile and other
  // non-setup paths call — a bare watch() there leaked one never-disposed
  // watcher (re-running detectProfile on every keystroke) per compile.
  registerSessionOnce('project-files', () => {
    watch(validIds, ids => {
      const next = reconcileOpen(tabs.value, ids)
      if (next.activeId !== tabs.value.activeId || next.openTabs.length !== tabs.value.openTabs.length) {
        tabs.value = next
        persist()
      }
    })
  })

  return {
    files,
    activeId: readonly(activeId),
    activeFile,
    openTabs,
    panelOpen,
    openFile,
    closeTab,
    togglePanel,
    readFile,
    writeActive,
    restore,
    findZilFile,
    hasZilFile,
    addZilFile,
    removeZilFile,
    diagnosticTarget,
  }
}

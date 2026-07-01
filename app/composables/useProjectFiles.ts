import {
  buildProjectFileList,
  canonicalLibraryFiles,
  closeTabState,
  reconcileOpen,
  type ProjectFileMeta,
  type TabState,
} from '~/composables/project-files'
import type { ProfileMode } from '~/composables/useIde'
import { PROFILES, detectProfile } from '~/modules/inform6/profiles'
import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'

/**
 * Reactive model behind the file explorer + editor tabs. The file list mirrors
 * the compilation bundle (source, enabled extensions, the active library's
 * files); the pure helpers in `project-files.ts` carry the real logic.
 */
export function useProjectFiles() {
  const { source } = useSourceDocument()
  const { all, isEnabled, updateUploaded } = useExtensions()
  const { profile } = useLanguage()
  const sourceName = computed(() => `story.${profile.value.fileExt}`)

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

  // Canonical (de-duped) library files for the active profile, with content.
  const libraryFiles = computed(() => canonicalLibraryFiles(activeProfile.value.files))
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
      libraryNames: profile.value.id === 'i6' ? libraryFiles.value.map(f => f.name) : [],
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
    try {
      localStorage.setItem(
        getKey(),
        JSON.stringify({ open: panelOpen.value, ...tabs.value }),
      )
    } catch {
      // QuotaExceededError — keep working in memory
    }
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
    if (id.startsWith('lib:')) {
      const name = id.slice(4)
      return libraryFiles.value.find(f => f.name === name)?.content ?? ''
    }
    return all.value.find(e => e.id === id)?.content ?? ''
  }

  function writeActive(text: string) {
    const file = activeFile.value
    if (!file.editable) return
    if (file.id === 'source') source.value = text
    else updateUploaded(file.id, text)
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
  // disabled/removed, or the active library switched).
  watch(validIds, ids => {
    const next = reconcileOpen(tabs.value, ids)
    if (next.activeId !== tabs.value.activeId || next.openTabs.length !== tabs.value.openTabs.length) {
      tabs.value = next
      persist()
    }
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
  }
}

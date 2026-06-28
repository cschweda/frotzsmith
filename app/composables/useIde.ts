import type { CompileResult } from '~/modules/inform6/types'
import { formatI6 } from '~/utils/format-i6'
import { PROFILES, DEFAULT_PROFILE, type ProfileId } from '~/modules/inform6/profiles'

export type CompileStatus = 'idle' | 'compiling' | 'success' | 'error'
export type RightTab = 'results' | 'play' | 'transcript'

/**
 * Central IDE state and actions. Backed by shared `useState`, so it can be called
 * from any component and stays in sync (composables, no Pinia — house style).
 */
export function useIde() {
  const { source, savedAt, restore: restoreSource } = useSourceDocument()
  const { compile } = useCompiler()

  const status = useState<CompileStatus>('frotz:status', () => 'idle')
  const result = useState<CompileResult | null>('frotz:result', () => null)
  const activeTab = useState<RightTab>('frotz:tab', () => 'results')
  // A changing signal the editor watches to move the cursor to a line.
  const jumpSignal = useState<{ line: number; nonce: number } | null>('frotz:jump', () => null)
  const profileId = useState<ProfileId>('frotz:profile', () => DEFAULT_PROFILE)
  const activeProfile = computed(() => PROFILES[profileId.value])

  /** A successful compile produced a story file → it can be played. */
  const canPlay = computed(() => status.value === 'success' && !!result.value?.storyFile)
  /** Bumped each time the user asks to (re)boot the story in the Play tab. */
  const playNonce = useState<number>('frotz:play-nonce', () => 0)

  /** Restore the persisted profile, then the source recovery snapshot. */
  function restore() {
    if (import.meta.client) {
      const saved = localStorage.getItem('frotzsmith:profile')
      if (saved === 'std' || saved === 'puny') profileId.value = saved
    }
    restoreSource()
  }

  async function runCompile() {
    if (status.value === 'compiling') return
    status.value = 'compiling'
    activeTab.value = 'results'
    // Yield once so the UI paints "Compiling…" before the synchronous WASM run.
    await new Promise(resolve => setTimeout(resolve, 0))
    try {
      const r = await compile(source.value, { profileId: profileId.value })
      result.value = r
      status.value = r.ok ? 'success' : 'error'
    } catch {
      result.value = null
      status.value = 'error'
    }
  }

  /** Ask the editor to move the cursor to a 1-based line (e.g. from a results row). */
  function jumpTo(line: number) {
    jumpSignal.value = { line, nonce: (jumpSignal.value?.nonce ?? 0) + 1 }
  }

  /** Re-indent and tidy the source ("prettify"). Undoable in the editor. */
  function format() {
    source.value = formatI6(source.value)
  }

  /**
   * Switch library profile. Standard Library and PunyInform source are mutually
   * incompatible, so this loads the chosen profile's starter template (undoable
   * in the editor with Cmd/Ctrl+Z).
   */
  function setProfile(id: ProfileId) {
    if (id === profileId.value) return
    profileId.value = id
    if (import.meta.client) localStorage.setItem('frotzsmith:profile', id)
    source.value = PROFILES[id].starter
    result.value = null
    status.value = 'idle'
  }

  /** Boot the freshly compiled story in the Play tab (no-op until a clean compile). */
  function playStory() {
    if (!canPlay.value) return
    activeTab.value = 'play'
    playNonce.value += 1
  }

  return {
    source,
    savedAt,
    restore,
    status,
    result,
    activeTab,
    jumpSignal,
    profileId,
    activeProfile,
    canPlay,
    playNonce,
    runCompile,
    jumpTo,
    format,
    setProfile,
    playStory,
  }
}

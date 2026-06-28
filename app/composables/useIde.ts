import type { CompileResult, StoryExt } from '~/modules/inform6/types'
import { formatI6 } from '~/utils/format-i6'
import { PROFILES, detectProfile, type ProfileId } from '~/modules/inform6/profiles'
import { sampleById } from '~/modules/inform6/samples'
import { frotzsmith } from '~~/frotzsmith.config'

export type CompileStatus = 'idle' | 'compiling' | 'success' | 'error'
export type RightTab = 'results' | 'play' | 'transcript'
export type ProfileMode = 'auto' | ProfileId

/**
 * Central IDE state and actions (composables, no Pinia). Library selection is
 * fuzzily auto-detected from the source by default, so the compiler chooses
 * Standard Library vs PunyInform automatically; the user can still force one.
 */
export function useIde() {
  const { source, savedAt, restore: restoreSource } = useSourceDocument()
  const { compile } = useCompiler()
  const { enabledFiles, restore: restoreExtensions } = useExtensions()

  const status = useState<CompileStatus>('frotz:status', () => 'idle')
  const result = useState<CompileResult | null>('frotz:result', () => null)
  const activeTab = useState<RightTab>('frotz:tab', () => 'results')
  const jumpSignal = useState<{ line: number; nonce: number } | null>('frotz:jump', () => null)

  const profileMode = useState<ProfileMode>('frotz:profile-mode', () => 'auto')
  const detectedProfile = computed(() => detectProfile(source.value))
  const effectiveProfile = computed<ProfileId>(() =>
    profileMode.value === 'auto' ? detectedProfile.value : profileMode.value,
  )
  const activeProfile = computed(() => PROFILES[effectiveProfile.value])

  // Story-file version: 'auto' uses the profile default, or force z3 / z5 / z8.
  const targetMode = useState<'auto' | StoryExt>('frotz:target', () => 'auto')
  const effectiveExt = computed<StoryExt>(() => {
    if (targetMode.value === 'auto') return activeProfile.value.defaultExt
    // Fall back to the profile default if the forced target isn't valid for it.
    return activeProfile.value.targets.includes(targetMode.value)
      ? targetMode.value
      : activeProfile.value.defaultExt
  })

  /** The profile the most recent compile actually used. */
  const usedProfile = useState<ProfileId | null>('frotz:used-profile', () => null)

  const canPlay = computed(() => status.value === 'success' && !!result.value?.storyFile)
  const playNonce = useState<number>('frotz:play-nonce', () => 0)

  /** Restore the persisted profile mode, then the source recovery snapshot. */
  function restore() {
    if (import.meta.client) {
      const saved = localStorage.getItem(frotzsmith.storageKeys.profileMode)
      if (saved === 'auto' || saved === 'std' || saved === 'puny') profileMode.value = saved
      const t = localStorage.getItem(frotzsmith.storageKeys.target)
      if (t === 'auto' || t === 'z3' || t === 'z4' || t === 'z5' || t === 'z8') targetMode.value = t
    }
    restoreExtensions()
    restoreSource()
  }

  async function runCompile() {
    if (status.value === 'compiling') return
    status.value = 'compiling'
    activeTab.value = 'results'
    const pid = effectiveProfile.value
    await new Promise(resolve => setTimeout(resolve, 0)) // let "Compiling…" paint
    try {
      const r = await compile(source.value, {
        profileId: pid,
        ext: effectiveExt.value,
        extensions: enabledFiles.value,
      })
      result.value = r
      usedProfile.value = pid
      status.value = r.ok ? 'success' : 'error'
    } catch {
      result.value = null
      usedProfile.value = pid
      status.value = 'error'
    }
  }

  function jumpTo(line: number) {
    jumpSignal.value = { line, nonce: (jumpSignal.value?.nonce ?? 0) + 1 }
  }

  /** Re-indent and tidy the source. Undoable in the editor. */
  function format() {
    source.value = formatI6(source.value)
  }

  function setProfileMode(mode: ProfileMode) {
    profileMode.value = mode
    if (import.meta.client) localStorage.setItem(frotzsmith.storageKeys.profileMode, mode)
  }

  function setTargetMode(mode: 'auto' | StoryExt) {
    targetMode.value = mode
    if (import.meta.client) localStorage.setItem(frotzsmith.storageKeys.target, mode)
  }

  /** Load a built-in sample into the editor, prettified for consistent formatting. */
  function loadSample(id: string) {
    const s = sampleById(id)
    if (!s) return
    source.value = formatI6(s.source)
    result.value = null
    status.value = 'idle'
    activeTab.value = 'results'
  }

  /** Load arbitrary source text (e.g. an opened .inf file) into the editor. */
  function loadSource(text: string) {
    source.value = text
    result.value = null
    status.value = 'idle'
    activeTab.value = 'results'
  }

  /** Start a fresh project: a blank editor with the chosen library forced. */
  function newProject(library: ProfileId) {
    source.value = ''
    setProfileMode(library)
    result.value = null
    status.value = 'idle'
    activeTab.value = 'results'
  }

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
    profileMode,
    detectedProfile,
    effectiveProfile,
    activeProfile,
    targetMode,
    effectiveExt,
    usedProfile,
    canPlay,
    playNonce,
    runCompile,
    jumpTo,
    format,
    setProfileMode,
    setTargetMode,
    loadSample,
    loadSource,
    newProject,
    playStory,
  }
}

import type { CompileResult, StoryExt } from '~/modules/inform6/types'
import { formatI6 } from '~/utils/format-i6'
import { PROFILES, detectProfile, type ProfileId } from '~/modules/inform6/profiles'
import { sampleById } from '~/modules/inform6/samples'
import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'
import { migrateStorageKeys } from './useStorageMigration'

export type CompileStatus = 'idle' | 'compiling' | 'success' | 'error'
export type RightTab = 'results' | 'play' | 'transcript' | 'testscript' | 'map'
export type ProfileMode = 'auto' | ProfileId

/**
 * Central IDE state and actions (composables, no Pinia). Library selection is
 * fuzzily auto-detected from the source by default, so the compiler chooses
 * Standard Library vs PunyInform automatically; the user can still force one.
 */
export function useIde() {
  const { source, savedAt, restore: restoreSource } = useSourceDocument()
  const { compile } = useCompiler()
  const { profile } = useLanguage()
  const { enabledFiles, restore: restoreExtensions } = useExtensions()
  const { activeFile, readFile, writeActive, restore: restoreProjectFiles } = useProjectFiles()
  const { restore: restoreScripts } = useTestScripts()

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

  /** The `Constant Story "…"` title from the source, if any. */
  const storyTitle = computed(() => /Constant\s+Story\s+"([^"]*)"/i.exec(source.value)?.[1]?.trim())
  /** Filename stem for Save-As / Download: slug of the title (or 'story'), '-puny' for PunyInform. */
  const storyBase = computed(() => storyBaseName(storyTitle.value, effectiveProfile.value === 'puny'))

  /** Slug of the current story title, or 'untitled' when there is none.
   *  Recomputes live as the source changes, but only used as the SEED for activeStoryKey. */
  const storyKey = computed(() => slugify(storyTitle.value || '') || 'untitled')

  /** Stable per-game identity for scoping test scripts and transcript.
   *  Updated only on discrete load events (restore / loadSample / loadSource / newProject),
   *  NOT on every title keystroke, so bucket switches are intentional. */
  const activeStoryKey = useState<string>('frotz:story-key', () => 'untitled')

  /** The profile the most recent compile actually used. */
  const usedProfile = useState<ProfileId | null>('frotz:used-profile', () => null)

  const canPlay = computed(() => status.value === 'success' && !!result.value?.storyFile)
  const playNonce = useState<number>('frotz:play-nonce', () => 0)

  // Send-to-Play: a parsed script queued to feed into the live Parchment game.
  const pendingScript = useState<string[] | null>('frotz:pending-script', () => null)

  /** Restore the persisted profile mode, then the source recovery snapshot. */
  function restore() {
    if (import.meta.client) {
      // One-time migration of un-prefixed keys → per-language namespace (Task 4).
      migrateStorageKeys(profile.value.stateKey)
      const profileModeKey = buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.profileMode)
      const targetKey = buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.target)
      const saved = localStorage.getItem(profileModeKey)
      if (saved === 'auto' || saved === 'std' || saved === 'puny') profileMode.value = saved
      const t = localStorage.getItem(targetKey)
      if (t !== null && (t === 'auto' || (profile.value.versionTargets as string[]).includes(t)))
        targetMode.value = t as 'auto' | StoryExt
    }
    restoreExtensions()
    // Restore source before project files so tab reconciliation runs against the
    // restored source's library profile (not the demo's), keeping library tabs.
    restoreSource()
    restoreProjectFiles()
    // Set the stable story key AFTER source is restored so scripts restore under
    // the right per-game bucket.
    activeStoryKey.value = storyKey.value
    restoreScripts()
  }

  async function runCompile() {
    if (status.value === 'compiling') return
    status.value = 'compiling'
    // Fresh build → blank the captured play transcript, the last script-run output,
    // the active test script selection, and the Parchment autosave (first room on next Play).
    // Saved scripts are kept and re-selectable; nothing is auto-run.
    usePlayTranscript().reset()
    useTranscript().reset()
    useTestScripts().select('')
    useMap().reset()
    clearPlayAutosave()
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

  /** Re-indent and tidy the active editable file (source or an uploaded ext). */
  function format() {
    if (!activeFile.value.editable) return
    writeActive(formatI6(readFile(activeFile.value.id)))
  }

  function setProfileMode(mode: ProfileMode) {
    profileMode.value = mode
    if (import.meta.client)
      localStorage.setItem(buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.profileMode), mode)
  }

  function setTargetMode(mode: 'auto' | StoryExt) {
    targetMode.value = mode
    if (import.meta.client)
      localStorage.setItem(buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.target), mode)
  }

  /** Load a built-in sample into the editor, prettified for consistent formatting. */
  function loadSample(id: string) {
    const s = sampleById(id)
    if (!s) return
    source.value = formatI6(s.source)
    // Commit the new game's bucket key AFTER source is set so storyKey reflects the sample.
    activeStoryKey.value = storyKey.value
    // Reset to auto so the sample compiles with its own library, not whatever
    // profile happens to be forced (e.g. from a prior New Project).
    setProfileMode('auto')
    setTargetMode(s.target ?? 'auto')
    result.value = null
    status.value = 'idle'
    activeTab.value = 'results'
  }

  /** Load arbitrary source text (e.g. an opened .inf file) into the editor. */
  function loadSource(text: string) {
    source.value = text
    // Commit the new game's bucket key AFTER source is set so storyKey reflects the loaded file.
    activeStoryKey.value = storyKey.value
    result.value = null
    status.value = 'idle'
    activeTab.value = 'results'
  }

  /** Start a fresh project: a blank editor with the chosen library forced. */
  function newProject(library: ProfileId) {
    source.value = ''
    // Blank source → storyKey is 'untitled'.
    activeStoryKey.value = storyKey.value
    setProfileMode(library)
    result.value = null
    status.value = 'idle'
    activeTab.value = 'results'
  }

  /** Clear all Parchment autosave entries from localStorage so the next Play boots
   *  from the first room. Parchment writes `autosave:<story-hash>` (same-origin). */
  function clearPlayAutosave() {
    if (!import.meta.client) return
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('autosave:')) localStorage.removeItem(k)
    } catch { /* ignore */ }
  }

  function playStory() {
    if (!canPlay.value) return
    activeTab.value = 'play'
    playNonce.value += 1
  }

  /** Run a script in the live game: clear the autosave so it plays from the start,
   *  queue the commands, and (re)boot Play. PlayPanel feeds them once the game is ready. */
  function sendToPlay(commands: string[]) {
    if (!canPlay.value || !commands.length) return
    clearPlayAutosave()
    pendingScript.value = commands.slice()
    playStory() // activeTab = 'play' + playNonce++ → fresh iframe boot
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
    storyTitle,
    storyBase,
    storyKey,
    activeStoryKey,
    canPlay,
    playNonce,
    pendingScript,
    runCompile,
    jumpTo,
    format,
    setProfileMode,
    setTargetMode,
    loadSample,
    loadSource,
    newProject,
    playStory,
    sendToPlay,
  }
}

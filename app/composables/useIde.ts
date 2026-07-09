import type { CompileResult, StoryExt } from '~/modules/inform6/types'
import { formatI6 } from '~/utils/format-i6'
import { formatZil } from '~/utils/format-zil'
import { safeGetItem, safeSetItem } from '~/utils/safe-storage'
import { PROFILES, detectProfile, type ProfileId } from '~/modules/inform6/profiles'
import { sampleById } from '~/modules/inform6/samples'
import { sampleById as zilSampleById } from '~/modules/languages/zil/samples'
import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'

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
    // ZIL: auto → first versionTarget (z3); forced → validate against versionTargets.
    if (profile.value.id === 'zil') {
      if (targetMode.value === 'auto') return profile.value.versionTargets[0]!
      return (profile.value.versionTargets as string[]).includes(targetMode.value)
        ? targetMode.value
        : profile.value.versionTargets[0]!
    }
    // I6 path — unchanged.
    if (targetMode.value === 'auto') return activeProfile.value.defaultExt
    // Fall back to the profile default if the forced target isn't valid for it.
    return activeProfile.value.targets.includes(targetMode.value)
      ? targetMode.value
      : activeProfile.value.defaultExt
  })

  /**
   * The story title from the source, used for Save-As filenames — language-aware.
   * I6: reads `Constant Story "…"`.
   * ZIL: reads the first pipe-segment of `<CONSTANT GAME-BANNER "Title|…">`.
   */
  const storyTitle = computed(() => {
    if (profile.value.id === 'zil') {
      const banner = /<CONSTANT\s+GAME-BANNER[^"]*"([^"]*)/i.exec(source.value)?.[1] ?? ''
      const title = banner.split('|')[0]?.trim().replace(/[\r\n]/g, ' ').trim()
      return title || undefined
    }
    return /Constant\s+Story\s+"([^"]*)"/i.exec(source.value)?.[1]?.trim()
  })
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

  /** Language of the most recent IdeLayout mount — restore() compares against it
   *  so a language switch (and only a language switch) blanks run artifacts. */
  const lastLang = useState<string | null>('frotz:last-lang', () => null)

  /** performance.now() at the end of the last compile — debounces clicks that
   *  were queued during a main-thread compile freeze (they dispatch AFTER the
   *  freeze, when status is no longer 'compiling', and would otherwise trigger
   *  a second full freeze). */
  const lastCompileEnd = useState<number>('frotz:last-compile-end', () => 0)

  // Send-to-Play: a parsed script queued to feed into the live Parchment game.
  const pendingScript = useState<string[] | null>('frotz:pending-script', () => null)

  /** Restore the persisted profile mode, then the source recovery snapshot. */
  function restore() {
    if (import.meta.client) {
      // Language switched since the last mount → the compile result, status,
      // right-pane tab, queued script, transcripts, and map all belong to the
      // other language (the shared useState keys are language-agnostic). Blank
      // them BEFORE restoring; same-language remounts (e.g. a /technical
      // round-trip) keep the working state.
      if (lastLang.value !== null && lastLang.value !== profile.value.id) {
        resetForNewSource()
        usedProfile.value = null
      }
      lastLang.value = profile.value.id

      const profileModeKey = buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.profileMode)
      const targetKey = buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.target)
      // No persisted value → 'auto', so the other language's in-memory choice
      // (e.g. a forced z4) doesn't leak into this language's toolbar.
      const saved = safeGetItem(profileModeKey)
      profileMode.value = saved === 'auto' || saved === 'std' || saved === 'puny' ? saved : 'auto'
      const t = safeGetItem(targetKey)
      targetMode.value =
        t !== null && (t === 'auto' || (profile.value.versionTargets as string[]).includes(t))
          ? (t as 'auto' | StoryExt)
          : 'auto'
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

  /** Blank every ephemeral run artifact: the captured play transcript, the last
   *  script-run output, any queued Send-to-Play commands, the auto-map, and the
   *  Parchment autosave. Shared by a fresh compile and by loading a new source so
   *  nothing from the previous game lingers. Saved scripts — including which one
   *  is selected — are kept: they're per-game (bucketed by activeStoryKey), and
   *  blanking the selection here persisted activeId='' and lost it on reload. */
  function resetEphemeral() {
    usePlayTranscript().reset()
    useTranscript().reset()
    useMap().reset()
    pendingScript.value = null
    clearPlayAutosave()
  }

  /** A new source was loaded (sample / opened file / new project): drop the
   *  compiled result and all ephemeral artifacts so the IDE returns to a clean
   *  slate — no stale results, transcript, map, or running Parchment game. The
   *  PlayPanel tears its iframe down when `result` goes null. */
  function resetForNewSource() {
    resetEphemeral()
    result.value = null
    status.value = 'idle'
    activeTab.value = 'results'
  }

  /** Two rAFs = a guaranteed paint opportunity (setTimeout(0) is not), so
   *  "Compiling…" is actually on screen before a long synchronous main-thread
   *  compile (ZIL: ~5-9s) blocks the thread. */
  function nextPaint(): Promise<void> {
    return new Promise(resolve => {
      if (!import.meta.client || typeof requestAnimationFrame === 'undefined') return resolve()
      let done = false
      const finish = () => {
        if (!done) {
          done = true
          resolve()
        }
      }
      requestAnimationFrame(() => requestAnimationFrame(finish))
      // Hidden tabs never fire rAF (Chrome throttles it to zero) — the compile
      // must not hang until the tab becomes visible again.
      setTimeout(finish, 100)
    })
  }

  async function runCompile() {
    if (status.value === 'compiling') return
    if (import.meta.client && lastCompileEnd.value > 0 && performance.now() - lastCompileEnd.value < 500) return
    status.value = 'compiling'
    // Fresh build → blank the prior game's artifacts (first room on next Play).
    resetEphemeral()
    activeTab.value = 'results'
    const pid = effectiveProfile.value
    await nextPaint()
    const started = performance.now()
    try {
      const r = await compile(source.value, {
        profileId: pid,
        ext: effectiveExt.value,
        extensions: enabledFiles.value,
      })
      result.value = r
      usedProfile.value = pid
      status.value = r.ok ? 'success' : 'error'
    } catch (err: unknown) {
      // A thrown exception (vs. an ok:false result) means the compiler itself
      // failed — e.g. the lazy inform6.mjs/wasm fetch rejected. Surface it as a
      // failed CompileResult so ResultsPanel shows the reason instead of an
      // empty "0 errors" error state (the ZIL path already does this).
      const msg = `Compiler failed to run: ${String(err)}`
      result.value = {
        ok: false,
        storyExt: effectiveExt.value,
        diagnostics: [{ severity: 'fatal', message: msg }],
        rawStderr: msg,
        ms: Math.round(performance.now() - started),
        byteLength: 0,
      }
      usedProfile.value = pid
      status.value = 'error'
    } finally {
      if (import.meta.client) lastCompileEnd.value = performance.now()
    }
  }

  function jumpTo(line: number) {
    jumpSignal.value = { line, nonce: (jumpSignal.value?.nonce ?? 0) + 1 }
  }

  /** Re-indent and tidy the active editable file (source or an uploaded ext). */
  function format() {
    if (!activeFile.value.editable) return
    const src = readFile(activeFile.value.id)
    writeActive(profile.value.id === 'zil' ? formatZil(src) : formatI6(src))
  }

  function setProfileMode(mode: ProfileMode) {
    profileMode.value = mode
    if (import.meta.client)
      safeSetItem(buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.profileMode), mode)
  }

  function setTargetMode(mode: 'auto' | StoryExt) {
    targetMode.value = mode
    if (import.meta.client)
      safeSetItem(buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.target), mode)
  }

  /** Load a built-in sample into the editor, prettified for consistent formatting. */
  function loadSample(id: string) {
    // ZIL samples: look up from the ZIL sample registry; no I6 formatting.
    if (profile.value.id === 'zil') {
      const s = zilSampleById(id)
      if (!s) return
      source.value = s.source
      activeStoryKey.value = storyKey.value
      setTargetMode(s.target)
      resetForNewSource()
      return
    }
    // I6 path — unchanged.
    const s = sampleById(id)
    if (!s) return
    source.value = formatI6(s.source)
    // Commit the new game's bucket key AFTER source is set so storyKey reflects the sample.
    activeStoryKey.value = storyKey.value
    // Reset to auto so the sample compiles with its own library, not whatever
    // profile happens to be forced (e.g. from a prior New Project).
    setProfileMode('auto')
    setTargetMode(s.target ?? 'auto')
    resetForNewSource()
  }

  /** Load arbitrary source text (e.g. an opened .inf file) into the editor. */
  function loadSource(text: string) {
    source.value = text
    // Commit the new game's bucket key AFTER source is set so storyKey reflects the loaded file.
    activeStoryKey.value = storyKey.value
    resetForNewSource()
  }

  /** Start a fresh project: a blank editor with the chosen library forced. */
  function newProject(library: ProfileId) {
    source.value = ''
    // Blank source → storyKey is 'untitled'.
    activeStoryKey.value = storyKey.value
    // Only set/persist the I6 library profile for I6; ZIL has no library concept
    // and persisting 'std' into the ZIL storage bucket is a state smell.
    if (profile.value.id === 'i6') setProfileMode(library)
    resetForNewSource()
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

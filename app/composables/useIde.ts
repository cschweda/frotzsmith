import type { CompileResult, StoryExt } from '~/modules/inform6/types'
import { formatI6 } from '~/utils/format-i6'
import { storyTitleOf } from '~/utils/story-title'
import { getExtrasStore } from '~/composables/project-extras-store'
import { formatZil } from '~/utils/format-zil'
import { safeGetItem, safeRemoveItem, safeSetItem } from '~/utils/safe-storage'
import { notifyStorageFull } from '~/composables/useStorageNotice'
import { useOutsideSource } from '~/composables/outside-source'
import { PROFILES, detectProfile, type ProfileId } from '~/modules/inform6/profiles'
import { sampleById, loadSampleSource } from '~/modules/inform6/samples'
import { sampleById as zilSampleById } from '~/modules/languages/zil/samples'
import { frotzsmith, buildStorageKey } from '~~/frotzsmith.config'

export type CompileStatus = 'idle' | 'compiling' | 'success' | 'error'
export type RightTab = 'results' | 'play' | 'transcript' | 'testscript' | 'skein' | 'map'
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
  /** Which pane the single-pane (mobile) layout shows. Shared so actions
   *  elsewhere can bring the right pane forward — e.g. tapping a diagnostic
   *  must show the editor it scrolls. Ignored by the desktop two-pane layout. */
  const mobileView = useState<'editor' | 'output'>('frotz:mobile-view', () => 'editor')

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

  /** The story title from the source, used for Save-As filenames — language-aware. */
  const storyTitle = computed(() => storyTitleOf(profile.value.id === 'zil' ? 'zil' : 'i6', source.value))
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

  /** Bumped whenever the editor moves to a different source (sample, opened
   *  file, new project, language switch). An in-flight compile or sample load
   *  captures it and drops its result if it changed — otherwise a slow ZIL
   *  compile (5-9 s) would land its story into the NEXT game and Play / the
   *  Skein would run the wrong build. */
  const sourceGen = useState<number>('frotz:source-gen', () => 0)

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
    sourceGen.value += 1
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
    const gen = sourceGen.value
    await nextPaint()
    const started = performance.now()
    // The source moved on while this compile ran: its result belongs to a
    // game that is no longer in the editor (resetForNewSource already put
    // status back to idle).
    const superseded = () => sourceGen.value !== gen
    try {
      if (superseded()) return
      const r = await compile(source.value, {
        profileId: pid,
        ext: effectiveExt.value,
        extensions: enabledFiles.value,
      })
      if (superseded()) return
      result.value = r
      usedProfile.value = pid
      status.value = r.ok ? 'success' : 'error'
    } catch (err: unknown) {
      // A thrown exception (vs. an ok:false result) means the compiler itself
      // failed — e.g. the lazy inform6.mjs/wasm fetch rejected. Surface it as a
      // failed CompileResult so ResultsPanel shows the reason instead of an
      // empty "0 errors" error state (the ZIL path already does this).
      if (superseded()) return
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
      // Only a compile whose result landed arms the freeze-click debounce.
      if (import.meta.client && !superseded()) lastCompileEnd.value = performance.now()
    }
  }

  function jumpTo(line: number) {
    mobileView.value = 'editor'
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
    if (import.meta.client && !safeSetItem(buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.profileMode), mode))
      notifyStorageFull()
  }

  function setTargetMode(mode: 'auto' | StoryExt) {
    targetMode.value = mode
    if (import.meta.client && !safeSetItem(buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.target), mode))
      notifyStorageFull()
  }

  /** A different source is being loaded: hidden files kept from an opened
   *  `.frotzsmith` project no longer belong to the editor's game (the owner
   *  marker and the stored record both go), even when
   *  the new one has the same title (useProjectPackage re-claims them after
   *  its own loadSource). Not part of resetForNewSource — that also runs on a
   *  language-switch restore, which keeps the same game. */
  function releaseExtras() {
    if (!import.meta.client) return
    safeRemoveItem(buildStorageKey(profile.value.stateKey, frotzsmith.storageKeys.extrasOwner))
    // …and drop the record itself, so the store never outgrows one project.
    void getExtrasStore().clear(profile.value.stateKey)
  }

  /** Load a built-in sample into the editor, prettified for consistent formatting
   *  (unless the sample sets `format: false`).
   *  Async: I6 sample bodies live in per-sample lazy chunks (loadSampleSource). */
  async function loadSample(id: string): Promise<void> {
    // ZIL samples: look up from the ZIL sample registry; no I6 formatting.
    if (profile.value.id === 'zil') {
      const s = zilSampleById(id)
      if (!s) return
      source.value = s.source
      activeStoryKey.value = storyKey.value
      setTargetMode(s.target)
      resetForNewSource()
      releaseExtras()
      useOutsideSource().trust() // the author's own choice of source (F2)
      return
    }
    // I6 path.
    const s = sampleById(id)
    if (!s) return
    // The body is a lazy chunk: a second sample click, another load, or a
    // language switch during the fetch must win over this one.
    const gen = sourceGen.value
    const lang = profile.value.id
    const src = await loadSampleSource(id)
    if (src === null) return // chunk failed to load — keep the current source
    if (sourceGen.value !== gen || profile.value.id !== lang) return
    source.value = s.format === false ? src : formatI6(src)
    // Commit the new game's bucket key AFTER source is set so storyKey reflects the sample.
    activeStoryKey.value = storyKey.value
    // Reset to auto so the sample compiles with its own library, not whatever
    // profile happens to be forced (e.g. from a prior New Project).
    setProfileMode('auto')
    setTargetMode(s.target ?? 'auto')
    resetForNewSource()
    releaseExtras()
    useOutsideSource().trust() // the author's own choice of source (F2)
  }

  /** Load arbitrary source text (e.g. an opened .inf file) into the editor. */
  function loadSource(text: string) {
    source.value = text
    // Commit the new game's bucket key AFTER source is set so storyKey reflects the loaded file.
    activeStoryKey.value = storyKey.value
    resetForNewSource()
    releaseExtras()
  }

  /** Load a source file the author opened from disk. It arrived from outside
   *  like a package does, so Skein auto-run waits until Play or Run (F2). */
  function loadOpenedFile(text: string) {
    loadSource(text)
    useOutsideSource().markOutside()
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
    releaseExtras()
    useOutsideSource().trust() // a blank project of the author's own (F2)
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
    // The author chose to play: a package/share-link source is trusted from
    // here on, so Skein auto-run resumes (audit F2; see outside-source.ts).
    useOutsideSource().trust()
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
    mobileView,
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
    loadOpenedFile,
    newProject,
    playStory,
    sendToPlay,
  }
}
